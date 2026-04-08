using System.Security.Claims;
using BrewBar.API.Dtos.Orders;
using BrewBar.API.Errors;
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
public class PaymentsController : BaseApiController
{
    private readonly IUnitOfWork _unitOfWork;

    public PaymentsController(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    [HttpPost]
    public async Task<ActionResult<PaymentDto>> CreatePayment(CreatePaymentDto dto, CancellationToken ct)
    {
        var order = await _unitOfWork.Repository<Order>().GetByIdAsync(dto.OrderId, ct);
        if (order == null) return NotFound(new ApiResponse(404, "Order not found"));
        if (order.Status == OrderStatus.Voided) return BadRequest(new ApiResponse(400, "Cannot pay for a voided order"));
        if (order.Status == OrderStatus.Completed) return BadRequest(new ApiResponse(400, "Order is already completed"));

        var changeGiven = dto.Method == PaymentMethod.Cash
            ? Math.Max(dto.AmountTendered - dto.Total - dto.TipAmount, 0)
            : 0m;

        var payment = new Payment
        {
            OrderId = dto.OrderId,
            Method = dto.Method,
            Status = PaymentStatus.Completed,
            AmountTendered = dto.AmountTendered,
            ChangeGiven = changeGiven,
            Total = dto.Total,
            TipAmount = dto.TipAmount
        };

        _unitOfWork.Repository<Payment>().Add(payment);

        // Check if total payments cover the order
        var existingPayments = await _unitOfWork.GetQueryable<Payment>()
            .Where(p => p.OrderId == dto.OrderId && p.Status == PaymentStatus.Completed)
            .SumAsync(p => p.Total, ct);

        if (existingPayments + dto.Total >= order.Total)
        {
            order.Status = OrderStatus.Completed;
        }

        await _unitOfWork.Complete(ct);

        return CreatedAtAction(nameof(GetPayment), new { id = payment.Id }, new PaymentDto
        {
            Id = payment.Id,
            OrderId = payment.OrderId,
            Method = payment.Method,
            Status = payment.Status,
            AmountTendered = payment.AmountTendered,
            ChangeGiven = payment.ChangeGiven,
            Total = payment.Total,
            TipAmount = payment.TipAmount,
            CreatedAtUtc = payment.CreatedAtUtc
        });
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<PaymentDto>> GetPayment(int id, CancellationToken ct)
    {
        var payment = await _unitOfWork.Repository<Payment>().GetByIdAsync(id, ct);
        if (payment == null) return NotFound(new ApiResponse(404));

        return Ok(new PaymentDto
        {
            Id = payment.Id,
            OrderId = payment.OrderId,
            Method = payment.Method,
            Status = payment.Status,
            AmountTendered = payment.AmountTendered,
            ChangeGiven = payment.ChangeGiven,
            Total = payment.Total,
            TipAmount = payment.TipAmount,
            CreatedAtUtc = payment.CreatedAtUtc
        });
    }

    [HttpGet("by-order/{orderId}")]
    public async Task<ActionResult<IReadOnlyList<PaymentDto>>> GetPaymentsByOrder(int orderId, CancellationToken ct)
    {
        var payments = await _unitOfWork.GetQueryable<Payment>()
            .Where(p => p.OrderId == orderId)
            .OrderBy(p => p.CreatedAtUtc)
            .ToListAsync(ct);

        return Ok(payments.Select(p => new PaymentDto
        {
            Id = p.Id,
            OrderId = p.OrderId,
            Method = p.Method,
            Status = p.Status,
            AmountTendered = p.AmountTendered,
            ChangeGiven = p.ChangeGiven,
            Total = p.Total,
            TipAmount = p.TipAmount,
            CreatedAtUtc = p.CreatedAtUtc
        }).ToList());
    }

    [HttpPost("refund")]
    [Authorize(Roles = Roles.AdminOrManager)]
    public async Task<ActionResult<RefundDto>> CreateRefund(CreateRefundDto dto, CancellationToken ct)
    {
        var payment = await _unitOfWork.Repository<Payment>().GetByIdAsync(dto.OriginalPaymentId, ct);
        if (payment == null) return NotFound(new ApiResponse(404, "Payment not found"));
        if (payment.Status == PaymentStatus.Refunded)
            return BadRequest(new ApiResponse(400, "Payment is already fully refunded"));
        if (payment.Status != PaymentStatus.Completed)
            return BadRequest(new ApiResponse(400, "Only completed payments can be refunded"));

        var order = await _unitOfWork.GetQueryable<Order>()
            .Include(o => o.LineItems)
            .FirstOrDefaultAsync(o => o.Id == dto.OrderId, ct);
        if (order == null) return NotFound(new ApiResponse(404, "Order not found"));

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;
        var userName = User.FindFirstValue(ClaimTypes.Name);

        decimal refundAmount;
        var refundLineItems = new List<RefundLineItem>();

        if (dto.IsFullRefund)
        {
            refundAmount = payment.Total;
        }
        else
        {
            // Calculate partial refund from specified line items
            refundAmount = 0;
            foreach (var rli in dto.LineItems ?? [])
            {
                var orderLine = order.LineItems.FirstOrDefault(li => li.Id == rli.OrderLineItemId);
                if (orderLine == null) continue;

                var perItemAmount = orderLine.LineTotal / orderLine.Quantity;
                var lineRefund = Math.Round(perItemAmount * rli.Quantity, 2);
                refundAmount += lineRefund;

                refundLineItems.Add(new RefundLineItem
                {
                    OrderLineItemId = rli.OrderLineItemId,
                    Quantity = rli.Quantity,
                    Amount = lineRefund
                });
            }
        }

        var refund = new Refund
        {
            OrderId = dto.OrderId,
            OriginalPaymentId = dto.OriginalPaymentId,
            Amount = refundAmount,
            Reason = dto.Reason,
            PerformedByUserId = userId,
            PerformedByUserName = userName,
            IsFullRefund = dto.IsFullRefund,
            LineItems = refundLineItems
        };

        _unitOfWork.Repository<Refund>().Add(refund);

        if (dto.IsFullRefund)
        {
            payment.Status = PaymentStatus.Refunded;
            order.Status = OrderStatus.Refunded;
        }

        await _unitOfWork.Complete(ct);

        return Ok(new RefundDto
        {
            Id = refund.Id,
            OrderId = refund.OrderId,
            OriginalPaymentId = refund.OriginalPaymentId,
            Amount = refund.Amount,
            Reason = refund.Reason,
            PerformedByUserName = refund.PerformedByUserName,
            IsFullRefund = refund.IsFullRefund,
            CreatedAtUtc = refund.CreatedAtUtc,
            LineItems = refund.LineItems.Select(li => new RefundLineItemDto
            {
                OrderLineItemId = li.OrderLineItemId,
                Quantity = li.Quantity,
                Amount = li.Amount
            }).ToList()
        });
    }

    [HttpGet("refunds/by-order/{orderId}")]
    public async Task<ActionResult<IReadOnlyList<RefundDto>>> GetRefundsByOrder(int orderId, CancellationToken ct)
    {
        var refunds = await _unitOfWork.GetQueryable<Refund>()
            .Include(r => r.LineItems)
            .Where(r => r.OrderId == orderId)
            .OrderByDescending(r => r.CreatedAtUtc)
            .ToListAsync(ct);

        return Ok(refunds.Select(r => new RefundDto
        {
            Id = r.Id,
            OrderId = r.OrderId,
            OriginalPaymentId = r.OriginalPaymentId,
            Amount = r.Amount,
            Reason = r.Reason,
            PerformedByUserName = r.PerformedByUserName,
            IsFullRefund = r.IsFullRefund,
            CreatedAtUtc = r.CreatedAtUtc,
            LineItems = r.LineItems.Select(li => new RefundLineItemDto
            {
                OrderLineItemId = li.OrderLineItemId,
                Quantity = li.Quantity,
                Amount = li.Amount
            }).ToList()
        }).ToList());
    }
}
