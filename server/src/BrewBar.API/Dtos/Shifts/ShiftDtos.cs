using BrewBar.Core.Enums;

namespace BrewBar.API.Dtos.Shifts;

public class RegisterShiftDto
{
    public int Id { get; set; }
    public int TerminalId { get; set; }
    public string CashierId { get; set; } = string.Empty;
    public string? CashierName { get; set; }
    public ShiftStatus Status { get; set; }
    public decimal OpeningCashAmount { get; set; }
    public decimal? ClosingCashAmount { get; set; }
    public decimal? ExpectedCashAmount { get; set; }
    public decimal? CashOverShort { get; set; }
    public DateTime OpenedAtUtc { get; set; }
    public DateTime? ClosedAtUtc { get; set; }
    public string? CloseNotes { get; set; }
    public IList<CashDropDto> CashDrops { get; set; } = new List<CashDropDto>();
}

public class OpenShiftDto
{
    public int TerminalId { get; set; }
    public decimal OpeningCashAmount { get; set; }
}

public class CloseShiftDto
{
    public decimal ClosingCashAmount { get; set; }
    public string? CloseNotes { get; set; }
}

public class CashDropDto
{
    public int Id { get; set; }
    public decimal Amount { get; set; }
    public string? Reason { get; set; }
    public string? PerformedByUserName { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public class CreateCashDropDto
{
    public decimal Amount { get; set; }
    public string? Reason { get; set; }
}

public class ShiftReportDto
{
    public int ShiftId { get; set; }
    public string? CashierName { get; set; }
    public DateTime OpenedAtUtc { get; set; }
    public DateTime? ClosedAtUtc { get; set; }
    public decimal OpeningCash { get; set; }
    public decimal CashSales { get; set; }
    public decimal CardSales { get; set; }
    public decimal TotalSales { get; set; }
    public decimal TaxCollected { get; set; }
    public decimal TipTotal { get; set; }
    public decimal RefundTotal { get; set; }
    public decimal DiscountTotal { get; set; }
    public decimal CashDropTotal { get; set; }
    public decimal ExpectedCash { get; set; }
    public decimal? ActualCash { get; set; }
    public decimal? OverShort { get; set; }
    public int OrderCount { get; set; }
}
