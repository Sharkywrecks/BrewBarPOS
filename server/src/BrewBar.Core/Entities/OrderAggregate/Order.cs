using BrewBar.Core.Enums;

namespace BrewBar.Core.Entities.OrderAggregate;

public class Order : BaseEntity
{
    public Guid LocalId { get; set; } = Guid.NewGuid();
    public string DisplayOrderNumber { get; set; } = string.Empty;
    public OrderStatus Status { get; set; } = OrderStatus.Open;
    public decimal Subtotal { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal TaxRate { get; set; }
    public decimal Total { get; set; }
    public decimal OrderDiscountAmount { get; set; }
    public DiscountType? OrderDiscountType { get; set; }
    public decimal? OrderDiscountPercent { get; set; }
    public string? OrderDiscountReason { get; set; }
    public string? Notes { get; set; }
    public string CashierId { get; set; } = string.Empty;
    public string? CashierName { get; set; }
    public int? TerminalId { get; set; }
    public int? RegisterShiftId { get; set; }
    public string? VoidReason { get; set; }
    public string? VoidedByUserId { get; set; }
    public string? VoidedByUserName { get; set; }
    public DateTime? VoidedAtUtc { get; set; }
    public ICollection<OrderLineItem> LineItems { get; set; } = new List<OrderLineItem>();
}
