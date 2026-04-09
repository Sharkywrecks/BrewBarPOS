using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace BrewBar.Tests.Integration;

public class OrdersApiTests : IClassFixture<TestFixture>
{
    private readonly TestFixture _f;

    public OrdersApiTests(TestFixture fixture) => _f = fixture;

    // --- List ---

    [Fact]
    public async Task GetOrders_ReturnsPagedList()
    {
        var client = await _f.AsAdmin();

        // Create an order so there's at least one
        await client.PostAsJsonAsync("/api/orders", new
        {
            taxRate = 0.08,
            lineItems = new[]
            {
                new { productId = 1, productName = "Water", unitPrice = 2.00, quantity = 1, modifierItems = Array.Empty<object>() }
            }
        });

        var response = await client.GetAsync("/api/orders");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.GetProperty("count").GetInt32() >= 1);
        Assert.True(json.GetProperty("data").GetArrayLength() >= 1);
    }

    [Fact]
    public async Task GetOrders_FilterByStatus()
    {
        var client = await _f.AsAdmin();
        var response = await client.GetAsync("/api/orders?status=0"); // Open
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetOrders_Unauthenticated_Returns401()
    {
        var response = await _f.Client.GetAsync("/api/orders");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // --- Get by ID ---

    [Fact]
    public async Task GetOrder_ReturnsOrderWithLineItemsAndPayments()
    {
        var client = await _f.AsAdmin();

        var createResponse = await client.PostAsJsonAsync("/api/orders", new
        {
            taxRate = 0.08,
            lineItems = new[]
            {
                new { productId = 1, productName = "Green Machine", unitPrice = 7.50, quantity = 1, modifierItems = Array.Empty<object>() }
            }
        });
        var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var orderId = created.GetProperty("id").GetInt32();

        var response = await client.GetAsync($"/api/orders/{orderId}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.GetProperty("lineItems").GetArrayLength() > 0);
        Assert.True(json.TryGetProperty("payments", out _));
    }

    [Fact]
    public async Task GetOrder_NonExistent_Returns404()
    {
        var client = await _f.AsAdmin();
        var response = await client.GetAsync("/api/orders/99999");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // --- Get by LocalId ---

    [Fact]
    public async Task GetOrderByLocalId_ReturnsOrder()
    {
        var client = await _f.AsAdmin();
        var localId = Guid.NewGuid();

        await client.PostAsJsonAsync("/api/orders", new
        {
            localId,
            taxRate = 0.08,
            lineItems = new[]
            {
                new { productId = 1, productName = "Water", unitPrice = 2.00, quantity = 1, modifierItems = Array.Empty<object>() }
            }
        });

        var response = await client.GetAsync($"/api/orders/by-local-id/{localId}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(localId.ToString(), json.GetProperty("localId").GetString());
    }

    [Fact]
    public async Task GetOrderByLocalId_NonExistent_Returns404()
    {
        var client = await _f.AsAdmin();
        var response = await client.GetAsync($"/api/orders/by-local-id/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // --- Create ---

    [Fact]
    public async Task CreateOrder_CalculatesTotalsCorrectly()
    {
        // Pricing is VAT-inclusive: unitPrice includes tax.
        // With taxRate=0.08, a 9.00 inclusive line splits into 8.33 ex-VAT + 0.67 tax.
        // A 4.00 inclusive line splits into 3.70 ex-VAT + 0.30 tax.
        // Totals: subtotal=12.03, tax=0.97, total=13.00.
        var client = await _f.AsAdmin();

        var response = await client.PostAsJsonAsync("/api/orders", new
        {
            taxRate = 0.08,
            lineItems = new object[]
            {
                new
                {
                    productId = 1,
                    productName = "Green Machine",
                    variantName = "24 oz",
                    unitPrice = 7.50,
                    quantity = 1,
                    taxRate = 0.08,
                    modifierItems = new[]
                    {
                        new { modifierName = "Boost", optionName = "Protein", price = 1.50 }
                    }
                },
                new
                {
                    productId = 3,
                    productName = "Water",
                    unitPrice = 2.00,
                    quantity = 2,
                    taxRate = 0.08,
                    modifierItems = Array.Empty<object>()
                }
            }
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(12.03m, json.GetProperty("subtotal").GetDecimal());
        Assert.Equal(0.97m, json.GetProperty("taxAmount").GetDecimal());
        Assert.Equal(13.00m, json.GetProperty("total").GetDecimal());
        Assert.Equal("Open", json.GetProperty("status").GetString());
    }

    [Fact]
    public async Task CreateOrder_SetsDisplayOrderNumber()
    {
        var client = await _f.AsAdmin();

        var response = await client.PostAsJsonAsync("/api/orders", new
        {
            taxRate = 0.00,
            lineItems = new[]
            {
                new { productId = 1, productName = "Water", unitPrice = 1.00, quantity = 1, modifierItems = Array.Empty<object>() }
            }
        });

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        var orderNumber = json.GetProperty("displayOrderNumber").GetString()!;
        Assert.Matches(@"\d{8}-\d{3}", orderNumber);
    }

    [Fact]
    public async Task CreateOrder_SetsCashierInfo()
    {
        var client = await _f.AsAdmin();

        var response = await client.PostAsJsonAsync("/api/orders", new
        {
            taxRate = 0.00,
            lineItems = new[]
            {
                new { productId = 1, productName = "Water", unitPrice = 1.00, quantity = 1, modifierItems = Array.Empty<object>() }
            }
        });

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(string.IsNullOrEmpty(json.GetProperty("cashierId").GetString()));
        Assert.Equal("Admin", json.GetProperty("cashierName").GetString());
    }

    [Fact]
    public async Task CreateOrder_Idempotent_SameLocalId()
    {
        var client = await _f.AsAdmin();
        var localId = Guid.NewGuid();

        var order = new
        {
            localId,
            taxRate = 0.08,
            lineItems = new[]
            {
                new { productId = 1, productName = "Water", unitPrice = 2.00, quantity = 1, modifierItems = Array.Empty<object>() }
            }
        };

        var response1 = await client.PostAsJsonAsync("/api/orders", order);
        var response2 = await client.PostAsJsonAsync("/api/orders", order);

        var json1 = await response1.Content.ReadFromJsonAsync<JsonElement>();
        var json2 = await response2.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(json1.GetProperty("id").GetInt32(), json2.GetProperty("id").GetInt32());
    }

    // --- Void ---

    [Fact]
    public async Task VoidOrder_SetsStatusToVoided()
    {
        var client = await _f.AsAdmin();

        var createResponse = await client.PostAsJsonAsync("/api/orders", new
        {
            taxRate = 0.08,
            lineItems = new[]
            {
                new { productId = 1, productName = "Water", unitPrice = 2.00, quantity = 1, taxRate = 0.08, modifierItems = Array.Empty<object>() }
            }
        });
        var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var orderId = created.GetProperty("id").GetInt32();

        var response = await client.PostAsJsonAsync($"/api/orders/{orderId}/void", new { reason = "test" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Voided", json.GetProperty("status").GetString());
    }

    [Fact]
    public async Task VoidOrder_AlreadyVoided_Returns400()
    {
        var client = await _f.AsAdmin();

        var createResponse = await client.PostAsJsonAsync("/api/orders", new
        {
            taxRate = 0.00,
            lineItems = new[]
            {
                new { productId = 1, productName = "Water", unitPrice = 1.00, quantity = 1, taxRate = 0.00, modifierItems = Array.Empty<object>() }
            }
        });
        var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var orderId = created.GetProperty("id").GetInt32();

        await client.PostAsJsonAsync($"/api/orders/{orderId}/void", new { reason = "test" });
        var response = await client.PostAsJsonAsync($"/api/orders/{orderId}/void", new { reason = "test" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task VoidOrder_AsCashier_Returns403()
    {
        var admin = await _f.AsAdmin();
        var cashier = await _f.AsCashier();

        var createResponse = await admin.PostAsJsonAsync("/api/orders", new
        {
            taxRate = 0.00,
            lineItems = new[]
            {
                new { productId = 1, productName = "Water", unitPrice = 1.00, quantity = 1, taxRate = 0.00, modifierItems = Array.Empty<object>() }
            }
        });
        var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var orderId = created.GetProperty("id").GetInt32();

        var response = await cashier.PostAsJsonAsync($"/api/orders/{orderId}/void", new { reason = "test" });
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task VoidOrder_NonExistent_Returns404()
    {
        var client = await _f.AsAdmin();
        var response = await client.PostAsJsonAsync("/api/orders/99999/void", new { reason = "test" });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
