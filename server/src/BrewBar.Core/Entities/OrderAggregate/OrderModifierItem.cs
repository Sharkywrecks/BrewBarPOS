namespace BrewBar.Core.Entities.OrderAggregate;

public class OrderModifierItem : BaseEntity
{
    public int OrderLineItemId { get; set; }
    public OrderLineItem OrderLineItem { get; set; } = null!;
    public string ModifierName { get; set; } = string.Empty;
    public string OptionName { get; set; } = string.Empty;
    public decimal Price { get; set; }
}
