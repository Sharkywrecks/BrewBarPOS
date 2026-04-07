using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace BrewBar.Tests.Integration;

public class CategoriesApiTests : IClassFixture<TestFixture>
{
    private readonly TestFixture _f;

    public CategoriesApiTests(TestFixture fixture) => _f = fixture;

    // --- List ---

    [Fact]
    public async Task GetCategories_Authenticated_ReturnsList()
    {
        var client = await _f.AsAdmin();
        var response = await client.GetAsync("/api/categories");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.GetArrayLength() >= 4);
    }

    [Fact]
    public async Task GetCategories_ActiveOnly_FiltersInactive()
    {
        var client = await _f.AsAdmin();

        // Create an inactive category
        await client.PostAsJsonAsync("/api/categories", new
        {
            name = "Inactive Cat",
            isActive = false,
            sortOrder = 99
        });

        var allResponse = await client.GetAsync("/api/categories");
        var allJson = await allResponse.Content.ReadFromJsonAsync<JsonElement>();

        var activeResponse = await client.GetAsync("/api/categories?activeOnly=true");
        var activeJson = await activeResponse.Content.ReadFromJsonAsync<JsonElement>();

        Assert.True(allJson.GetArrayLength() > activeJson.GetArrayLength());
    }

    [Fact]
    public async Task GetCategories_Unauthenticated_Returns401()
    {
        var response = await _f.Client.GetAsync("/api/categories");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // --- Get by ID ---

    [Fact]
    public async Task GetCategory_ExistingId_ReturnsDetailWithProducts()
    {
        var client = await _f.AsAdmin();
        var response = await client.GetAsync("/api/categories/1");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Smoothies", json.GetProperty("name").GetString());
        Assert.True(json.GetProperty("products").GetArrayLength() > 0);
    }

    [Fact]
    public async Task GetCategory_NonExistentId_Returns404()
    {
        var client = await _f.AsAdmin();
        var response = await client.GetAsync("/api/categories/9999");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // --- Create ---

    [Fact]
    public async Task CreateCategory_AsAdmin_Returns201()
    {
        var client = await _f.AsAdmin();
        var response = await client.PostAsJsonAsync("/api/categories", new
        {
            name = "Test Category",
            description = "For testing",
            sortOrder = 50,
            isActive = true
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Test Category", json.GetProperty("name").GetString());
        Assert.True(json.GetProperty("id").GetInt32() > 0);
    }

    [Fact]
    public async Task CreateCategory_AsCashier_Returns403()
    {
        var client = await _f.AsCashier();
        var response = await client.PostAsJsonAsync("/api/categories", new
        {
            name = "Unauthorized",
            sortOrder = 0,
            isActive = true
        });
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // --- Update ---

    [Fact]
    public async Task UpdateCategory_AsAdmin_ReturnsUpdated()
    {
        var client = await _f.AsAdmin();

        // Create
        var createResponse = await client.PostAsJsonAsync("/api/categories", new
        {
            name = "To Update",
            sortOrder = 60,
            isActive = true
        });
        var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var id = created.GetProperty("id").GetInt32();

        // Update
        var updateResponse = await client.PutAsJsonAsync($"/api/categories/{id}", new
        {
            name = "Updated Name",
            description = "Updated desc",
            sortOrder = 61,
            isActive = false
        });

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await updateResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Updated Name", updated.GetProperty("name").GetString());
        Assert.False(updated.GetProperty("isActive").GetBoolean());
    }

    [Fact]
    public async Task UpdateCategory_NonExistent_Returns404()
    {
        var client = await _f.AsAdmin();
        var response = await client.PutAsJsonAsync("/api/categories/9999", new
        {
            name = "Nope",
            sortOrder = 0,
            isActive = true
        });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // --- Delete ---

    [Fact]
    public async Task DeleteCategory_Empty_Returns204()
    {
        var client = await _f.AsAdmin();

        var createResponse = await client.PostAsJsonAsync("/api/categories", new
        {
            name = "To Delete",
            sortOrder = 70,
            isActive = true
        });
        var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var id = created.GetProperty("id").GetInt32();

        var deleteResponse = await client.DeleteAsync($"/api/categories/{id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
    }

    [Fact]
    public async Task DeleteCategory_WithProducts_Returns400()
    {
        var client = await _f.AsAdmin();
        // Category 1 (Smoothies) has products from seed data
        var response = await client.DeleteAsync("/api/categories/1");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
