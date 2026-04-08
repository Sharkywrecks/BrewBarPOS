namespace BrewBar.API.Dtos.Catalog;

public class ProductDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal BasePrice { get; set; }
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsAvailable { get; set; }
    public string? ImageUrl { get; set; }
    public decimal? TaxRate { get; set; }
    public string? Barcode { get; set; }
    public string? Sku { get; set; }
    public IList<ProductVariantDto> Variants { get; set; } = new List<ProductVariantDto>();
    public IList<ProductModifierDto> Modifiers { get; set; } = new List<ProductModifierDto>();
}

public class CreateProductDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal BasePrice { get; set; }
    public int CategoryId { get; set; }
    public int SortOrder { get; set; }
    public bool IsAvailable { get; set; } = true;
    public string? ImageUrl { get; set; }
    public decimal? TaxRate { get; set; }
    public string? Barcode { get; set; }
    public string? Sku { get; set; }
}

public class UpdateProductDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal BasePrice { get; set; }
    public int CategoryId { get; set; }
    public int SortOrder { get; set; }
    public bool IsAvailable { get; set; } = true;
    public string? ImageUrl { get; set; }
    public decimal? TaxRate { get; set; }
    public string? Barcode { get; set; }
    public string? Sku { get; set; }
}

public class ProductVariantDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal PriceOverride { get; set; }
    public int SortOrder { get; set; }
    public bool IsAvailable { get; set; }
}

public class CreateProductVariantDto
{
    public string Name { get; set; } = string.Empty;
    public decimal PriceOverride { get; set; }
    public int SortOrder { get; set; }
    public bool IsAvailable { get; set; } = true;
}

public class UpdateProductVariantDto
{
    public string Name { get; set; } = string.Empty;
    public decimal PriceOverride { get; set; }
    public int SortOrder { get; set; }
    public bool IsAvailable { get; set; } = true;
}

public class ProductModifierDto
{
    public int ModifierId { get; set; }
    public string ModifierName { get; set; } = string.Empty;
    public bool IsRequired { get; set; }
    public bool AllowMultiple { get; set; }
    public int SortOrder { get; set; }
    public IList<ModifierOptionDto> Options { get; set; } = new List<ModifierOptionDto>();
}
