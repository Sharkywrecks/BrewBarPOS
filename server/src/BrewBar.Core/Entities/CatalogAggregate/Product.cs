namespace BrewBar.Core.Entities.CatalogAggregate;

public class Product : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal BasePrice { get; set; }
    public int CategoryId { get; set; }
    public Category Category { get; set; } = null!;
    public int SortOrder { get; set; }
    public bool IsAvailable { get; set; } = true;
    public string? ImageUrl { get; set; }
    public decimal? TaxRate { get; set; }
    public string? Barcode { get; set; }
    public string? Sku { get; set; }
    public ICollection<ProductVariant> Variants { get; set; } = new List<ProductVariant>();
    public ICollection<ProductModifier> ProductModifiers { get; set; } = new List<ProductModifier>();
}
