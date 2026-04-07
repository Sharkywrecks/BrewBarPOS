using BrewBar.Core.Enums;

namespace BrewBar.API.Dtos.Orders;

public class PaymentDto
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public PaymentMethod Method { get; set; }
    public PaymentStatus Status { get; set; }
    public decimal AmountTendered { get; set; }
    public decimal ChangeGiven { get; set; }
    public decimal Total { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public class CreatePaymentDto
{
    public int OrderId { get; set; }
    public PaymentMethod Method { get; set; } = PaymentMethod.Cash;
    public decimal AmountTendered { get; set; }
    public decimal Total { get; set; }
}
