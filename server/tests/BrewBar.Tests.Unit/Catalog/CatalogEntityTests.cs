using BrewBar.Core.Entities.CatalogAggregate;
using FluentAssertions;

namespace BrewBar.Tests.Unit.Catalog;

public class CatalogEntityTests
{
    [Fact]
    public void Product_DefaultValues_ShouldBeCorrect()
    {
        var product = new Product();

        product.IsAvailable.Should().BeTrue();
        product.Variants.Should().BeEmpty();
        product.ProductModifiers.Should().BeEmpty();
    }

    [Fact]
    public void ProductVariant_DefaultValues_ShouldBeCorrect()
    {
        var variant = new ProductVariant();

        variant.IsAvailable.Should().BeTrue();
    }

    [Fact]
    public void Category_DefaultValues_ShouldBeCorrect()
    {
        var category = new Category();

        category.IsActive.Should().BeTrue();
        category.Products.Should().BeEmpty();
    }

    [Fact]
    public void Modifier_ShouldTrackOptions()
    {
        var modifier = new Modifier
        {
            Name = "Size",
            IsRequired = true,
            AllowMultiple = false,
            Options = new List<ModifierOption>
            {
                new() { Name = "Small", Price = 0m, SortOrder = 0 },
                new() { Name = "Medium", Price = 1.00m, SortOrder = 1 },
                new() { Name = "Large", Price = 2.00m, SortOrder = 2 }
            }
        };

        modifier.Options.Should().HaveCount(3);
        modifier.Options.Max(o => o.Price).Should().Be(2.00m);
    }

    [Fact]
    public void Product_WithVariants_ShouldAllowPriceOverrides()
    {
        var product = new Product
        {
            Name = "Green Machine",
            BasePrice = 8.00m,
            Variants = new List<ProductVariant>
            {
                new() { Name = "16 oz", PriceOverride = 8.00m },
                new() { Name = "24 oz", PriceOverride = 10.50m }
            }
        };

        product.Variants.Should().HaveCount(2);
        product.Variants.First().PriceOverride.Should().Be(8.00m);
        product.Variants.Last().PriceOverride.Should().Be(10.50m);
    }

    [Fact]
    public void BaseEntity_ShouldSetTimestampsOnCreation()
    {
        var before = DateTime.UtcNow;
        var product = new Product();
        var after = DateTime.UtcNow;

        product.CreatedAtUtc.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
        product.UpdatedAtUtc.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
    }
}
