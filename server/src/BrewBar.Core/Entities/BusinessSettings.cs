namespace BrewBar.Core.Entities;

public class BusinessSettings : BaseEntity
{
    public string StoreName { get; set; } = "BrewBar";
    public string? StoreInfo { get; set; }
    public decimal TaxRate { get; set; } = 0.0875m;
    public string CurrencyCode { get; set; } = "USD";
}
