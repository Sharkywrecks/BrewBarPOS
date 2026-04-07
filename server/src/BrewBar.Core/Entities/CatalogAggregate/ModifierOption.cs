namespace BrewBar.Core.Entities.CatalogAggregate;

public class ModifierOption : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int ModifierId { get; set; }
    public Modifier Modifier { get; set; } = null!;
    public int SortOrder { get; set; }
}
