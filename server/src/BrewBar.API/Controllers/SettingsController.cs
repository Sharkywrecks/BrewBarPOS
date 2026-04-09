using BrewBar.Core.Entities;
using BrewBar.Core.Enums;
using BrewBar.Core.Interfaces;
using BrewBar.Core.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BrewBar.API.Controllers;

public class SettingsController : BaseApiController
{
    private readonly IUnitOfWork _unitOfWork;

    public SettingsController(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    /// <summary>
    /// Get business settings. No auth required — POS needs these at startup.
    /// </summary>
    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<BusinessSettingsDto>> GetSettings(CancellationToken ct)
    {
        var settings = await _unitOfWork.GetQueryable<BusinessSettings>()
            .OrderBy(s => s.Id)
            .FirstOrDefaultAsync(ct);

        if (settings == null)
        {
            // Create default settings on first access
            settings = new BusinessSettings();
            _unitOfWork.Repository<BusinessSettings>().Add(settings);
            await _unitOfWork.Complete(ct);
        }

        return Ok(MapDto(settings));
    }

    /// <summary>
    /// Update business settings. Admin only.
    /// </summary>
    [HttpPut]
    [Authorize(Policy = Policies.RequireAdmin)]
    public async Task<ActionResult<BusinessSettingsDto>> UpdateSettings(
        UpdateBusinessSettingsDto dto, CancellationToken ct)
    {
        var settings = await _unitOfWork.GetQueryable<BusinessSettings>()
            .OrderBy(s => s.Id)
            .FirstOrDefaultAsync(ct);

        if (settings == null)
        {
            settings = new BusinessSettings();
            _unitOfWork.Repository<BusinessSettings>().Add(settings);
        }

        settings.StoreName = dto.StoreName;
        settings.StoreInfo = dto.StoreInfo;
        settings.TaxRate = dto.TaxRate;
        settings.Currency = dto.Currency;
        settings.DiscountApprovalThreshold = dto.DiscountApprovalThreshold;

        await _unitOfWork.Complete(ct);
        return Ok(MapDto(settings));
    }

    private static BusinessSettingsDto MapDto(BusinessSettings s) => new()
    {
        StoreName = s.StoreName,
        StoreInfo = s.StoreInfo,
        TaxRate = s.TaxRate,
        Currency = s.Currency,
        DiscountApprovalThreshold = s.DiscountApprovalThreshold,
    };
}

public class BusinessSettingsDto
{
    public string StoreName { get; set; } = string.Empty;
    public string? StoreInfo { get; set; }
    public decimal TaxRate { get; set; }
    public Currency Currency { get; set; }
    public decimal DiscountApprovalThreshold { get; set; }
}

public class UpdateBusinessSettingsDto
{
    public string StoreName { get; set; } = string.Empty;
    public string? StoreInfo { get; set; }
    public decimal TaxRate { get; set; }
    public Currency Currency { get; set; }
    public decimal DiscountApprovalThreshold { get; set; }
}
