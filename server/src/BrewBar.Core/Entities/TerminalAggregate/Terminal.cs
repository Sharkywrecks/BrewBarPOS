namespace BrewBar.Core.Entities.TerminalAggregate;

public class Terminal : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string RegistrationCode { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime? LastSeenUtc { get; set; }
    public string? ConfigJson { get; set; }
}
