using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace BrewBar.Tests.Integration;

public class PaymentsApiTests : IClassFixture<TestFixture>
{
    private readonly TestFixture _f;

    public PaymentsApiTests(TestFixture fixture) => _f = fixture;

    private async Task<(int orderId, decimal total)> CreateTestOrder(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/orders", new
        {
            taxRate = 0.08,
            lineItems = new[]
            {
                new { productId = 1, productName = "Water", unitPrice = 5.00, quantity = 1, modifierItems = Array.Empty<object>() }
            }
        });
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        return (json.GetProperty("id").GetInt32(), json.GetProperty("total").GetDecimal());
    }

    // --- Create Payment ---

    [Fact]
    public async Task CreatePayment_Cash_CalculatesChange()
    {
        var client = await _f.AsAdmin();
        var (orderId, total) = await CreateTestOrder(client);

        var response = await client.PostAsJsonAsync("/api/payments", new
        {
            orderId,
            method = 0, // Cash
            amountTendered = 10.00,
            total
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.GetProperty("changeGiven").GetDecimal() > 0);
        Assert.Equal("Cash", json.GetProperty("method").GetString());
    }

    [Fact]
    public async Task CreatePayment_Card_ZeroChange()
    {
        var client = await _f.AsAdmin();
        var (orderId, total) = await CreateTestOrder(client);

        var response = await client.PostAsJsonAsync("/api/payments", new
        {
            orderId,
            method = 1, // Card
            amountTendered = total,
            total
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0m, json.GetProperty("changeGiven").GetDecimal());
    }

    [Fact]
    public async Task CreatePayment_CompletesOrder()
    {
        var client = await _f.AsAdmin();
        var (orderId, total) = await CreateTestOrder(client);

        await client.PostAsJsonAsync("/api/payments", new
        {
            orderId,
            method = 0,
            amountTendered = 20.00,
            total
        });

        var orderResponse = await client.GetAsync($"/api/orders/{orderId}");
        var orderJson = await orderResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Completed", orderJson.GetProperty("status").GetString());
    }

    [Fact]
    public async Task CreatePayment_VoidedOrder_Returns400()
    {
        var client = await _f.AsAdmin();
        var (orderId, total) = await CreateTestOrder(client);

        await client.PostAsJsonAsync($"/api/orders/{orderId}/void", new { reason = "test" });

        var response = await client.PostAsJsonAsync("/api/payments", new
        {
            orderId,
            method = 0,
            amountTendered = 10.00,
            total
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreatePayment_CompletedOrder_Returns400()
    {
        var client = await _f.AsAdmin();
        var (orderId, total) = await CreateTestOrder(client);

        // Pay to complete
        await client.PostAsJsonAsync("/api/payments", new { orderId, method = 0, amountTendered = 20.00, total });

        // Try to pay again
        var response = await client.PostAsJsonAsync("/api/payments", new
        {
            orderId,
            method = 0,
            amountTendered = 5.00,
            total = 1.00
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreatePayment_NonExistentOrder_Returns404()
    {
        var client = await _f.AsAdmin();
        var response = await client.PostAsJsonAsync("/api/payments", new
        {
            orderId = 99999,
            method = 0,
            amountTendered = 5.00,
            total = 5.00
        });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // --- Get Payment ---

    [Fact]
    public async Task GetPayment_ReturnsPayment()
    {
        var client = await _f.AsAdmin();
        var (orderId, total) = await CreateTestOrder(client);

        var createResponse = await client.PostAsJsonAsync("/api/payments", new
        {
            orderId,
            method = 0,
            amountTendered = 10.00,
            total
        });
        var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var paymentId = created.GetProperty("id").GetInt32();

        var getResponse = await client.GetAsync($"/api/payments/{paymentId}");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
        var json = await getResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(orderId, json.GetProperty("orderId").GetInt32());
    }

    [Fact]
    public async Task GetPayment_NonExistent_Returns404()
    {
        var client = await _f.AsAdmin();
        var response = await client.GetAsync("/api/payments/99999");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // --- Get by Order ---

    [Fact]
    public async Task GetPaymentsByOrder_ReturnsPaymentsForOrder()
    {
        var client = await _f.AsAdmin();
        var (orderId, total) = await CreateTestOrder(client);

        await client.PostAsJsonAsync("/api/payments", new { orderId, method = 0, amountTendered = 10.00, total });

        var response = await client.GetAsync($"/api/payments/by-order/{orderId}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.GetArrayLength() >= 1);
    }

    [Fact]
    public async Task GetPaymentsByOrder_NoPayments_ReturnsEmptyArray()
    {
        var client = await _f.AsAdmin();
        var (orderId, _) = await CreateTestOrder(client);

        var response = await client.GetAsync($"/api/payments/by-order/{orderId}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0, json.GetArrayLength());
    }
}
