using BrewBar.Core.Constants;
using BrewBar.Core.Entities.SyncAggregate;
using BrewBar.Core.Enums;
using BrewBar.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BrewBar.API.Controllers;

public class SyncController : BaseApiController
{
    private readonly IUnitOfWork _unitOfWork;

    public SyncController(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    /// <summary>
    /// Get all outbox entries, optionally filtered by status.
    /// </summary>
    [HttpGet("outbox")]
    [Authorize(Policy = Policies.RequireAdminOrManager)]
    public async Task<ActionResult<IReadOnlyList<SyncOutboxEntryDto>>> GetOutboxEntries(
        [FromQuery] SyncStatus? status, CancellationToken ct)
    {
        var query = _unitOfWork.GetQueryable<SyncOutboxEntry>().AsQueryable();

        if (status.HasValue)
            query = query.Where(e => e.Status == status.Value);

        var entries = await query.OrderByDescending(e => e.CreatedAtUtc).ToListAsync(ct);
        return Ok(entries.Select(MapOutboxDto).ToList());
    }

    /// <summary>
    /// Retry a failed or dead-lettered outbox entry by resetting it to Pending.
    /// </summary>
    [HttpPost("outbox/{id}/retry")]
    [Authorize(Policy = Policies.RequireAdminOrManager)]
    public async Task<ActionResult> RetryOutboxEntry(int id, CancellationToken ct)
    {
        var entry = await _unitOfWork.GetQueryable<SyncOutboxEntry>()
            .FirstOrDefaultAsync(e => e.Id == id, ct);

        if (entry == null)
            return NotFound();

        if (entry.Status != SyncStatus.Failed && entry.Status != SyncStatus.DeadLetter)
            return Conflict(new { message = "Only failed or dead-lettered entries can be retried." });

        entry.Status = SyncStatus.Pending;
        entry.AttemptCount = 0;
        entry.ErrorMessage = null;
        entry.LastAttemptUtc = null;

        await _unitOfWork.Complete(ct);
        return NoContent();
    }

    /// <summary>
    /// Discard a failed outbox entry (marks as DeadLetter permanently).
    /// </summary>
    [HttpPost("outbox/{id}/discard")]
    [Authorize(Policy = Policies.RequireAdmin)]
    public async Task<ActionResult> DiscardOutboxEntry(int id, CancellationToken ct)
    {
        var entry = await _unitOfWork.GetQueryable<SyncOutboxEntry>()
            .FirstOrDefaultAsync(e => e.Id == id, ct);

        if (entry == null)
            return NotFound();

        entry.Status = SyncStatus.DeadLetter;
        await _unitOfWork.Complete(ct);

        return NoContent();
    }

    /// <summary>
    /// Get all conflict logs, optionally filtered by resolved status.
    /// </summary>
    [HttpGet("conflicts")]
    [Authorize(Policy = Policies.RequireAdminOrManager)]
    public async Task<ActionResult<IReadOnlyList<SyncConflictLogDto>>> GetConflicts(
        [FromQuery] bool? resolved, CancellationToken ct)
    {
        var query = _unitOfWork.GetQueryable<SyncConflictLog>().AsQueryable();

        if (resolved.HasValue)
            query = query.Where(c => c.Resolved == resolved.Value);

        var conflicts = await query.OrderByDescending(c => c.CreatedAtUtc).ToListAsync(ct);
        return Ok(conflicts.Select(MapConflictDto).ToList());
    }

    /// <summary>
    /// Resolve a conflict by choosing to accept or reject the client's payload.
    /// </summary>
    [HttpPost("conflicts/{id}/resolve")]
    [Authorize(Policy = Policies.RequireAdminOrManager)]
    public async Task<ActionResult> ResolveConflict(
        int id, ResolveConflictDto dto, CancellationToken ct)
    {
        var conflict = await _unitOfWork.GetQueryable<SyncConflictLog>()
            .FirstOrDefaultAsync(c => c.Id == id, ct);

        if (conflict == null)
            return NotFound();

        if (conflict.Resolved)
            return Conflict(new { message = "Conflict is already resolved." });

        conflict.Resolved = true;
        conflict.ResolvedByUserId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        conflict.ResolvedAtUtc = DateTime.UtcNow;

        await _unitOfWork.Complete(ct);
        return NoContent();
    }

    private static SyncOutboxEntryDto MapOutboxDto(SyncOutboxEntry e) => new()
    {
        Id = e.Id,
        LocalId = e.LocalId,
        EntityType = e.EntityType,
        Payload = e.Payload,
        Status = e.Status,
        AttemptCount = e.AttemptCount,
        LastAttemptUtc = e.LastAttemptUtc,
        ErrorMessage = e.ErrorMessage,
        CreatedAtUtc = e.CreatedAtUtc,
    };

    private static SyncConflictLogDto MapConflictDto(SyncConflictLog c) => new()
    {
        Id = c.Id,
        LocalId = c.LocalId,
        EntityType = c.EntityType,
        ClientPayload = c.ClientPayload,
        ServerPayload = c.ServerPayload,
        ConflictReason = c.ConflictReason,
        Resolved = c.Resolved,
        ResolvedByUserId = c.ResolvedByUserId,
        ResolvedAtUtc = c.ResolvedAtUtc,
        CreatedAtUtc = c.CreatedAtUtc,
    };
}

public class SyncOutboxEntryDto
{
    public int Id { get; set; }
    public Guid LocalId { get; set; }
    public string EntityType { get; set; } = string.Empty;
    public string Payload { get; set; } = string.Empty;
    public SyncStatus Status { get; set; }
    public int AttemptCount { get; set; }
    public DateTime? LastAttemptUtc { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public class SyncConflictLogDto
{
    public int Id { get; set; }
    public Guid LocalId { get; set; }
    public string EntityType { get; set; } = string.Empty;
    public string ClientPayload { get; set; } = string.Empty;
    public string? ServerPayload { get; set; }
    public string ConflictReason { get; set; } = string.Empty;
    public bool Resolved { get; set; }
    public string? ResolvedByUserId { get; set; }
    public DateTime? ResolvedAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public class ResolveConflictDto
{
    public string Resolution { get; set; } = string.Empty;
}
