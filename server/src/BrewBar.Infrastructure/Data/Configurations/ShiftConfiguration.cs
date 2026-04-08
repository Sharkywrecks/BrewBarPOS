using BrewBar.Core.Entities.ShiftAggregate;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BrewBar.Infrastructure.Data.Configurations;

public class RegisterShiftConfiguration : IEntityTypeConfiguration<RegisterShift>
{
    public void Configure(EntityTypeBuilder<RegisterShift> builder)
    {
        builder.Property(s => s.OpeningCashAmount).HasPrecision(10, 2);
        builder.Property(s => s.ClosingCashAmount).HasPrecision(10, 2);
        builder.Property(s => s.ExpectedCashAmount).HasPrecision(10, 2);
        builder.Property(s => s.CashOverShort).HasPrecision(10, 2);
        builder.HasMany(s => s.CashDrops).WithOne(d => d.RegisterShift).HasForeignKey(d => d.RegisterShiftId);
    }
}

public class CashDropConfiguration : IEntityTypeConfiguration<CashDrop>
{
    public void Configure(EntityTypeBuilder<CashDrop> builder)
    {
        builder.Property(d => d.Amount).HasPrecision(10, 2);
    }
}
