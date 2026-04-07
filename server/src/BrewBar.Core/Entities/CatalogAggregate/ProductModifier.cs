namespace BrewBar.Core.Entities.CatalogAggregate;

public class ProductModifier : BaseEntity
{
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public int ModifierId { get; set; }
    public Modifier Modifier { get; set; } = null!;
}
