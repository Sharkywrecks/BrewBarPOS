using BrewBar.Core.Entities.PaymentAggregate;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BrewBar.Infrastructure.Data.Configurations;

public class RefundConfiguration : IEntityTypeConfiguration<Refund>
{
    public void Configure(EntityTypeBuilder<Refund> builder)
    {
        builder.Property(r => r.Amount).HasPrecision(10, 2);
        builder.HasMany(r => r.LineItems).WithOne(li => li.Refund).HasForeignKey(li => li.RefundId);
    }
}

public class RefundLineItemConfiguration : IEntityTypeConfiguration<RefundLineItem>
{
    public void Configure(EntityTypeBuilder<RefundLineItem> builder)
    {
        builder.Property(li => li.Amount).HasPrecision(10, 2);
    }
}
