using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace BrewBar.Tests.Integration;

public class ModifiersApiTests : IClassFixture<TestFixture>
{
    private readonly TestFixture _f;

    public ModifiersApiTests(TestFixture fixture) => _f = fixture;

    // --- List ---

    [Fact]
    public async Task GetModifiers_ReturnsSeededModifiers()
    {
        var client = await _f.AsAdmin();
        var response = await client.GetAsync("/api/modifiers");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.GetArrayLength() >= 3); // Size, Boost, Milk
    }

    [Fact]
    public async Task GetModifiers_AsCashier_Returns403()
    {
        // ModifiersController has [Authorize(Roles = "Admin,Manager")] at class level
        var client = await _f.AsCashier();
        var response = await client.GetAsync("/api/modifiers");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // --- Get by ID ---

    [Fact]
    public async Task GetModifier_ReturnsModifierWithOptions()
    {
        var client = await _f.AsAdmin();
        var response = await client.GetAsync("/api/modifiers/1"); // Size

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Size", json.GetProperty("name").GetString());
        Assert.True(json.GetProperty("options").GetArrayLength() >= 2);
    }

    [Fact]
    public async Task GetModifier_NonExistent_Returns404()
    {
        var client = await _f.AsAdmin();
        var response = await client.GetAsync("/api/modifiers/9999");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // --- Create ---

    [Fact]
    public async Task CreateModifier_WithOptions_Returns201()
    {
        var client = await _f.AsAdmin();
        var response = await client.PostAsJsonAsync("/api/modifiers", new
        {
            name = "Sweetener",
            isRequired = false,
            allowMultiple = false,
            sortOrder = 10,
            options = new[]
            {
                new { name = "Honey", price = 0.50, sortOrder = 0 },
                new { name = "Agave", price = 0.50, sortOrder = 1 }
            }
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Sweetener", json.GetProperty("name").GetString());
        Assert.Equal(2, json.GetProperty("options").GetArrayLength());
    }

    [Fact]
    public async Task CreateModifier_AsCashier_Returns403()
    {
        var client = await _f.AsCashier();
        var response = await client.PostAsJsonAsync("/api/modifiers", new
        {
            name = "Unauthorized",
            isRequired = false,
            allowMultiple = false,
            sortOrder = 0,
            options = Array.Empty<object>()
        });
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // --- Update ---

    [Fact]
    public async Task UpdateModifier_ChangesFields()
    {
        var client = await _f.AsAdmin();

        var createResponse = await client.PostAsJsonAsync("/api/modifiers", new
        {
            name = "To Update",
            isRequired = false,
            allowMultiple = false,
            sortOrder = 0,
            options = Array.Empty<object>()
        });
        var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var id = created.GetProperty("id").GetInt32();

        var updateResponse = await client.PutAsJsonAsync($"/api/modifiers/{id}", new
        {
            name = "Updated Modifier",
            isRequired = true,
            allowMultiple = true,
            sortOrder = 5
        });

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var json = await updateResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Updated Modifier", json.GetProperty("name").GetString());
        Assert.True(json.GetProperty("isRequired").GetBoolean());
        Assert.True(json.GetProperty("allowMultiple").GetBoolean());
    }

    // --- Delete ---

    [Fact]
    public async Task DeleteModifier_Unassigned_Returns204()
    {
        var client = await _f.AsAdmin();

        var createResponse = await client.PostAsJsonAsync("/api/modifiers", new
        {
            name = "To Delete",
            isRequired = false,
            allowMultiple = false,
            sortOrder = 0,
            options = Array.Empty<object>()
        });
        var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var id = created.GetProperty("id").GetInt32();

        var deleteResponse = await client.DeleteAsync($"/api/modifiers/{id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
    }

    [Fact]
    public async Task DeleteModifier_AssignedToProduct_Returns400()
    {
        var client = await _f.AsAdmin();
        // Modifier 1 (Size) is assigned to products from seed
        var response = await client.DeleteAsync("/api/modifiers/1");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // --- Options ---

    [Fact]
    public async Task CreateOption_ReturnsOption()
    {
        var client = await _f.AsAdmin();

        var createResponse = await client.PostAsJsonAsync("/api/modifiers", new
        {
            name = "Option Test Mod",
            isRequired = false,
            allowMultiple = false,
            sortOrder = 0,
            options = Array.Empty<object>()
        });
        var mod = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var modId = mod.GetProperty("id").GetInt32();

        var optResponse = await client.PostAsJsonAsync($"/api/modifiers/{modId}/options", new
        {
            name = "Extra Shot",
            price = 0.75,
            sortOrder = 0
        });

        Assert.Equal(HttpStatusCode.Created, optResponse.StatusCode);
        var opt = await optResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Extra Shot", opt.GetProperty("name").GetString());
        Assert.Equal(0.75m, opt.GetProperty("price").GetDecimal());
    }

    [Fact]
    public async Task UpdateOption_ChangesFields()
    {
        var client = await _f.AsAdmin();

        // Create modifier with an option
        var createResponse = await client.PostAsJsonAsync("/api/modifiers", new
        {
            name = "Option Update Test",
            isRequired = false,
            allowMultiple = false,
            sortOrder = 0,
            options = new[] { new { name = "Original", price = 1.00, sortOrder = 0 } }
        });
        var mod = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var modId = mod.GetProperty("id").GetInt32();
        var optId = mod.GetProperty("options")[0].GetProperty("id").GetInt32();

        var updateResponse = await client.PutAsJsonAsync($"/api/modifiers/{modId}/options/{optId}", new
        {
            name = "Renamed",
            price = 2.00,
            sortOrder = 1
        });

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var opt = await updateResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Renamed", opt.GetProperty("name").GetString());
        Assert.Equal(2.00m, opt.GetProperty("price").GetDecimal());
    }

    [Fact]
    public async Task DeleteOption_Returns204()
    {
        var client = await _f.AsAdmin();

        var createResponse = await client.PostAsJsonAsync("/api/modifiers", new
        {
            name = "Option Delete Test",
            isRequired = false,
            allowMultiple = false,
            sortOrder = 0,
            options = new[] { new { name = "ToRemove", price = 0.50, sortOrder = 0 } }
        });
        var mod = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var modId = mod.GetProperty("id").GetInt32();
        var optId = mod.GetProperty("options")[0].GetProperty("id").GetInt32();

        var deleteResponse = await client.DeleteAsync($"/api/modifiers/{modId}/options/{optId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
    }
}
