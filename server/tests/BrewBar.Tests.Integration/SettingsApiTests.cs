using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace BrewBar.Tests.Integration;

public class SettingsApiTests : IClassFixture<TestFixture>
{
    private readonly TestFixture _f;

    public SettingsApiTests(TestFixture fixture) => _f = fixture;

    [Fact]
    public async Task GetSettings_Anonymous_ReturnsOk()
    {
        // Settings endpoint is intentionally anonymous — POS needs it at startup.
        var response = await _f.Client.GetAsync("/api/settings");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.TryGetProperty("storeName", out _));
        Assert.True(json.TryGetProperty("taxRate", out _));
        Assert.True(json.TryGetProperty("currency", out _));
    }

    [Fact]
    public async Task UpdateSettings_AsAdmin_PersistsChanges()
    {
        var client = await _f.AsAdmin();

        var update = new
        {
            storeName = "Test Brew Bar",
            storeInfo = "123 Test Street",
            taxRate = 0.15m,
            currency = 0, // SCR
            discountApprovalThreshold = 50.00m
        };

        var response = await client.PutAsJsonAsync("/api/settings", update);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Test Brew Bar", json.GetProperty("storeName").GetString());
        Assert.Equal("123 Test Street", json.GetProperty("storeInfo").GetString());
        Assert.Equal(0.15m, json.GetProperty("taxRate").GetDecimal());

        // Verify it persists across a subsequent GET
        var getResponse = await _f.Client.GetAsync("/api/settings");
        var getJson = await getResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Test Brew Bar", getJson.GetProperty("storeName").GetString());
    }

    [Fact]
    public async Task UpdateSettings_AsCashier_Returns403()
    {
        var client = await _f.AsCashier();
        var response = await client.PutAsJsonAsync("/api/settings", new
        {
            storeName = "Unauthorized Change",
            taxRate = 0.20m,
            currency = 0,
            discountApprovalThreshold = 0m
        });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task UpdateSettings_Unauthenticated_Returns401()
    {
        var response = await _f.Client.PutAsJsonAsync("/api/settings", new
        {
            storeName = "Hacker",
            taxRate = 0m,
            currency = 0,
            discountApprovalThreshold = 0m
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
