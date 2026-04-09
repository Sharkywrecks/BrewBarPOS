using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace BrewBar.Tests.Integration;

/// <summary>
/// Shared test fixture that creates a WebApplicationFactory with SQLite,
/// seeds data, and provides helper methods for authentication.
/// </summary>
public class TestFixture : IAsyncLifetime
{
    public WebApplicationFactory<Program> Factory { get; private set; } = null!;
    public HttpClient Client { get; private set; } = null!;

    private readonly string _dbName = $"brewbar_test_{Guid.NewGuid():N}.db";

    public async Task InitializeAsync()
    {
        Factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("DatabaseProvider", "Sqlite");
            builder.UseSetting("ConnectionStrings:DefaultConnection", $"Data Source={_dbName}");
            builder.UseSetting("Jwt:Secret", "test-jwt-secret-key-that-is-at-least-32-characters-long");
            builder.UseSetting("Jwt:Issuer", "TestIssuer");
            builder.UseSetting("Jwt:Audience", "TestAudience");
        });

        Client = Factory.CreateClient();

        // Warm up — first request triggers DB creation + seed
        await Client.GetAsync("/health/ready");

        // Production seed only creates roles + admin/cashier; tests need a deterministic
        // catalog (modifiers, categories, products) so legacy tests that hard-code IDs work.
        await TestSeed.SeedCatalogAsync(Factory.Services);
    }

    public Task DisposeAsync()
    {
        Client.Dispose();
        Factory.Dispose();
        try { File.Delete(_dbName); } catch { /* best effort */ }
        return Task.CompletedTask;
    }

    public async Task<string> GetToken(string email, string password)
    {
        var response = await Client.PostAsJsonAsync("/api/auth/login", new { email, password });
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        return json.GetProperty("token").GetString()!;
    }

    public async Task<string> GetAdminToken()
        => await GetToken("admin@brewbar.local", "Admin123!");

    public async Task<string> GetCashierToken()
        => await GetToken("cashier@brewbar.local", "Cashier123!");

    public HttpClient CreateAuthenticatedClient(string token)
    {
        var client = Factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    public async Task<HttpClient> AsAdmin()
        => CreateAuthenticatedClient(await GetAdminToken());

    public async Task<HttpClient> AsCashier()
        => CreateAuthenticatedClient(await GetCashierToken());

    public async Task<string> GetPinToken(string pin)
    {
        var response = await Client.PostAsJsonAsync("/api/auth/pin-login", new { pin });
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        return json.GetProperty("token").GetString()!;
    }

    /// <summary>Authenticated as the seeded admin via PIN (1234) — token carries auth_method=pin.</summary>
    public async Task<HttpClient> AsAdminViaPin()
        => CreateAuthenticatedClient(await GetPinToken("1234"));

    /// <summary>Authenticated as the seeded cashier via PIN (0000) — token carries auth_method=pin.</summary>
    public async Task<HttpClient> AsCashierViaPin()
        => CreateAuthenticatedClient(await GetPinToken("0000"));
}
