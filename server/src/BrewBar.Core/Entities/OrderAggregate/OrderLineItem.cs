using BrewBar.Core.Enums;

namespace BrewBar.Core.Entities.OrderAggregate;

public class OrderLineItem : BaseEntity
{
    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? VariantName { get; set; }
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; } = 1;
    public decimal LineTotal { get; set; }
    public decimal TaxRate { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public DiscountType? DiscountType { get; set; }
    public decimal? DiscountPercent { get; set; }
    public string? DiscountReason { get; set; }
    public ICollection<OrderModifierItem> ModifierItems { get; set; } = new List<OrderModifierItem>();
}
