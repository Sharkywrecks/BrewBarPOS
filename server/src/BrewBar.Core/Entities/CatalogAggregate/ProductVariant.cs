namespace BrewBar.Core.Entities.CatalogAggregate;

public class ProductVariant : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public decimal PriceOverride { get; set; }
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public int SortOrder { get; set; }
    public bool IsAvailable { get; set; } = true;
}
