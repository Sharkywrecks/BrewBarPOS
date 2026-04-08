using BrewBar.Core.Entities.CatalogAggregate;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BrewBar.Infrastructure.Data.Configurations;

public class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.HasMany(c => c.Products).WithOne(p => p.Category).HasForeignKey(p => p.CategoryId);
    }
}

public class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.Property(p => p.BasePrice).HasPrecision(10, 2);
        builder.Property(p => p.TaxRate).HasPrecision(5, 4);
        builder.Property(p => p.Barcode).HasMaxLength(128);
        builder.HasIndex(p => p.Barcode).IsUnique();
        builder.Property(p => p.Sku).HasMaxLength(64);
        builder.HasIndex(p => p.Sku).IsUnique();
        builder.HasMany(p => p.Variants).WithOne(v => v.Product).HasForeignKey(v => v.ProductId);
        builder.HasMany(p => p.ProductModifiers).WithOne(pm => pm.Product).HasForeignKey(pm => pm.ProductId);
    }
}

public class ProductVariantConfiguration : IEntityTypeConfiguration<ProductVariant>
{
    public void Configure(EntityTypeBuilder<ProductVariant> builder)
    {
        builder.Property(v => v.PriceOverride).HasPrecision(10, 2);
    }
}

public class ModifierOptionConfiguration : IEntityTypeConfiguration<ModifierOption>
{
    public void Configure(EntityTypeBuilder<ModifierOption> builder)
    {
        builder.Property(mo => mo.Price).HasPrecision(10, 2);
    }
}

public class ProductModifierConfiguration : IEntityTypeConfiguration<ProductModifier>
{
    public void Configure(EntityTypeBuilder<ProductModifier> builder)
    {
        builder.HasOne(pm => pm.Product).WithMany(p => p.ProductModifiers).HasForeignKey(pm => pm.ProductId);
        builder.HasOne(pm => pm.Modifier).WithMany(m => m.ProductModifiers).HasForeignKey(pm => pm.ModifierId);
    }
}
