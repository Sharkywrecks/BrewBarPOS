namespace BrewBar.Core.Entities.ShiftAggregate;

public class CashDrop : BaseEntity
{
    public int RegisterShiftId { get; set; }
    public RegisterShift RegisterShift { get; set; } = null!;
    public decimal Amount { get; set; }
    public string? Reason { get; set; }
    public string PerformedByUserId { get; set; } = string.Empty;
    public string? PerformedByUserName { get; set; }
}
