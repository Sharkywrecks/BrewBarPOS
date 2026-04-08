namespace BrewBar.Core.Entities.PaymentAggregate;

public class Refund : BaseEntity
{
    public int OrderId { get; set; }
    public int OriginalPaymentId { get; set; }
    public decimal Amount { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string PerformedByUserId { get; set; } = string.Empty;
    public string? PerformedByUserName { get; set; }
    public bool IsFullRefund { get; set; }
    public ICollection<RefundLineItem> LineItems { get; set; } = new List<RefundLineItem>();
}

public class RefundLineItem : BaseEntity
{
    public int RefundId { get; set; }
    public Refund Refund { get; set; } = null!;
    public int OrderLineItemId { get; set; }
    public int Quantity { get; set; }
    public decimal Amount { get; set; }
}
