using System.Security.Claims;
using BrewBar.API.Dtos.Shifts;
using BrewBar.API.Errors;
using BrewBar.Core.Entities.OrderAggregate;
using BrewBar.Core.Entities.PaymentAggregate;
using BrewBar.Core.Entities.ShiftAggregate;
using BrewBar.Core.Enums;
using BrewBar.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BrewBar.API.Controllers;

[Authorize]
public class ShiftsController : BaseApiController
{
    private readonly IUnitOfWork _unitOfWork;

    public ShiftsController(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    [HttpPost("open")]
    public async Task<ActionResult<RegisterShiftDto>> OpenShift(OpenShiftDto dto, CancellationToken ct)
    {
        // Check for existing open shift on this terminal
        var existing = await _unitOfWork.GetQueryable<RegisterShift>()
            .FirstOrDefaultAsync(s => s.TerminalId == dto.TerminalId && s.Status == ShiftStatus.Open, ct);

        if (existing != null)
            return BadRequest(new ApiResponse(400, "A shift is already open on this terminal"));

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;
        var userName = User.FindFirstValue(ClaimTypes.Name);

        var shift = new RegisterShift
        {
            TerminalId = dto.TerminalId,
            CashierId = userId,
            CashierName = userName,
            OpeningCashAmount = dto.OpeningCashAmount
        };

        _unitOfWork.Repository<RegisterShift>().Add(shift);
        await _unitOfWork.Complete(ct);

        return CreatedAtAction(nameof(GetShift), new { id = shift.Id }, MapShift(shift));
    }

    [HttpPost("{id}/close")]
    public async Task<ActionResult<RegisterShiftDto>> CloseShift(int id, CloseShiftDto dto, CancellationToken ct)
    {
        var shift = await _unitOfWork.GetQueryable<RegisterShift>()
            .Include(s => s.CashDrops)
            .FirstOrDefaultAsync(s => s.Id == id, ct);

        if (shift == null) return NotFound(new ApiResponse(404));
        if (shift.Status == ShiftStatus.Closed) return BadRequest(new ApiResponse(400, "Shift is already closed"));

        // Calculate expected cash
        var orders = await _unitOfWork.GetQueryable<Order>()
            .Where(o => o.RegisterShiftId == id && o.Status != OrderStatus.Voided)
            .Select(o => o.Id)
            .ToListAsync(ct);

        var payments = await _unitOfWork.GetQueryable<Payment>()
            .Where(p => orders.Contains(p.OrderId) && p.Status == PaymentStatus.Completed)
            .ToListAsync(ct);

        var cashPayments = payments.Where(p => p.Method == PaymentMethod.Cash).ToList();
        var cashSales = cashPayments.Sum(p => p.Total);
        var cashTips = cashPayments.Sum(p => p.TipAmount);
        var cashDropTotal = shift.CashDrops.Sum(d => d.Amount);

        // Get refunds for orders in this shift
        var refunds = await _unitOfWork.GetQueryable<Refund>()
            .Where(r => orders.Contains(r.OrderId))
            .ToListAsync(ct);
        var cashRefunds = 0m; // simplified — all refunds count against cash for now

        var expectedCash = shift.OpeningCashAmount + cashSales + cashTips - cashRefunds - cashDropTotal;

        shift.ClosingCashAmount = dto.ClosingCashAmount;
        shift.ExpectedCashAmount = expectedCash;
        shift.CashOverShort = dto.ClosingCashAmount - expectedCash;
        shift.ClosedAtUtc = DateTime.UtcNow;
        shift.CloseNotes = dto.CloseNotes;
        shift.Status = ShiftStatus.Closed;

        await _unitOfWork.Complete(ct);
        return Ok(MapShift(shift));
    }

    [HttpPost("{id}/cash-drop")]
    public async Task<ActionResult<CashDropDto>> AddCashDrop(int id, CreateCashDropDto dto, CancellationToken ct)
    {
        var shift = await _unitOfWork.Repository<RegisterShift>().GetByIdAsync(id, ct);
        if (shift == null) return NotFound(new ApiResponse(404));
        if (shift.Status == ShiftStatus.Closed) return BadRequest(new ApiResponse(400, "Shift is closed"));

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;
        var userName = User.FindFirstValue(ClaimTypes.Name);

        var drop = new CashDrop
        {
            RegisterShiftId = id,
            Amount = dto.Amount,
            Reason = dto.Reason,
            PerformedByUserId = userId,
            PerformedByUserName = userName
        };

        _unitOfWork.Repository<CashDrop>().Add(drop);
        await _unitOfWork.Complete(ct);

        return Ok(new CashDropDto
        {
            Id = drop.Id,
            Amount = drop.Amount,
            Reason = drop.Reason,
            PerformedByUserName = drop.PerformedByUserName,
            CreatedAtUtc = drop.CreatedAtUtc
        });
    }

    [HttpGet("current")]
    public async Task<ActionResult<RegisterShiftDto>> GetCurrentShift([FromQuery] int terminalId, CancellationToken ct)
    {
        var shift = await _unitOfWork.GetQueryable<RegisterShift>()
            .Include(s => s.CashDrops)
            .FirstOrDefaultAsync(s => s.TerminalId == terminalId && s.Status == ShiftStatus.Open, ct);

        if (shift == null) return NotFound(new ApiResponse(404));
        return Ok(MapShift(shift));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<RegisterShiftDto>> GetShift(int id, CancellationToken ct)
    {
        var shift = await _unitOfWork.GetQueryable<RegisterShift>()
            .Include(s => s.CashDrops)
            .FirstOrDefaultAsync(s => s.Id == id, ct);

        if (shift == null) return NotFound(new ApiResponse(404));
        return Ok(MapShift(shift));
    }

    [HttpGet("{id}/report")]
    public async Task<ActionResult<ShiftReportDto>> GetShiftReport(int id, CancellationToken ct)
    {
        var shift = await _unitOfWork.GetQueryable<RegisterShift>()
            .Include(s => s.CashDrops)
            .FirstOrDefaultAsync(s => s.Id == id, ct);

        if (shift == null) return NotFound(new ApiResponse(404));

        var orders = await _unitOfWork.GetQueryable<Order>()
            .Where(o => o.RegisterShiftId == id && o.Status != OrderStatus.Voided)
            .ToListAsync(ct);

        var orderIds = orders.Select(o => o.Id).ToList();
        var payments = await _unitOfWork.GetQueryable<Payment>()
            .Where(p => orderIds.Contains(p.OrderId) && p.Status == PaymentStatus.Completed)
            .ToListAsync(ct);

        var refunds = await _unitOfWork.GetQueryable<Refund>()
            .Where(r => orderIds.Contains(r.OrderId))
            .ToListAsync(ct);

        var cashPayments = payments.Where(p => p.Method == PaymentMethod.Cash);
        var cardPayments = payments.Where(p => p.Method == PaymentMethod.Card);
        var cashDropTotal = shift.CashDrops.Sum(d => d.Amount);
        var cashSales = cashPayments.Sum(p => p.Total);
        var cashTips = cashPayments.Sum(p => p.TipAmount);

        return Ok(new ShiftReportDto
        {
            ShiftId = shift.Id,
            CashierName = shift.CashierName,
            OpenedAtUtc = shift.OpenedAtUtc,
            ClosedAtUtc = shift.ClosedAtUtc,
            OpeningCash = shift.OpeningCashAmount,
            CashSales = cashSales,
            CardSales = cardPayments.Sum(p => p.Total),
            TotalSales = payments.Sum(p => p.Total),
            TaxCollected = orders.Sum(o => o.TaxAmount),
            TipTotal = payments.Sum(p => p.TipAmount),
            RefundTotal = refunds.Sum(r => r.Amount),
            DiscountTotal = orders.Sum(o => o.OrderDiscountAmount) + orders.SelectMany(o => o.LineItems).Sum(li => li.DiscountAmount),
            CashDropTotal = cashDropTotal,
            ExpectedCash = shift.ExpectedCashAmount ?? (shift.OpeningCashAmount + cashSales + cashTips - cashDropTotal),
            ActualCash = shift.ClosingCashAmount,
            OverShort = shift.CashOverShort,
            OrderCount = orders.Count
        });
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<RegisterShiftDto>>> GetShifts(
        [FromQuery] int? terminalId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken ct)
    {
        var query = _unitOfWork.GetQueryable<RegisterShift>()
            .Include(s => s.CashDrops)
            .AsQueryable();

        if (terminalId.HasValue) query = query.Where(s => s.TerminalId == terminalId.Value);
        if (from.HasValue) query = query.Where(s => s.OpenedAtUtc >= from.Value);
        if (to.HasValue) query = query.Where(s => s.OpenedAtUtc <= to.Value);

        var shifts = await query.OrderByDescending(s => s.OpenedAtUtc).ToListAsync(ct);
        return Ok(shifts.Select(MapShift).ToList());
    }

    private static RegisterShiftDto MapShift(RegisterShift s) => new()
    {
        Id = s.Id,
        TerminalId = s.TerminalId,
        CashierId = s.CashierId,
        CashierName = s.CashierName,
        Status = s.Status,
        OpeningCashAmount = s.OpeningCashAmount,
        ClosingCashAmount = s.ClosingCashAmount,
        ExpectedCashAmount = s.ExpectedCashAmount,
        CashOverShort = s.CashOverShort,
        OpenedAtUtc = s.OpenedAtUtc,
        ClosedAtUtc = s.ClosedAtUtc,
        CloseNotes = s.CloseNotes,
        CashDrops = s.CashDrops.Select(d => new CashDropDto
        {
            Id = d.Id,
            Amount = d.Amount,
            Reason = d.Reason,
            PerformedByUserName = d.PerformedByUserName,
            CreatedAtUtc = d.CreatedAtUtc
        }).ToList()
    };
}
