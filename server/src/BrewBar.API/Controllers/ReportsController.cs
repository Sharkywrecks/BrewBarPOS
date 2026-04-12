using BrewBar.API.Dtos.Reports;
using BrewBar.Core.Entities.OrderAggregate;
using BrewBar.Core.Entities.PaymentAggregate;
using BrewBar.Core.Enums;
using BrewBar.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BrewBar.API.Controllers;

[Authorize]
public class ReportsController : BaseApiController
{
    private readonly IUnitOfWork _unitOfWork;

    public ReportsController(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    // Resolves a [from, to) UTC instant window. `from` is inclusive, `to` is exclusive.
    // Callers should pass instants representing the user's local-day boundaries so that
    // a "day" lines up with the operator's wall clock, not UTC midnight.
    private static (DateTime from, DateTime to) ResolveRange(DateTime? from, DateTime? to)
    {
        var todayUtc = DateTime.UtcNow.Date;
        var fromInstant = from ?? todayUtc;
        var toInstant = to ?? fromInstant.AddDays(1);
        return (fromInstant, toInstant);
    }

    /// <summary>Aggregated sales report for a UTC instant range [from, to).</summary>
    [HttpGet("daily")]
    public async Task<ActionResult<DailySalesReportDto>> GetDailyReport(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken ct = default)
    {
        var (fromInstant, toInstant) = ResolveRange(from, to);

        var orders = await _unitOfWork.GetQueryable<Order>()
            .Include(o => o.LineItems)
            .Where(o => o.CreatedAtUtc >= fromInstant && o.CreatedAtUtc < toInstant)
            .ToListAsync(ct);

        var completedOrders = orders.Where(o => o.Status == OrderStatus.Completed).ToList();
        var voidedOrders = orders.Where(o => o.Status == OrderStatus.Voided).ToList();

        var orderIds = completedOrders.Select(o => o.Id).ToList();
        var payments = await _unitOfWork.GetQueryable<Payment>()
            .Where(p => orderIds.Contains(p.OrderId) && p.Status == PaymentStatus.Completed)
            .ToListAsync(ct);

        var grossSales = completedOrders.Sum(o => o.Total);
        var taxCollected = completedOrders.Sum(o => o.TaxAmount);
        var itemsSold = completedOrders.Sum(o => o.LineItems.Sum(li => li.Quantity));

        var hourlySales = completedOrders
            .GroupBy(o => o.CreatedAtUtc.Hour)
            .Select(g => new HourlySalesDto
            {
                Hour = g.Key,
                OrderCount = g.Count(),
                Total = g.Sum(o => o.Total)
            })
            .OrderBy(h => h.Hour)
            .ToList();

        return Ok(new DailySalesReportDto
        {
            From = fromInstant,
            To = toInstant,
            OrderCount = completedOrders.Count,
            VoidedCount = voidedOrders.Count,
            ItemsSold = itemsSold,
            GrossSales = grossSales,
            TaxCollected = taxCollected,
            NetSales = grossSales - taxCollected,
            CashTotal = payments.Where(p => p.Method == PaymentMethod.Cash).Sum(p => p.Total),
            CardTotal = payments.Where(p => p.Method == PaymentMethod.Card).Sum(p => p.Total),
            AverageOrderValue = completedOrders.Count > 0 ? grossSales / completedOrders.Count : 0,
            HourlySales = hourlySales
        });
    }

    /// <summary>Sales trend over a UTC instant range [from, to), bucketed by UTC day.</summary>
    [HttpGet("sales")]
    public async Task<ActionResult<SalesRangeReportDto>> GetSalesRange(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken ct = default)
    {
        var (fromInstant, toInstant) = ResolveRange(from, to);

        var orders = await _unitOfWork.GetQueryable<Order>()
            .Where(o => o.CreatedAtUtc >= fromInstant && o.CreatedAtUtc < toInstant
                     && o.Status == OrderStatus.Completed)
            .ToListAsync(ct);

        var daily = orders
            .GroupBy(o => o.CreatedAtUtc.Date)
            .Select(g => new DailySalesPointDto
            {
                Date = g.Key,
                OrderCount = g.Count(),
                Total = g.Sum(o => o.Total)
            })
            .OrderBy(d => d.Date)
            .ToList();

        return Ok(new SalesRangeReportDto
        {
            From = fromInstant,
            To = toInstant,
            TotalOrders = orders.Count,
            GrossSales = orders.Sum(o => o.Total),
            TaxCollected = orders.Sum(o => o.TaxAmount),
            NetSales = orders.Sum(o => o.Total) - orders.Sum(o => o.TaxAmount),
            DailyBreakdown = daily
        });
    }

    /// <summary>Top-selling products over a UTC instant range [from, to).</summary>
    [HttpGet("products")]
    public async Task<ActionResult<IReadOnlyList<ProductPerformanceDto>>> GetProductPerformance(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int limit = 20,
        CancellationToken ct = default)
    {
        var (fromInstant, toInstant) = ResolveRange(from, to);

        var lineItems = await _unitOfWork.GetQueryable<Order>()
            .Where(o => o.CreatedAtUtc >= fromInstant && o.CreatedAtUtc < toInstant
                     && o.Status == OrderStatus.Completed)
            .SelectMany(o => o.LineItems)
            .ToListAsync(ct);

        var productIds = lineItems.Select(li => li.ProductId).Distinct().ToList();
        var products = await _unitOfWork.GetQueryable<Core.Entities.CatalogAggregate.Product>()
            .Include(p => p.Category)
            .Where(p => productIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, ct);

        var performance = lineItems
            .GroupBy(li => li.ProductId)
            .Select(g =>
            {
                products.TryGetValue(g.Key, out var product);
                return new ProductPerformanceDto
                {
                    ProductId = g.Key,
                    ProductName = g.First().ProductName,
                    CategoryName = product?.Category?.Name ?? "Unknown",
                    UnitsSold = g.Sum(li => li.Quantity),
                    Revenue = g.Sum(li => li.LineTotal)
                };
            })
            .OrderByDescending(p => p.Revenue)
            .Take(limit)
            .ToList();

        return Ok(performance);
    }

    /// <summary>Payment method breakdown over a UTC instant range [from, to).</summary>
    [HttpGet("payments")]
    public async Task<ActionResult<PaymentSummaryReportDto>> GetPaymentSummary(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken ct = default)
    {
        var (fromInstant, toInstant) = ResolveRange(from, to);

        var payments = await _unitOfWork.GetQueryable<Payment>()
            .Where(p => p.CreatedAtUtc >= fromInstant && p.CreatedAtUtc < toInstant)
            .ToListAsync(ct);

        var completed = payments.Where(p => p.Status == PaymentStatus.Completed).ToList();
        var refunded = payments.Where(p => p.Status == PaymentStatus.Refunded).ToList();

        return Ok(new PaymentSummaryReportDto
        {
            From = fromInstant,
            To = toInstant,
            CashTotal = completed.Where(p => p.Method == PaymentMethod.Cash).Sum(p => p.Total),
            CashCount = completed.Count(p => p.Method == PaymentMethod.Cash),
            CardTotal = completed.Where(p => p.Method == PaymentMethod.Card).Sum(p => p.Total),
            CardCount = completed.Count(p => p.Method == PaymentMethod.Card),
            RefundTotal = refunded.Sum(p => p.Total),
            RefundCount = refunded.Count
        });
    }
}
