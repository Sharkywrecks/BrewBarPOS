namespace BrewBar.API.Dtos.Catalog;

public class ModifierDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsRequired { get; set; }
    public bool AllowMultiple { get; set; }
    public int SortOrder { get; set; }
    public IList<ModifierOptionDto> Options { get; set; } = new List<ModifierOptionDto>();
}

public class CreateModifierDto
{
    public string Name { get; set; } = string.Empty;
    public bool IsRequired { get; set; }
    public bool AllowMultiple { get; set; }
    public int SortOrder { get; set; }
    public IList<CreateModifierOptionDto> Options { get; set; } = new List<CreateModifierOptionDto>();
}

public class UpdateModifierDto
{
    public string Name { get; set; } = string.Empty;
    public bool IsRequired { get; set; }
    public bool AllowMultiple { get; set; }
    public int SortOrder { get; set; }
}

public class ModifierOptionDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int SortOrder { get; set; }
}

public class CreateModifierOptionDto
{
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int SortOrder { get; set; }
}

public class UpdateModifierOptionDto
{
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int SortOrder { get; set; }
}
