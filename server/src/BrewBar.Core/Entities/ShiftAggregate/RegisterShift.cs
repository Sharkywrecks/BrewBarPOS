using BrewBar.Core.Enums;

namespace BrewBar.Core.Entities.ShiftAggregate;

public class RegisterShift : BaseEntity
{
    public int TerminalId { get; set; }
    public string CashierId { get; set; } = string.Empty;
    public string? CashierName { get; set; }
    public ShiftStatus Status { get; set; } = ShiftStatus.Open;
    public decimal OpeningCashAmount { get; set; }
    public decimal? ClosingCashAmount { get; set; }
    public decimal? ExpectedCashAmount { get; set; }
    public decimal? CashOverShort { get; set; }
    public DateTime OpenedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ClosedAtUtc { get; set; }
    public string? CloseNotes { get; set; }
    public ICollection<CashDrop> CashDrops { get; set; } = new List<CashDrop>();
}
