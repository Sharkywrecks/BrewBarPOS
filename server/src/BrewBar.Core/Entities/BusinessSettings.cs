using BrewBar.Core.Enums;

namespace BrewBar.Core.Entities;

public class BusinessSettings : BaseEntity
{
    public string StoreName { get; set; } = "BrewBar";
    public string? StoreInfo { get; set; }
    public decimal TaxRate { get; set; } = 0.15m;
    public Currency Currency { get; set; } = Currency.SCR;
    public decimal DiscountApprovalThreshold { get; set; }
}
