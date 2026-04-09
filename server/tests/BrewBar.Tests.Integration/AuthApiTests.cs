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
            email = TestSeed.AdminEmail,
            password = TestSeed.AdminPassword
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
            email = TestSeed.AdminEmail,
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
        var response = await _f.Client.PostAsJsonAsync("/api/auth/pin-login", new
        {
            userId = _f.AdminUserId,
            pin = "1234"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(string.IsNullOrEmpty(json.GetProperty("token").GetString()));
    }

    [Fact]
    public async Task PinLogin_CashierPin_ReturnsCorrectRole()
    {
        var response = await _f.Client.PostAsJsonAsync("/api/auth/pin-login", new
        {
            userId = _f.CashierUserId,
            pin = "0000"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Demo Cashier", json.GetProperty("displayName").GetString());
        Assert.Contains("Cashier", json.GetProperty("roles").EnumerateArray().Select(r => r.GetString()));
    }

    [Fact]
    public async Task PinLogin_InvalidPin_Returns401()
    {
        var response = await _f.Client.PostAsJsonAsync("/api/auth/pin-login", new
        {
            userId = _f.AdminUserId,
            pin = "9999"
        });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task PinLogin_NonexistentUserId_Returns401()
    {
        // Even with the admin's real PIN, an unknown userId must not authenticate.
        var response = await _f.Client.PostAsJsonAsync("/api/auth/pin-login", new
        {
            userId = Guid.NewGuid().ToString(),
            pin = "1234"
        });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task PinLogin_AdminUserIdWithCashierPin_Returns401()
    {
        // Regression: previously the endpoint resolved by PIN alone, so selecting
        // "Admin" in the picker but typing the cashier's PIN would log you in as the
        // cashier. Now the userId scopes the lookup, so a mismatched PIN must fail.
        var response = await _f.Client.PostAsJsonAsync("/api/auth/pin-login", new
        {
            userId = _f.AdminUserId,
            pin = "0000"
        });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task PinLogin_SamePinDifferentUsers_ResolvesByUserId()
    {
        // Two users sharing the same PIN must each authenticate as themselves when
        // logging in via their own userId. Guards against any future regression that
        // re-introduces a "FirstOrDefault by PIN" lookup.
        var adminClient = await _f.AsAdmin();
        var sharedPin = "5151";

        var emailA = $"share_a_{Guid.NewGuid():N}@brewbar.local";
        var emailB = $"share_b_{Guid.NewGuid():N}@brewbar.local";

        var createA = await adminClient.PostAsJsonAsync("/api/auth/register", new
        {
            displayName = "Share A",
            email = emailA,
            password = "Test123!",
            pin = sharedPin,
            role = "Cashier"
        });
        createA.EnsureSuccessStatusCode();
        var aJson = await createA.Content.ReadFromJsonAsync<JsonElement>();
        var idA = aJson.GetProperty("id").GetString()!;

        var createB = await adminClient.PostAsJsonAsync("/api/auth/register", new
        {
            displayName = "Share B",
            email = emailB,
            password = "Test123!",
            pin = sharedPin,
            role = "Cashier"
        });
        createB.EnsureSuccessStatusCode();
        var bJson = await createB.Content.ReadFromJsonAsync<JsonElement>();
        var idB = bJson.GetProperty("id").GetString()!;

        var loginA = await _f.Client.PostAsJsonAsync("/api/auth/pin-login", new { userId = idA, pin = sharedPin });
        Assert.Equal(HttpStatusCode.OK, loginA.StatusCode);
        var aLoginJson = await loginA.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Share A", aLoginJson.GetProperty("displayName").GetString());

        var loginB = await _f.Client.PostAsJsonAsync("/api/auth/pin-login", new { userId = idB, pin = sharedPin });
        Assert.Equal(HttpStatusCode.OK, loginB.StatusCode);
        var bLoginJson = await loginB.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Share B", bLoginJson.GetProperty("displayName").GetString());
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
            email = TestSeed.AdminEmail,
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
        Assert.Equal(TestSeed.AdminEmail, json.GetProperty("email").GetString());
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
            email = TestSeed.AdminEmail,
            password = TestSeed.AdminPassword
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("password", json.GetProperty("authMethod").GetString());
    }

    [Fact]
    public async Task PinLogin_ReturnsPinAuthMethod()
    {
        var response = await _f.Client.PostAsJsonAsync("/api/auth/pin-login", new
        {
            userId = _f.CashierUserId,
            pin = "0000"
        });

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
