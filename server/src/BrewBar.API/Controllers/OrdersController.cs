using System.Security.Claims;
using BrewBar.API.Dtos.Orders;
using BrewBar.API.Errors;
using BrewBar.API.Helpers;
using BrewBar.Core.Entities.OrderAggregate;
using BrewBar.Core.Entities.PaymentAggregate;
using BrewBar.Core.Enums;
using BrewBar.Core.Interfaces;
using BrewBar.Core.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BrewBar.API.Controllers;

[Authorize]
public class OrdersController : BaseApiController
{
    private readonly IUnitOfWork _unitOfWork;

    public OrdersController(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    [HttpGet]
    public async Task<ActionResult<Pagination<OrderDto>>> GetOrders(
        [FromQuery] OrderStatus? status,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int pageIndex = 0,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var query = _unitOfWork.GetQueryable<Order>()
            .Include(o => o.LineItems).ThenInclude(li => li.ModifierItems)
            .AsQueryable();

        if (status.HasValue) query = query.Where(o => o.Status == status.Value);
        if (from.HasValue) query = query.Where(o => o.CreatedAtUtc >= from.Value);
        if (to.HasValue) query = query.Where(o => o.CreatedAtUtc <= to.Value);

        var count = await query.CountAsync(ct);
        var orders = await query
            .OrderByDescending(o => o.CreatedAtUtc)
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        // Load payments for these orders
        var orderIds = orders.Select(o => o.Id).ToList();
        var payments = await _unitOfWork.GetQueryable<Payment>()
            .Where(p => orderIds.Contains(p.OrderId))
            .ToListAsync(ct);

        var paymentsByOrder = payments.GroupBy(p => p.OrderId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var data = orders.Select(o => MapOrder(o, paymentsByOrder.GetValueOrDefault(o.Id))).ToList();
        return Ok(new Pagination<OrderDto>(pageIndex, pageSize, count, data));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<OrderDto>> GetOrder(int id, CancellationToken ct)
    {
        var order = await _unitOfWork.GetQueryable<Order>()
            .Include(o => o.LineItems).ThenInclude(li => li.ModifierItems)
            .FirstOrDefaultAsync(o => o.Id == id, ct);

        if (order == null) return NotFound(new ApiResponse(404));

        var payments = await _unitOfWork.GetQueryable<Payment>()
            .Where(p => p.OrderId == id)
            .ToListAsync(ct);

        return Ok(MapOrder(order, payments));
    }

    [HttpGet("by-local-id/{localId}")]
    public async Task<ActionResult<OrderDto>> GetOrderByLocalId(Guid localId, CancellationToken ct)
    {
        var order = await _unitOfWork.GetQueryable<Order>()
            .Include(o => o.LineItems).ThenInclude(li => li.ModifierItems)
            .FirstOrDefaultAsync(o => o.LocalId == localId, ct);

        if (order == null) return NotFound(new ApiResponse(404));

        var payments = await _unitOfWork.GetQueryable<Payment>()
            .Where(p => p.OrderId == order.Id)
            .ToListAsync(ct);

        return Ok(MapOrder(order, payments));
    }

    [HttpPost]
    public async Task<ActionResult<OrderDto>> CreateOrder(CreateOrderDto dto, CancellationToken ct)
    {
        var localId = dto.LocalId ?? Guid.NewGuid();

        // Idempotency check — if an order with this LocalId already exists, return it
        var existing = await _unitOfWork.GetQueryable<Order>()
            .FirstOrDefaultAsync(o => o.LocalId == localId, ct);

        if (existing != null)
            return await GetOrder(existing.Id, ct);

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;
        var userName = User.FindFirstValue(ClaimTypes.Name);

        // Generate display order number (daily sequential)
        var today = DateTime.UtcNow.Date;
        var todayCount = await _unitOfWork.GetQueryable<Order>()
            .CountAsync(o => o.CreatedAtUtc >= today, ct);
        var displayNumber = $"{today:yyyyMMdd}-{todayCount + 1:D3}";

        var lineItems = dto.LineItems.Select(li =>
        {
            var modifierTotal = li.ModifierItems.Sum(m => m.Price);
            var lineTotal = (li.UnitPrice + modifierTotal) * li.Quantity;

            return new OrderLineItem
            {
                ProductId = li.ProductId,
                ProductName = li.ProductName,
                VariantName = li.VariantName,
                UnitPrice = li.UnitPrice,
                Quantity = li.Quantity,
                LineTotal = lineTotal,
                ModifierItems = li.ModifierItems.Select(mi => new OrderModifierItem
                {
                    ModifierName = mi.ModifierName,
                    OptionName = mi.OptionName,
                    Price = mi.Price
                }).ToList()
            };
        }).ToList();

        var subtotal = lineItems.Sum(li => li.LineTotal);
        var taxAmount = Math.Round(subtotal * dto.TaxRate, 2);
        var total = subtotal + taxAmount;

        var order = new Order
        {
            LocalId = localId,
            DisplayOrderNumber = displayNumber,
            Status = OrderStatus.Open,
            Subtotal = subtotal,
            TaxAmount = taxAmount,
            TaxRate = dto.TaxRate,
            Total = total,
            Notes = dto.Notes,
            CashierId = userId,
            CashierName = userName,
            TerminalId = dto.TerminalId,
            LineItems = lineItems
        };

        _unitOfWork.Repository<Order>().Add(order);
        await _unitOfWork.Complete(ct);

        return CreatedAtAction(nameof(GetOrder), new { id = order.Id }, MapOrder(order, null));
    }

    [HttpPost("{id}/void")]
    [Authorize(Roles = Roles.AdminOrManager)]
    public async Task<ActionResult<OrderDto>> VoidOrder(int id, CancellationToken ct)
    {
        var order = await _unitOfWork.GetQueryable<Order>()
            .Include(o => o.LineItems).ThenInclude(li => li.ModifierItems)
            .FirstOrDefaultAsync(o => o.Id == id, ct);

        if (order == null) return NotFound(new ApiResponse(404));
        if (order.Status == OrderStatus.Voided) return BadRequest(new ApiResponse(400, "Order is already voided"));

        order.Status = OrderStatus.Voided;
        await _unitOfWork.Complete(ct);

        return Ok(MapOrder(order, null));
    }

    private static OrderDto MapOrder(Order o, List<Payment>? payments) => new()
    {
        Id = o.Id,
        LocalId = o.LocalId,
        DisplayOrderNumber = o.DisplayOrderNumber,
        Status = o.Status,
        Subtotal = o.Subtotal,
        TaxAmount = o.TaxAmount,
        TaxRate = o.TaxRate,
        Total = o.Total,
        Notes = o.Notes,
        CashierId = o.CashierId,
        CashierName = o.CashierName,
        TerminalId = o.TerminalId,
        CreatedAtUtc = o.CreatedAtUtc,
        LineItems = o.LineItems.Select(li => new OrderLineItemDto
        {
            Id = li.Id,
            ProductId = li.ProductId,
            ProductName = li.ProductName,
            VariantName = li.VariantName,
            UnitPrice = li.UnitPrice,
            Quantity = li.Quantity,
            LineTotal = li.LineTotal,
            ModifierItems = li.ModifierItems.Select(mi => new OrderModifierItemDto
            {
                ModifierName = mi.ModifierName,
                OptionName = mi.OptionName,
                Price = mi.Price
            }).ToList()
        }).ToList(),
        Payments = payments?.Select(p => new PaymentSummaryDto
        {
            Id = p.Id,
            Method = p.Method,
            Status = p.Status,
            AmountTendered = p.AmountTendered,
            ChangeGiven = p.ChangeGiven,
            Total = p.Total
        }).ToList() ?? new List<PaymentSummaryDto>()
    };
}
