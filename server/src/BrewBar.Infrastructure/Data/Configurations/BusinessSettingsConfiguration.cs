using BrewBar.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BrewBar.Infrastructure.Data.Configurations;

public class BusinessSettingsConfiguration : IEntityTypeConfiguration<BusinessSettings>
{
    public void Configure(EntityTypeBuilder<BusinessSettings> builder)
    {
        builder.Property(s => s.StoreName).HasMaxLength(100).IsRequired();
        builder.Property(s => s.StoreInfo).HasMaxLength(500);
        builder.Property(s => s.TaxRate).HasPrecision(5, 4);
        builder.Property(s => s.Currency).HasConversion<string>().HasMaxLength(3).IsRequired();
        builder.Property(s => s.DiscountApprovalThreshold).HasPrecision(10, 2);
    }
}
