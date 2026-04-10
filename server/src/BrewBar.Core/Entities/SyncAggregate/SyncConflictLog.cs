namespace BrewBar.Core.Entities.SyncAggregate;

public class SyncConflictLog : BaseEntity
{
    public Guid LocalId { get; set; }
    public string EntityType { get; set; } = string.Empty;
    public string ClientPayload { get; set; } = string.Empty;
    public string? ServerPayload { get; set; }
    public string ConflictReason { get; set; } = string.Empty;
    public bool Resolved { get; set; }
    public string? ResolvedByUserId { get; set; }
    public DateTime? ResolvedAtUtc { get; set; }
}
