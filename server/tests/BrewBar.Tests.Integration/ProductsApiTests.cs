using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace BrewBar.Tests.Integration;

public class ProductsApiTests : IClassFixture<TestFixture>
{
    private readonly TestFixture _f;

    public ProductsApiTests(TestFixture fixture) => _f = fixture;

    // --- List ---

    [Fact]
    public async Task GetProducts_ReturnsPaginatedList()
    {
        var client = await _f.AsAdmin();
        var response = await client.GetAsync("/api/products");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.GetProperty("count").GetInt32() >= 12); // seeded products
        Assert.True(json.GetProperty("data").GetArrayLength() > 0);
    }

    [Fact]
    public async Task GetProducts_FilterByCategory_ReturnsFiltered()
    {
        var client = await _f.AsAdmin();

        var allResponse = await client.GetAsync("/api/products");
        var allJson = await allResponse.Content.ReadFromJsonAsync<JsonElement>();

        var filteredResponse = await client.GetAsync("/api/products?categoryId=1");
        var filteredJson = await filteredResponse.Content.ReadFromJsonAsync<JsonElement>();

        Assert.True(filteredJson.GetProperty("count").GetInt32() < allJson.GetProperty("count").GetInt32());
        Assert.True(filteredJson.GetProperty("count").GetInt32() > 0);
    }

    [Fact]
    public async Task GetProducts_Pagination_Works()
    {
        var client = await _f.AsAdmin();
        var response = await client.GetAsync("/api/products?pageIndex=0&pageSize=2");

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(2, json.GetProperty("data").GetArrayLength());
        Assert.Equal(0, json.GetProperty("pageIndex").GetInt32());
        Assert.Equal(2, json.GetProperty("pageSize").GetInt32());
    }

    // --- Get by ID ---

    [Fact]
    public async Task GetProduct_ReturnsProductWithVariantsAndModifiers()
    {
        var client = await _f.AsAdmin();
        var response = await client.GetAsync("/api/products/1"); // Green Machine

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Green Machine", json.GetProperty("name").GetString());
        Assert.True(json.GetProperty("modifiers").GetArrayLength() > 0);
    }

    [Fact]
    public async Task GetProduct_NonExistent_Returns404()
    {
        var client = await _f.AsAdmin();
        var response = await client.GetAsync("/api/products/9999");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // --- Create ---

    [Fact]
    public async Task CreateProduct_AsAdmin_Returns201()
    {
        var client = await _f.AsAdmin();
        var response = await client.PostAsJsonAsync("/api/products", new
        {
            name = "Test Smoothie",
            description = "A test product",
            basePrice = 6.99,
            categoryId = 1,
            sortOrder = 99,
            isAvailable = true
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Test Smoothie", json.GetProperty("name").GetString());
        Assert.Equal(6.99m, json.GetProperty("basePrice").GetDecimal());
    }

    [Fact]
    public async Task CreateProduct_InvalidCategory_Returns400()
    {
        var client = await _f.AsAdmin();
        var response = await client.PostAsJsonAsync("/api/products", new
        {
            name = "Bad Product",
            basePrice = 1.00,
            categoryId = 9999,
            sortOrder = 0,
            isAvailable = true
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // --- Update ---

    [Fact]
    public async Task UpdateProduct_ChangesFields()
    {
        var client = await _f.AsAdmin();

        var createResponse = await client.PostAsJsonAsync("/api/products", new
        {
            name = "To Update",
            basePrice = 5.00,
            categoryId = 1,
            sortOrder = 0,
            isAvailable = true
        });
        var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var id = created.GetProperty("id").GetInt32();

        var updateResponse = await client.PutAsJsonAsync($"/api/products/{id}", new
        {
            name = "Updated Product",
            basePrice = 8.50,
            categoryId = 1,
            sortOrder = 1,
            isAvailable = false
        });

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var json = await updateResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Updated Product", json.GetProperty("name").GetString());
        Assert.Equal(8.50m, json.GetProperty("basePrice").GetDecimal());
        Assert.False(json.GetProperty("isAvailable").GetBoolean());
    }

    // --- Delete ---

    [Fact]
    public async Task DeleteProduct_Returns204()
    {
        var client = await _f.AsAdmin();

        var createResponse = await client.PostAsJsonAsync("/api/products", new
        {
            name = "To Delete",
            basePrice = 1.00,
            categoryId = 1,
            sortOrder = 0,
            isAvailable = true
        });
        var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var id = created.GetProperty("id").GetInt32();

        var deleteResponse = await client.DeleteAsync($"/api/products/{id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var getResponse = await client.GetAsync($"/api/products/{id}");
        Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);
    }

    // --- Variants ---

    [Fact]
    public async Task CreateVariant_ReturnsVariant()
    {
        var client = await _f.AsAdmin();

        var createResponse = await client.PostAsJsonAsync("/api/products", new
        {
            name = "Variant Test",
            basePrice = 5.00,
            categoryId = 1,
            sortOrder = 0,
            isAvailable = true
        });
        var product = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var productId = product.GetProperty("id").GetInt32();

        var variantResponse = await client.PostAsJsonAsync($"/api/products/{productId}/variants", new
        {
            name = "Large",
            priceOverride = 7.00,
            sortOrder = 0,
            isAvailable = true
        });

        Assert.Equal(HttpStatusCode.Created, variantResponse.StatusCode);
        var variant = await variantResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Large", variant.GetProperty("name").GetString());
        Assert.Equal(7.00m, variant.GetProperty("priceOverride").GetDecimal());
    }

    [Fact]
    public async Task UpdateVariant_ChangesFields()
    {
        var client = await _f.AsAdmin();

        // Create product + variant
        var createResponse = await client.PostAsJsonAsync("/api/products", new
        {
            name = "Variant Update Test",
            basePrice = 5.00,
            categoryId = 1,
            sortOrder = 0,
            isAvailable = true
        });
        var product = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var productId = product.GetProperty("id").GetInt32();

        var variantResponse = await client.PostAsJsonAsync($"/api/products/{productId}/variants", new
        {
            name = "Small",
            priceOverride = 4.00,
            sortOrder = 0,
            isAvailable = true
        });
        var variant = await variantResponse.Content.ReadFromJsonAsync<JsonElement>();
        var variantId = variant.GetProperty("id").GetInt32();

        var updateResponse = await client.PutAsJsonAsync($"/api/products/{productId}/variants/{variantId}", new
        {
            name = "Medium",
            priceOverride = 6.00,
            sortOrder = 1,
            isAvailable = false
        });

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await updateResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Medium", updated.GetProperty("name").GetString());
    }

    [Fact]
    public async Task DeleteVariant_Returns204()
    {
        var client = await _f.AsAdmin();

        var createResponse = await client.PostAsJsonAsync("/api/products", new
        {
            name = "Variant Delete Test",
            basePrice = 5.00,
            categoryId = 1,
            sortOrder = 0,
            isAvailable = true
        });
        var product = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var productId = product.GetProperty("id").GetInt32();

        var variantResponse = await client.PostAsJsonAsync($"/api/products/{productId}/variants", new
        {
            name = "ToDelete",
            priceOverride = 4.00,
            sortOrder = 0,
            isAvailable = true
        });
        var variant = await variantResponse.Content.ReadFromJsonAsync<JsonElement>();
        var variantId = variant.GetProperty("id").GetInt32();

        var deleteResponse = await client.DeleteAsync($"/api/products/{productId}/variants/{variantId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
    }

    // --- Modifier assignment ---

    [Fact]
    public async Task AssignModifier_ThenRemove()
    {
        var client = await _f.AsAdmin();

        // Create a product without modifiers
        var createResponse = await client.PostAsJsonAsync("/api/products", new
        {
            name = "Modifier Assign Test",
            basePrice = 5.00,
            categoryId = 1,
            sortOrder = 0,
            isAvailable = true
        });
        var product = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var productId = product.GetProperty("id").GetInt32();

        // Assign modifier 1 (Size from seed)
        var assignResponse = await client.PostAsync($"/api/products/{productId}/modifiers/1", null);
        Assert.Equal(HttpStatusCode.NoContent, assignResponse.StatusCode);

        // Verify product now has the modifier
        var getResponse = await client.GetAsync($"/api/products/{productId}");
        var getJson = await getResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(getJson.GetProperty("modifiers").GetArrayLength() > 0);

        // Remove
        var removeResponse = await client.DeleteAsync($"/api/products/{productId}/modifiers/1");
        Assert.Equal(HttpStatusCode.NoContent, removeResponse.StatusCode);
    }

    [Fact]
    public async Task AssignModifier_Duplicate_Returns400()
    {
        var client = await _f.AsAdmin();
        // Product 1 (Green Machine) already has modifier 1 (Size) from seed
        var response = await client.PostAsync("/api/products/1/modifiers/1", null);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
