using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using BrewBar.Core.Entities;
using BrewBar.Core.Entities.Identity;
using BrewBar.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace BrewBar.Tests.Integration;

/// <summary>
/// Tests the file-driven bootstrap path used by the MSI installer to create the
/// initial admin + apply business settings on first launch. The bootstrap file
/// must be consumed exactly once, deleted in every terminal case, and gated on a
/// zero-users precondition (so a stolen file cannot be replayed).
/// </summary>
public class BootstrapServiceTests
{
    private const string ValidPayload = """
        {
          "admin": {
            "displayName": "Cafe Owner",
            "email": "owner@cafe.local",
            "password": "OwnerPass123!",
            "pin": "4242"
          },
          "businessSettings": {
            "storeName": "Sunny Cafe",
            "taxRate": 0.15,
            "currency": "SCR"
          }
        }
        """;

    private static async Task<(WebApplicationFactory<Program> Factory, string DbName, string BootstrapPath)>
        CreateFactoryAsync(string? payload = null)
    {
        var dbName = $"brewbar_bootstrap_{Guid.NewGuid():N}.db";
        var bootstrapPath = Path.Combine(Path.GetTempPath(), $"bootstrap_{Guid.NewGuid():N}.json");

        if (payload is not null)
            await File.WriteAllTextAsync(bootstrapPath, payload);

        var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("DatabaseProvider", "Sqlite");
            builder.UseSetting("ConnectionStrings:DefaultConnection", $"Data Source={dbName}");
            builder.UseSetting("Jwt:Secret", "test-jwt-secret-key-that-is-at-least-32-characters-long");
            builder.UseSetting("Jwt:Issuer", "TestIssuer");
            builder.UseSetting("Jwt:Audience", "TestAudience");
            builder.UseSetting("RateLimit:AuthPermitLimit", "100000");
            builder.UseSetting("Bootstrap:FilePath", bootstrapPath);
        });

        return (factory, dbName, bootstrapPath);
    }

    private static void Cleanup(WebApplicationFactory<Program> factory, string dbName, string bootstrapPath)
    {
        factory.Dispose();
        try { File.Delete(dbName); } catch { /* best effort */ }
        try { if (File.Exists(bootstrapPath)) File.Delete(bootstrapPath); } catch { /* best effort */ }
    }

    [Fact]
    public async Task Bootstrap_WithValidFile_CreatesAdminAndAppliesSettings_AndDeletesFile()
    {
        var (factory, dbName, path) = await CreateFactoryAsync(ValidPayload);
        try
        {
            using var client = factory.CreateClient();
            await client.GetAsync("/health/ready"); // triggers startup pipeline

            // File must be deleted after successful bootstrap.
            Assert.False(File.Exists(path), "bootstrap file should be deleted after success");

            // Admin should now be able to log in via the new credentials.
            var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new
            {
                email = "owner@cafe.local",
                password = "OwnerPass123!"
            });
            Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
            var loginJson = await loginResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Cafe Owner", loginJson.GetProperty("displayName").GetString());
            Assert.Contains("Admin", loginJson.GetProperty("roles").EnumerateArray().Select(r => r.GetString()));

            // Business settings should be applied.
            var settingsResponse = await client.GetAsync("/api/settings");
            Assert.Equal(HttpStatusCode.OK, settingsResponse.StatusCode);
            var settingsJson = await settingsResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Sunny Cafe", settingsJson.GetProperty("storeName").GetString());
        }
        finally
        {
            Cleanup(factory, dbName, path);
        }
    }

    [Fact]
    public async Task Bootstrap_PinIsHashedNotPlaintext()
    {
        var (factory, dbName, path) = await CreateFactoryAsync(ValidPayload);
        try
        {
            using var client = factory.CreateClient();
            await client.GetAsync("/health/ready");

            using var scope = factory.Services.CreateScope();
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
            var user = await userManager.FindByEmailAsync("owner@cafe.local");

            Assert.NotNull(user);
            Assert.False(string.IsNullOrEmpty(user!.PinHash));
            Assert.NotEqual("4242", user.PinHash);
            // Identity password hashes start with a base64-encoded format byte.
            Assert.True(user.PinHash!.Length > 20);
        }
        finally
        {
            Cleanup(factory, dbName, path);
        }
    }

    [Fact]
    public async Task Bootstrap_WhenUsersAlreadyExist_DoesNotApply_ButStillDeletesFile()
    {
        // Seed an existing user FIRST (no bootstrap file yet), then drop the file in
        // and rebuild the factory so the startup pipeline re-runs against a non-empty DB.
        var dbName = $"brewbar_bootstrap_{Guid.NewGuid():N}.db";
        var path = Path.Combine(Path.GetTempPath(), $"bootstrap_{Guid.NewGuid():N}.json");

        WebApplicationFactory<Program> NewFactory() =>
            new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            {
                builder.UseSetting("DatabaseProvider", "Sqlite");
                builder.UseSetting("ConnectionStrings:DefaultConnection", $"Data Source={dbName}");
                builder.UseSetting("Jwt:Secret", "test-jwt-secret-key-that-is-at-least-32-characters-long");
                builder.UseSetting("Jwt:Issuer", "TestIssuer");
                builder.UseSetting("Jwt:Audience", "TestAudience");
                builder.UseSetting("RateLimit:AuthPermitLimit", "100000");
                builder.UseSetting("Bootstrap:FilePath", path);
            });

        try
        {
            // Phase 1: start the factory, seed a user, no bootstrap file present.
            var first = NewFactory();
            using (var c = first.CreateClient())
            {
                await c.GetAsync("/health/ready");
                using var scope = first.Services.CreateScope();
                var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
                var existing = new AppUser { Email = "first@local", UserName = "first@local", DisplayName = "First" };
                Assert.True((await userManager.CreateAsync(existing, "First123!")).Succeeded);
            }
            first.Dispose();

            // Phase 2: drop the bootstrap file in and start a fresh factory against the same DB.
            await File.WriteAllTextAsync(path, ValidPayload);

            var second = NewFactory();
            try
            {
                using var c = second.CreateClient();
                await c.GetAsync("/health/ready");

                // File deleted (precondition failure still cleans up).
                Assert.False(File.Exists(path));

                // Bootstrap admin must NOT have been created.
                using var scope = second.Services.CreateScope();
                var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
                Assert.Null(await userManager.FindByEmailAsync("owner@cafe.local"));
            }
            finally
            {
                second.Dispose();
            }
        }
        finally
        {
            try { File.Delete(dbName); } catch { /* best effort */ }
            try { if (File.Exists(path)) File.Delete(path); } catch { /* best effort */ }
        }
    }

    [Fact]
    public async Task Bootstrap_MalformedJson_DoesNotCrashAndDeletesFile()
    {
        var (factory, dbName, path) = await CreateFactoryAsync("not even json {[");
        try
        {
            using var client = factory.CreateClient();
            // Should not throw — startup must succeed even with garbage in the file.
            var response = await client.GetAsync("/health/ready");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            Assert.False(File.Exists(path), "malformed file should still be deleted");
        }
        finally
        {
            Cleanup(factory, dbName, path);
        }
    }

    [Fact]
    public async Task Bootstrap_MissingAdminSection_DoesNotCreateUser()
    {
        var payload = """
            {
              "businessSettings": { "storeName": "OnlySettings" }
            }
            """;
        var (factory, dbName, path) = await CreateFactoryAsync(payload);
        try
        {
            using var client = factory.CreateClient();
            await client.GetAsync("/health/ready");

            Assert.False(File.Exists(path));

            using var scope = factory.Services.CreateScope();
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
            Assert.False(await userManager.Users.AnyAsync());
        }
        finally
        {
            Cleanup(factory, dbName, path);
        }
    }

    [Fact]
    public async Task Bootstrap_NoFile_StartsUpNormally()
    {
        var (factory, dbName, path) = await CreateFactoryAsync();
        try
        {
            using var client = factory.CreateClient();
            var response = await client.GetAsync("/health/ready");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
        finally
        {
            Cleanup(factory, dbName, path);
        }
    }

    [Fact]
    public async Task Bootstrap_InvalidPin_DoesNotCreateUser()
    {
        var payload = """
            {
              "admin": {
                "displayName": "Bad Pin",
                "email": "badpin@local",
                "password": "GoodPass123!",
                "pin": "abc"
              }
            }
            """;
        var (factory, dbName, path) = await CreateFactoryAsync(payload);
        try
        {
            using var client = factory.CreateClient();
            await client.GetAsync("/health/ready");

            Assert.False(File.Exists(path));

            using var scope = factory.Services.CreateScope();
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
            Assert.False(await userManager.Users.AnyAsync());
        }
        finally
        {
            Cleanup(factory, dbName, path);
        }
    }
}
