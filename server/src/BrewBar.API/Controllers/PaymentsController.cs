using BrewBar.API.Dtos.Orders;
using BrewBar.API.Errors;
using BrewBar.Core.Entities.OrderAggregate;
using BrewBar.Core.Entities.PaymentAggregate;
using BrewBar.Core.Enums;
using BrewBar.Core.Interfaces;
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
            ? Math.Max(dto.AmountTendered - dto.Total, 0)
            : 0m;

        var payment = new Payment
        {
            OrderId = dto.OrderId,
            Method = dto.Method,
            Status = PaymentStatus.Completed,
            AmountTendered = dto.AmountTendered,
            ChangeGiven = changeGiven,
            Total = dto.Total
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
            CreatedAtUtc = p.CreatedAtUtc
        }).ToList());
    }
}
