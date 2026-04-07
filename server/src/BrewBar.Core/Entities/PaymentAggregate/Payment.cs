using BrewBar.Core.Enums;

namespace BrewBar.Core.Entities.PaymentAggregate;

public class Payment : BaseEntity
{
    public int OrderId { get; set; }
    public PaymentMethod Method { get; set; } = PaymentMethod.Cash;
    public PaymentStatus Status { get; set; } = PaymentStatus.Completed;
    public decimal AmountTendered { get; set; }
    public decimal ChangeGiven { get; set; }
    public decimal Total { get; set; }
}
