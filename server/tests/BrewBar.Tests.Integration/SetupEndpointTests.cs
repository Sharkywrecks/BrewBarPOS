using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BrewBar.Core.Entities.Identity;
using BrewBar.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace BrewBar.Tests.Integration;

/// <summary>
/// Dedicated fixture-less tests for POST /api/auth/setup — the endpoint's whole
/// contract depends on a zero-users precondition, so it can't share the regular
/// TestFixture (which bootstraps admin + cashier during Initialize).
/// </summary>
public class SetupEndpointTests : IAsyncLifetime
{
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;
    private readonly string _dbName = $"brewbar_setup_{Guid.NewGuid():N}.db";

    public async Task InitializeAsync()
    {
        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("DatabaseProvider", "Sqlite");
            builder.UseSetting("ConnectionStrings:DefaultConnection", $"Data Source={_dbName}");
            builder.UseSetting("Jwt:Secret", "test-jwt-secret-key-that-is-at-least-32-characters-long");
            builder.UseSetting("Jwt:Issuer", "TestIssuer");
            builder.UseSetting("Jwt:Audience", "TestAudience");
            builder.UseSetting("RateLimit:AuthPermitLimit", "100000");
        });

        _client = _factory.CreateClient();
        // Warm up so migrations + role seed run before the zero-users check fires.
        await _client.GetAsync("/health/ready");
    }

    public Task DisposeAsync()
    {
        _client.Dispose();
        _factory.Dispose();
        try { File.Delete(_dbName); } catch { /* best effort */ }
        return Task.CompletedTask;
    }

    [Fact]
    public async Task Setup_WhenNoUsersExist_CreatesAdminAndReturnsToken()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/setup", new
        {
            displayName = "First Admin",
            email = "first@brewbar.local",
            password = "FirstAdmin123!",
            pin = "4242"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(string.IsNullOrEmpty(json.GetProperty("token").GetString()));
        Assert.Equal("first@brewbar.local", json.GetProperty("email").GetString());
        Assert.Contains("Admin", json.GetProperty("roles").EnumerateArray().Select(r => r.GetString()));
    }

    [Fact]
    public async Task Setup_WhenUserAlreadyExists_Returns409()
    {
        // First call succeeds...
        var first = await _client.PostAsJsonAsync("/api/auth/setup", new
        {
            displayName = "First Admin",
            email = "first@brewbar.local",
            password = "FirstAdmin123!",
            pin = "4242"
        });
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        // ...second call must be rejected, even from an unauthenticated caller, even
        // targeting a different email. This is what blocks the old takeover vector where
        // an unauth caller could reset the default admin as long as it still existed.
        var second = await _client.PostAsJsonAsync("/api/auth/setup", new
        {
            displayName = "Attacker",
            email = "attacker@brewbar.local",
            password = "Pwned123!",
            pin = "9999"
        });
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    [Fact]
    public async Task Setup_WhenAnyUserExists_RejectsEvenDifferentEmail()
    {
        // Seed a user directly via UserManager (simulating a partially-configured install
        // where setup was completed once and then the admin email was changed).
        using (var scope = _factory.Services.CreateScope())
        {
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
            var existing = new AppUser { Email = "existing@brewbar.local", UserName = "existing@brewbar.local", DisplayName = "Existing" };
            var result = await userManager.CreateAsync(existing, "Existing123!");
            Assert.True(result.Succeeded);
        }

        var response = await _client.PostAsJsonAsync("/api/auth/setup", new
        {
            displayName = "Attacker",
            email = "attacker@brewbar.local",
            password = "Pwned123!",
            pin = "9999"
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        // And no new user should have been created.
        using (var scope = _factory.Services.CreateScope())
        {
            var ctx = scope.ServiceProvider.GetRequiredService<AppIdentityDbContext>();
            var count = await ctx.Users.CountAsync();
            Assert.Equal(1, count);
        }
    }
}
