using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace BrewBar.Tests.Integration;

public class ReportsApiTests : IClassFixture<TestFixture>
{
    private readonly TestFixture _f;

    public ReportsApiTests(TestFixture fixture) => _f = fixture;

    private async Task CreateCompletedOrder(
        HttpClient client,
        int productId,
        string productName,
        decimal unitPrice,
        int quantity,
        int paymentMethod = 0)
    {
        var orderResponse = await client.PostAsJsonAsync("/api/orders", new
        {
            taxRate = 0.15,
            lineItems = new[]
            {
                new { productId, productName, unitPrice, quantity, modifierItems = Array.Empty<object>() }
            }
        });
        var orderJson = await orderResponse.Content.ReadFromJsonAsync<JsonElement>();
        var orderId = orderJson.GetProperty("id").GetInt32();
        var total = orderJson.GetProperty("total").GetDecimal();

        await client.PostAsJsonAsync("/api/payments", new
        {
            orderId,
            method = paymentMethod,
            amountTendered = total,
            total
        });
    }

    // --- Daily Report ---

    [Fact]
    public async Task GetDailyReport_Unauthenticated_Returns401()
    {
        var response = await _f.Client.GetAsync("/api/reports/daily");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetDailyReport_ReturnsStructuredData()
    {
        var client = await _f.AsAdmin();
        var response = await client.GetAsync("/api/reports/daily");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.TryGetProperty("orderCount", out _));
        Assert.True(json.TryGetProperty("grossSales", out _));
        Assert.True(json.TryGetProperty("netSales", out _));
        Assert.True(json.TryGetProperty("taxCollected", out _));
        Assert.True(json.TryGetProperty("averageOrderValue", out _));
        Assert.True(json.TryGetProperty("hourlySales", out var hourly));
        Assert.Equal(JsonValueKind.Array, hourly.ValueKind);
    }

    [Fact]
    public async Task GetDailyReport_WithCompletedOrders_ReportsTotals()
    {
        var client = await _f.AsAdmin();
        await CreateCompletedOrder(client, 1, "Daily Test Smoothie", 10.00m, 2);

        var response = await client.GetAsync("/api/reports/daily");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.GetProperty("orderCount").GetInt32() >= 1);
        Assert.True(json.GetProperty("grossSales").GetDecimal() >= 20.00m);
        Assert.True(json.GetProperty("itemsSold").GetInt32() >= 2);
    }

    [Fact]
    public async Task GetDailyReport_FutureDate_ReturnsZeros()
    {
        var client = await _f.AsAdmin();
        var future = DateTime.UtcNow.AddYears(1).ToString("yyyy-MM-dd");
        var response = await client.GetAsync($"/api/reports/daily?date={future}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0, json.GetProperty("orderCount").GetInt32());
        Assert.Equal(0m, json.GetProperty("grossSales").GetDecimal());
    }

    // --- Sales Range ---

    [Fact]
    public async Task GetSalesRange_ReturnsStructuredData()
    {
        var client = await _f.AsAdmin();
        var response = await client.GetAsync("/api/reports/sales");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.TryGetProperty("totalOrders", out _));
        Assert.True(json.TryGetProperty("grossSales", out _));
        Assert.True(json.TryGetProperty("dailyBreakdown", out var breakdown));
        Assert.Equal(JsonValueKind.Array, breakdown.ValueKind);
    }

    // --- Product Performance ---

    [Fact]
    public async Task GetProductPerformance_Unauthenticated_Returns401()
    {
        var response = await _f.Client.GetAsync("/api/reports/products");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetProductPerformance_WithSales_RanksByRevenue()
    {
        var client = await _f.AsAdmin();
        // Two different products, one with more revenue than the other
        await CreateCompletedOrder(client, 1, "Perf Test A", 20.00m, 1);
        await CreateCompletedOrder(client, 1, "Perf Test A", 20.00m, 1);
        await CreateCompletedOrder(client, 2, "Perf Test B", 5.00m, 1);

        var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
        var response = await client.GetAsync($"/api/reports/products?from={today}&to={today}&limit=10");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Array, json.ValueKind);
        Assert.True(json.GetArrayLength() >= 1);

        // First entry should have the highest revenue
        var first = json[0];
        Assert.True(first.TryGetProperty("productName", out _));
        Assert.True(first.TryGetProperty("unitsSold", out _));
        Assert.True(first.TryGetProperty("revenue", out _));
    }

    [Fact]
    public async Task GetProductPerformance_RespectsLimit()
    {
        var client = await _f.AsAdmin();
        var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
        var response = await client.GetAsync($"/api/reports/products?from={today}&to={today}&limit=1");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.GetArrayLength() <= 1);
    }

    // --- Payment Summary ---

    [Fact]
    public async Task GetPaymentSummary_Unauthenticated_Returns401()
    {
        var response = await _f.Client.GetAsync("/api/reports/payments");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetPaymentSummary_SeparatesCashAndCard()
    {
        var client = await _f.AsAdmin();
        await CreateCompletedOrder(client, 1, "Cash Item", 10.00m, 1, paymentMethod: 0); // Cash
        await CreateCompletedOrder(client, 1, "Card Item", 15.00m, 1, paymentMethod: 1); // Card

        var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
        var response = await client.GetAsync($"/api/reports/payments?from={today}&to={today}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.GetProperty("cashTotal").GetDecimal() >= 10.00m);
        Assert.True(json.GetProperty("cardTotal").GetDecimal() >= 15.00m);
        Assert.True(json.GetProperty("cashCount").GetInt32() >= 1);
        Assert.True(json.GetProperty("cardCount").GetInt32() >= 1);
    }
}
