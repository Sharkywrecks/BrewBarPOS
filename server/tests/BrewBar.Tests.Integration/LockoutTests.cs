using System.Net;
using System.Net.Http.Json;
using BrewBar.Core.Entities.Identity;
using BrewBar.Core.Constants;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace BrewBar.Tests.Integration;

/// <summary>
/// Lockout coverage for /login and /pin-login. Uses its own fixture because lockout
/// state would persist across tests sharing a DB and make the shared TestFixture flaky.
/// </summary>
public class LockoutTests : IAsyncLifetime
{
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;
    private string _userId = string.Empty;
    private readonly string _dbName = $"brewbar_lockout_{Guid.NewGuid():N}.db";

    private const string Email = "locktarget@test.local";
    private const string Password = "LockTest123!";
    private const string Pin = "7777";

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
        await _client.GetAsync("/health/ready");

        using var scope = _factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<AppUser>>();
        var user = new AppUser { Email = Email, UserName = Email, DisplayName = "Lock Target" };
        user.PinHash = hasher.HashPassword(user, Pin);
        var create = await userManager.CreateAsync(user, Password);
        if (!create.Succeeded)
            throw new InvalidOperationException(string.Join(", ", create.Errors.Select(e => e.Description)));
        await userManager.AddToRoleAsync(user, Roles.Cashier);
        _userId = user.Id;
    }

    public Task DisposeAsync()
    {
        _client.Dispose();
        _factory.Dispose();
        try { File.Delete(_dbName); } catch { /* best effort */ }
        return Task.CompletedTask;
    }

    [Fact]
    public async Task PinLogin_AfterFiveFailures_Locks_ThenCorrectPinIsRejected()
    {
        // Identity's default lockout trips after MaxFailedAccessAttempts (5).
        for (var i = 0; i < 5; i++)
        {
            var bad = await _client.PostAsJsonAsync("/api/auth/pin-login",
                new { userId = _userId, pin = "0000" });
            Assert.Equal(HttpStatusCode.Unauthorized, bad.StatusCode);
        }

        // Correct PIN must now be rejected: lockout beats credential correctness.
        var good = await _client.PostAsJsonAsync("/api/auth/pin-login",
            new { userId = _userId, pin = Pin });
        Assert.Equal(HttpStatusCode.Unauthorized, good.StatusCode);
    }

    [Fact]
    public async Task Login_AfterFiveFailures_Locks_ThenCorrectPasswordIsRejected()
    {
        for (var i = 0; i < 5; i++)
        {
            var bad = await _client.PostAsJsonAsync("/api/auth/login",
                new { email = Email, password = "wrong" });
            Assert.Equal(HttpStatusCode.Unauthorized, bad.StatusCode);
        }

        var good = await _client.PostAsJsonAsync("/api/auth/login",
            new { email = Email, password = Password });
        Assert.Equal(HttpStatusCode.Unauthorized, good.StatusCode);
    }
}
