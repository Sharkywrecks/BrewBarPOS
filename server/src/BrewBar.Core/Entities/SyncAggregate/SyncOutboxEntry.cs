using BrewBar.Core.Enums;

namespace BrewBar.Core.Entities.SyncAggregate;

public class SyncOutboxEntry : BaseEntity
{
    public Guid LocalId { get; set; }
    public string EntityType { get; set; } = string.Empty;
    public string Payload { get; set; } = string.Empty;
    public SyncStatus Status { get; set; } = SyncStatus.Pending;
    public int AttemptCount { get; set; }
    public DateTime? LastAttemptUtc { get; set; }
    public string? ErrorMessage { get; set; }
}
