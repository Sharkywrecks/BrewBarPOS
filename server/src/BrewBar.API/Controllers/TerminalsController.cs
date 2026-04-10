using BrewBar.API.Dtos.Terminals;
using BrewBar.Core.Constants;
using BrewBar.Core.Entities.TerminalAggregate;
using BrewBar.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BrewBar.API.Controllers;

public class TerminalsController : BaseApiController
{
    private readonly IUnitOfWork _unitOfWork;

    public TerminalsController(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    /// <summary>
    /// List all terminals.
    /// </summary>
    [HttpGet]
    [Authorize(Policy = Policies.RequireAdminOrManager)]
    public async Task<ActionResult<IReadOnlyList<TerminalDto>>> GetTerminals(CancellationToken ct)
    {
        var terminals = await _unitOfWork.GetQueryable<Terminal>()
            .OrderBy(t => t.Name)
            .ToListAsync(ct);

        return Ok(terminals.Select(MapDto).ToList());
    }

    /// <summary>
    /// Get terminal by ID.
    /// </summary>
    [HttpGet("{id}")]
    [Authorize(Policy = Policies.RequireAdminOrManager)]
    public async Task<ActionResult<TerminalDto>> GetTerminal(int id, CancellationToken ct)
    {
        var terminal = await _unitOfWork.GetQueryable<Terminal>()
            .FirstOrDefaultAsync(t => t.Id == id, ct);

        if (terminal == null)
            return NotFound();

        return Ok(MapDto(terminal));
    }

    /// <summary>
    /// Register a new terminal. Generates a unique registration code.
    /// </summary>
    [HttpPost]
    [Authorize(Policy = Policies.RequireAdmin)]
    public async Task<ActionResult<TerminalDto>> CreateTerminal(
        CreateTerminalDto dto, CancellationToken ct)
    {
        var terminal = new Terminal
        {
            Name = dto.Name,
            RegistrationCode = Guid.NewGuid().ToString("N")[..8].ToUpperInvariant(),
            IsActive = true,
        };

        _unitOfWork.Repository<Terminal>().Add(terminal);
        await _unitOfWork.Complete(ct);

        return CreatedAtAction(nameof(GetTerminal), new { id = terminal.Id }, MapDto(terminal));
    }

    /// <summary>
    /// Update terminal details.
    /// </summary>
    [HttpPut("{id}")]
    [Authorize(Policy = Policies.RequireAdmin)]
    public async Task<ActionResult<TerminalDto>> UpdateTerminal(
        int id, UpdateTerminalDto dto, CancellationToken ct)
    {
        var terminal = await _unitOfWork.GetQueryable<Terminal>()
            .FirstOrDefaultAsync(t => t.Id == id, ct);

        if (terminal == null)
            return NotFound();

        terminal.Name = dto.Name;
        terminal.IsActive = dto.IsActive;
        terminal.ConfigJson = dto.ConfigJson;

        await _unitOfWork.Complete(ct);
        return Ok(MapDto(terminal));
    }

    /// <summary>
    /// Delete a terminal. Only allowed if no shifts reference it.
    /// </summary>
    [HttpDelete("{id}")]
    [Authorize(Policy = Policies.RequireAdmin)]
    public async Task<ActionResult> DeleteTerminal(int id, CancellationToken ct)
    {
        var terminal = await _unitOfWork.GetQueryable<Terminal>()
            .FirstOrDefaultAsync(t => t.Id == id, ct);

        if (terminal == null)
            return NotFound();

        var hasShifts = await _unitOfWork.GetQueryable<Core.Entities.ShiftAggregate.RegisterShift>()
            .AnyAsync(s => s.TerminalId == id, ct);

        if (hasShifts)
            return Conflict(new { message = "Cannot delete terminal with existing shifts. Deactivate it instead." });

        _unitOfWork.Repository<Terminal>().Delete(terminal);
        await _unitOfWork.Complete(ct);

        return NoContent();
    }

    /// <summary>
    /// Record a heartbeat from the terminal (updates LastSeenUtc). No elevated role required.
    /// </summary>
    [HttpPost("{id}/heartbeat")]
    [Authorize]
    public async Task<ActionResult> Heartbeat(int id, CancellationToken ct)
    {
        var terminal = await _unitOfWork.GetQueryable<Terminal>()
            .FirstOrDefaultAsync(t => t.Id == id, ct);

        if (terminal == null)
            return NotFound();

        terminal.LastSeenUtc = DateTime.UtcNow;
        await _unitOfWork.Complete(ct);

        return NoContent();
    }

    private static TerminalDto MapDto(Terminal t) => new()
    {
        Id = t.Id,
        Name = t.Name,
        RegistrationCode = t.RegistrationCode,
        IsActive = t.IsActive,
        LastSeenUtc = t.LastSeenUtc,
        ConfigJson = t.ConfigJson,
    };
}
