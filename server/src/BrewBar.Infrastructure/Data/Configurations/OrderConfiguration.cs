using BrewBar.Core.Entities.OrderAggregate;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BrewBar.Infrastructure.Data.Configurations;

public class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.HasIndex(o => o.LocalId).IsUnique();
        builder.Property(o => o.Subtotal).HasPrecision(10, 2);
        builder.Property(o => o.TaxAmount).HasPrecision(10, 2);
        builder.Property(o => o.TaxRate).HasPrecision(5, 4);
        builder.Property(o => o.Total).HasPrecision(10, 2);
        builder.HasMany(o => o.LineItems).WithOne(li => li.Order).HasForeignKey(li => li.OrderId);
    }
}

public class OrderLineItemConfiguration : IEntityTypeConfiguration<OrderLineItem>
{
    public void Configure(EntityTypeBuilder<OrderLineItem> builder)
    {
        builder.Property(li => li.UnitPrice).HasPrecision(10, 2);
        builder.Property(li => li.LineTotal).HasPrecision(10, 2);
        builder.HasMany(li => li.ModifierItems).WithOne(mi => mi.OrderLineItem).HasForeignKey(mi => mi.OrderLineItemId);
    }
}

public class OrderModifierItemConfiguration : IEntityTypeConfiguration<OrderModifierItem>
{
    public void Configure(EntityTypeBuilder<OrderModifierItem> builder)
    {
        builder.Property(mi => mi.Price).HasPrecision(10, 2);
    }
}
