namespace BrewBar.API.Dtos.Terminals;

public class TerminalDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string RegistrationCode { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime? LastSeenUtc { get; set; }
    public string? ConfigJson { get; set; }
}

public class CreateTerminalDto
{
    public string Name { get; set; } = string.Empty;
}

public class UpdateTerminalDto
{
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public string? ConfigJson { get; set; }
}
