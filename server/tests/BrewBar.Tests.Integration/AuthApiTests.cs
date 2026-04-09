using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace BrewBar.Tests.Integration;

public class AuthApiTests : IClassFixture<TestFixture>
{
    private readonly TestFixture _f;

    public AuthApiTests(TestFixture fixture) => _f = fixture;

    // --- Login ---

    [Fact]
    public async Task Login_ValidCredentials_ReturnsToken()
    {
        var response = await _f.Client.PostAsJsonAsync("/api/auth/login", new
        {
            email = "admin@brewbar.local",
            password = "Admin123!"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(string.IsNullOrEmpty(json.GetProperty("token").GetString()));
        Assert.Equal("Admin", json.GetProperty("displayName").GetString());
        Assert.Contains("Admin", json.GetProperty("roles").EnumerateArray().Select(r => r.GetString()));
    }

    [Fact]
    public async Task Login_WrongPassword_Returns401()
    {
        var response = await _f.Client.PostAsJsonAsync("/api/auth/login", new
        {
            email = "admin@brewbar.local",
            password = "wrong"
        });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_NonExistentUser_Returns401()
    {
        var response = await _f.Client.PostAsJsonAsync("/api/auth/login", new
        {
            email = "nobody@brewbar.local",
            password = "anything"
        });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // --- PIN Login ---

    [Fact]
    public async Task PinLogin_ValidPin_ReturnsToken()
    {
        var response = await _f.Client.PostAsJsonAsync("/api/auth/pin-login", new { pin = "1234" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(string.IsNullOrEmpty(json.GetProperty("token").GetString()));
    }

    [Fact]
    public async Task PinLogin_CashierPin_ReturnsCorrectRole()
    {
        var response = await _f.Client.PostAsJsonAsync("/api/auth/pin-login", new { pin = "0000" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Demo Cashier", json.GetProperty("displayName").GetString());
        Assert.Contains("Cashier", json.GetProperty("roles").EnumerateArray().Select(r => r.GetString()));
    }

    [Fact]
    public async Task PinLogin_InvalidPin_Returns401()
    {
        var response = await _f.Client.PostAsJsonAsync("/api/auth/pin-login", new { pin = "9999" });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // --- Register ---

    [Fact]
    public async Task Register_AsAdmin_CreatesUser()
    {
        var client = await _f.AsAdmin();
        var response = await client.PostAsJsonAsync("/api/auth/register", new
        {
            displayName = "New Cashier",
            email = $"new_{Guid.NewGuid():N}@brewbar.local",
            password = "Test123!",
            pin = "5555",
            role = "Cashier"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("New Cashier", json.GetProperty("displayName").GetString());
        Assert.Contains("Cashier", json.GetProperty("roles").EnumerateArray().Select(r => r.GetString()));
    }

    [Fact]
    public async Task Register_DuplicateEmail_Returns400()
    {
        var client = await _f.AsAdmin();
        var response = await client.PostAsJsonAsync("/api/auth/register", new
        {
            displayName = "Duplicate",
            email = "admin@brewbar.local",
            password = "Test123!",
            role = "Cashier"
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Register_AsCashier_Returns403()
    {
        var client = await _f.AsCashier();
        var response = await client.PostAsJsonAsync("/api/auth/register", new
        {
            displayName = "Unauthorized",
            email = $"unauth_{Guid.NewGuid():N}@brewbar.local",
            password = "Test123!",
            role = "Cashier"
        });
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // --- Current User ---

    [Fact]
    public async Task GetCurrentUser_Authenticated_ReturnsUser()
    {
        var client = await _f.AsAdmin();
        var response = await client.GetAsync("/api/auth/current");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("admin@brewbar.local", json.GetProperty("email").GetString());
    }

    [Fact]
    public async Task GetCurrentUser_Unauthenticated_Returns401()
    {
        var response = await _f.Client.GetAsync("/api/auth/current");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // --- Users List ---

    [Fact]
    public async Task GetUsers_AsAdmin_ReturnsAll()
    {
        var client = await _f.AsAdmin();
        var response = await client.GetAsync("/api/auth/users");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.GetArrayLength() >= 2); // admin + cashier at minimum
    }

    [Fact]
    public async Task GetUsers_AsCashier_Returns403()
    {
        var client = await _f.AsCashier();
        var response = await client.GetAsync("/api/auth/users");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // --- auth_method claim ---

    [Fact]
    public async Task Login_ReturnsPasswordAuthMethod()
    {
        var response = await _f.Client.PostAsJsonAsync("/api/auth/login", new
        {
            email = "admin@brewbar.local",
            password = "Admin123!"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("password", json.GetProperty("authMethod").GetString());
    }

    [Fact]
    public async Task PinLogin_ReturnsPinAuthMethod()
    {
        var response = await _f.Client.PostAsJsonAsync("/api/auth/pin-login", new { pin = "0000" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("pin", json.GetProperty("authMethod").GetString());
    }

    [Fact]
    public async Task GetCurrentUser_PasswordSession_PreservesAuthMethod()
    {
        var client = await _f.AsAdmin();
        var response = await client.GetAsync("/api/auth/current");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("password", json.GetProperty("authMethod").GetString());
    }

    [Fact]
    public async Task GetCurrentUser_PinSession_PreservesAuthMethod()
    {
        // Calling /current must NOT silently upgrade a pin session into a password session.
        var client = await _f.AsCashierViaPin();
        var response = await client.GetAsync("/api/auth/current");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("pin", json.GetProperty("authMethod").GetString());
    }

    // --- Policy enforcement: pin tokens are scoped to POS, never elevated endpoints ---

    [Fact]
    public async Task AdminEndpoint_WithPinToken_Returns403_EvenForAdminRole()
    {
        // Seeded admin has BOTH a password and a pin (1234). A pin-issued token must
        // not grant access to admin endpoints, even though the user holds the Admin role.
        var client = await _f.AsAdminViaPin();
        var response = await client.GetAsync("/api/auth/users");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task AdminEndpoint_WithPasswordToken_ReturnsOk()
    {
        var client = await _f.AsAdmin();
        var response = await client.GetAsync("/api/auth/users");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task RegisterEndpoint_WithAdminPinToken_Returns403()
    {
        var client = await _f.AsAdminViaPin();
        var response = await client.PostAsJsonAsync("/api/auth/register", new
        {
            displayName = "Should Fail",
            email = $"pinblocked_{Guid.NewGuid():N}@brewbar.local",
            password = "Test123!",
            role = "Cashier"
        });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task PosEndpoint_WithPinToken_StillWorks()
    {
        // Pin tokens must remain valid for plain [Authorize] endpoints — POS still works.
        var client = await _f.AsCashierViaPin();
        var response = await client.GetAsync("/api/auth/current");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
