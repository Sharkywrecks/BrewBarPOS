using BrewBar.Core.Entities.PaymentAggregate;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BrewBar.Infrastructure.Data.Configurations;

public class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> builder)
    {
        builder.Property(p => p.AmountTendered).HasPrecision(10, 2);
        builder.Property(p => p.ChangeGiven).HasPrecision(10, 2);
        builder.Property(p => p.Total).HasPrecision(10, 2);
    }
}
