namespace BrewBar.Core.Entities.CatalogAggregate;

public class Modifier : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public bool IsRequired { get; set; }
    public bool AllowMultiple { get; set; }
    public int SortOrder { get; set; }
    public ICollection<ModifierOption> Options { get; set; } = new List<ModifierOption>();
    public ICollection<ProductModifier> ProductModifiers { get; set; } = new List<ProductModifier>();
}
