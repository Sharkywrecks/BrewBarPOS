using BrewBar.API.Dtos.Catalog;
using BrewBar.API.Errors;
using BrewBar.Core.Entities.CatalogAggregate;
using BrewBar.Core.Interfaces;
using BrewBar.Core.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BrewBar.API.Controllers;

[Authorize(Policy = Policies.RequireAdminOrManager)]
public class ModifiersController : BaseApiController
{
    private readonly IUnitOfWork _unitOfWork;

    public ModifiersController(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    [HttpGet]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<ModifierDto>>> GetModifiers(CancellationToken ct)
    {
        var modifiers = await _unitOfWork.GetQueryable<Modifier>()
            .Include(m => m.Options)
            .OrderBy(m => m.SortOrder)
            .ToListAsync(ct);

        return Ok(modifiers.Select(MapModifier).ToList());
    }

    [HttpGet("{id}")]
    [Authorize]
    public async Task<ActionResult<ModifierDto>> GetModifier(int id, CancellationToken ct)
    {
        var modifier = await _unitOfWork.GetQueryable<Modifier>()
            .Include(m => m.Options)
            .FirstOrDefaultAsync(m => m.Id == id, ct);

        if (modifier == null) return NotFound(new ApiResponse(404));
        return Ok(MapModifier(modifier));
    }

    [HttpPost]
    public async Task<ActionResult<ModifierDto>> CreateModifier(CreateModifierDto dto, CancellationToken ct)
    {
        var modifier = new Modifier
        {
            Name = dto.Name,
            IsRequired = dto.IsRequired,
            AllowMultiple = dto.AllowMultiple,
            SortOrder = dto.SortOrder,
            Options = dto.Options.Select(o => new ModifierOption
            {
                Name = o.Name,
                Price = o.Price,
                SortOrder = o.SortOrder
            }).ToList()
        };

        _unitOfWork.Repository<Modifier>().Add(modifier);
        await _unitOfWork.Complete(ct);

        return CreatedAtAction(nameof(GetModifier), new { id = modifier.Id }, MapModifier(modifier));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ModifierDto>> UpdateModifier(int id, UpdateModifierDto dto, CancellationToken ct)
    {
        var modifier = await _unitOfWork.GetQueryable<Modifier>()
            .Include(m => m.Options)
            .FirstOrDefaultAsync(m => m.Id == id, ct);

        if (modifier == null) return NotFound(new ApiResponse(404));

        modifier.Name = dto.Name;
        modifier.IsRequired = dto.IsRequired;
        modifier.AllowMultiple = dto.AllowMultiple;
        modifier.SortOrder = dto.SortOrder;

        await _unitOfWork.Complete(ct);
        return Ok(MapModifier(modifier));
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = Policies.RequireAdmin)]
    public async Task<ActionResult> DeleteModifier(int id, CancellationToken ct)
    {
        var modifier = await _unitOfWork.GetQueryable<Modifier>()
            .Include(m => m.ProductModifiers)
            .FirstOrDefaultAsync(m => m.Id == id, ct);

        if (modifier == null) return NotFound(new ApiResponse(404));
        if (modifier.ProductModifiers.Count > 0)
            return BadRequest(new ApiResponse(400, "Cannot delete a modifier that is assigned to products. Remove assignments first."));

        _unitOfWork.Repository<Modifier>().Delete(modifier);
        await _unitOfWork.Complete(ct);
        return NoContent();
    }

    // --- Options ---

    [HttpPost("{modifierId}/options")]
    public async Task<ActionResult<ModifierOptionDto>> CreateOption(int modifierId, CreateModifierOptionDto dto, CancellationToken ct)
    {
        var modifier = await _unitOfWork.Repository<Modifier>().GetByIdAsync(modifierId, ct);
        if (modifier == null) return NotFound(new ApiResponse(404, "Modifier not found"));

        var option = new ModifierOption
        {
            ModifierId = modifierId,
            Name = dto.Name,
            Price = dto.Price,
            SortOrder = dto.SortOrder
        };

        _unitOfWork.Repository<ModifierOption>().Add(option);
        await _unitOfWork.Complete(ct);

        return CreatedAtAction(nameof(GetModifier), new { id = modifierId }, new ModifierOptionDto
        {
            Id = option.Id,
            Name = option.Name,
            Price = option.Price,
            SortOrder = option.SortOrder
        });
    }

    [HttpPut("{modifierId}/options/{optionId}")]
    public async Task<ActionResult<ModifierOptionDto>> UpdateOption(int modifierId, int optionId, UpdateModifierOptionDto dto, CancellationToken ct)
    {
        var option = await _unitOfWork.GetQueryable<ModifierOption>()
            .FirstOrDefaultAsync(o => o.Id == optionId && o.ModifierId == modifierId, ct);

        if (option == null) return NotFound(new ApiResponse(404));

        option.Name = dto.Name;
        option.Price = dto.Price;
        option.SortOrder = dto.SortOrder;

        await _unitOfWork.Complete(ct);

        return Ok(new ModifierOptionDto
        {
            Id = option.Id,
            Name = option.Name,
            Price = option.Price,
            SortOrder = option.SortOrder
        });
    }

    [HttpDelete("{modifierId}/options/{optionId}")]
    public async Task<ActionResult> DeleteOption(int modifierId, int optionId, CancellationToken ct)
    {
        var option = await _unitOfWork.GetQueryable<ModifierOption>()
            .FirstOrDefaultAsync(o => o.Id == optionId && o.ModifierId == modifierId, ct);

        if (option == null) return NotFound(new ApiResponse(404));

        _unitOfWork.Repository<ModifierOption>().Delete(option);
        await _unitOfWork.Complete(ct);
        return NoContent();
    }

    private static ModifierDto MapModifier(Modifier m) => new()
    {
        Id = m.Id,
        Name = m.Name,
        IsRequired = m.IsRequired,
        AllowMultiple = m.AllowMultiple,
        SortOrder = m.SortOrder,
        Options = m.Options.OrderBy(o => o.SortOrder).Select(o => new ModifierOptionDto
        {
            Id = o.Id,
            Name = o.Name,
            Price = o.Price,
            SortOrder = o.SortOrder
        }).ToList()
    };
}
