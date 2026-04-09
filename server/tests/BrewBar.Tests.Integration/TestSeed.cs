using BrewBar.Core.Constants;
using BrewBar.Core.Entities.CatalogAggregate;
using BrewBar.Core.Entities.Identity;
using BrewBar.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace BrewBar.Tests.Integration;

/// <summary>
/// Seeds a deterministic catalog (modifiers + categories + products) for integration tests.
/// Production code intentionally does not seed a sample catalog — fresh installs start empty.
/// Tests rely on stable IDs (product 1 = "Green Machine", modifier 1 = "Size", category 1 = "Smoothies", etc.).
/// </summary>
internal static class TestSeed
{
    public const string AdminEmail = "admin@brewbar.local";
    public const string AdminPassword = "Admin123!";
    public const string AdminPin = "1234";
    public const string CashierEmail = "cashier@brewbar.local";
    public const string CashierPassword = "Cashier123!";
    public const string CashierPin = "0000";

    /// <summary>
    /// Seeds the deterministic admin and cashier accounts the integration suite assumes
    /// (the production seed only seeds Identity roles — fresh installs require /api/auth/setup).
    /// Returns the seeded user IDs so PIN-login helpers can scope by id.
    /// </summary>
    public static async Task<(string AdminId, string CashierId)> SeedTestUsersAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<AppUser>>();

        var admin = await EnsureUser(userManager, hasher, AdminEmail, "Admin", AdminPassword, AdminPin, Roles.Admin);
        var cashier = await EnsureUser(userManager, hasher, CashierEmail, "Demo Cashier", CashierPassword, CashierPin, Roles.Cashier);

        return (admin.Id, cashier.Id);
    }

    private static async Task<AppUser> EnsureUser(
        UserManager<AppUser> userManager,
        IPasswordHasher<AppUser> hasher,
        string email,
        string displayName,
        string password,
        string pin,
        string role)
    {
        var existing = await userManager.FindByEmailAsync(email);
        if (existing != null) return existing;

        var user = new AppUser
        {
            Email = email,
            UserName = email,
            DisplayName = displayName,
        };
        user.PinHash = hasher.HashPassword(user, pin);

        var createResult = await userManager.CreateAsync(user, password);
        if (!createResult.Succeeded)
            throw new InvalidOperationException(
                $"Failed to seed test user {email}: {string.Join(", ", createResult.Errors.Select(e => e.Description))}");

        var roleResult = await userManager.AddToRoleAsync(user, role);
        if (!roleResult.Succeeded)
            throw new InvalidOperationException(
                $"Failed to assign role {role} to {email}: {string.Join(", ", roleResult.Errors.Select(e => e.Description))}");

        return user;
    }

    public static async Task SeedCatalogAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<BrewBarContext>();

        if (await context.Categories.AnyAsync()) return;

        var sizeModifier = new Modifier
        {
            Name = "Size",
            IsRequired = true,
            AllowMultiple = false,
            SortOrder = 0,
            Options = new List<ModifierOption>
            {
                new() { Name = "16 oz", Price = 0m, SortOrder = 0 },
                new() { Name = "24 oz", Price = 1.50m, SortOrder = 1 }
            }
        };

        var boostModifier = new Modifier
        {
            Name = "Boost",
            IsRequired = false,
            AllowMultiple = true,
            SortOrder = 1,
            Options = new List<ModifierOption>
            {
                new() { Name = "Protein", Price = 1.50m, SortOrder = 0 },
                new() { Name = "Collagen", Price = 1.50m, SortOrder = 1 },
                new() { Name = "Immunity", Price = 1.00m, SortOrder = 2 },
                new() { Name = "Energy", Price = 1.00m, SortOrder = 3 }
            }
        };

        var milkModifier = new Modifier
        {
            Name = "Milk",
            IsRequired = true,
            AllowMultiple = false,
            SortOrder = 2,
            Options = new List<ModifierOption>
            {
                new() { Name = "Whole Milk", Price = 0m, SortOrder = 0 },
                new() { Name = "Oat Milk", Price = 0.75m, SortOrder = 1 },
                new() { Name = "Almond Milk", Price = 0.75m, SortOrder = 2 },
                new() { Name = "Coconut Milk", Price = 0.75m, SortOrder = 3 }
            }
        };

        context.Modifiers.AddRange(sizeModifier, boostModifier, milkModifier);
        await context.SaveChangesAsync();

        var smoothies = new Category
        {
            Name = "Smoothies", Description = "Fresh blended smoothies", SortOrder = 0, IsActive = true,
            Products = new List<Product>
            {
                new() { Name = "Green Machine", Description = "Spinach, banana, mango, pineapple", BasePrice = 7.50m, SortOrder = 0, IsAvailable = true,
                    ProductModifiers = new List<ProductModifier> { new() { Modifier = sizeModifier }, new() { Modifier = boostModifier } } },
                new() { Name = "Berry Blast", Description = "Strawberry, blueberry, raspberry, banana", BasePrice = 7.50m, SortOrder = 1, IsAvailable = true,
                    ProductModifiers = new List<ProductModifier> { new() { Modifier = sizeModifier }, new() { Modifier = boostModifier } } },
                new() { Name = "Tropical Paradise", Description = "Mango, pineapple, coconut, passion fruit", BasePrice = 8.00m, SortOrder = 2, IsAvailable = true,
                    ProductModifiers = new List<ProductModifier> { new() { Modifier = sizeModifier }, new() { Modifier = boostModifier } } },
                new() { Name = "PB Power", Description = "Peanut butter, banana, chocolate, oats", BasePrice = 8.50m, SortOrder = 3, IsAvailable = true,
                    ProductModifiers = new List<ProductModifier> { new() { Modifier = sizeModifier }, new() { Modifier = boostModifier } } }
            }
        };

        var juices = new Category
        {
            Name = "Fresh Juices", Description = "Cold-pressed fresh juices", SortOrder = 1, IsActive = true,
            Products = new List<Product>
            {
                new() { Name = "Orange Sunrise", Description = "Orange, carrot, ginger", BasePrice = 6.50m, SortOrder = 0, IsAvailable = true,
                    ProductModifiers = new List<ProductModifier> { new() { Modifier = sizeModifier } } },
                new() { Name = "Green Detox", Description = "Celery, cucumber, apple, lemon", BasePrice = 7.00m, SortOrder = 1, IsAvailable = true,
                    ProductModifiers = new List<ProductModifier> { new() { Modifier = sizeModifier } } },
                new() { Name = "Beet It", Description = "Beet, apple, ginger, lemon", BasePrice = 7.00m, SortOrder = 2, IsAvailable = true,
                    ProductModifiers = new List<ProductModifier> { new() { Modifier = sizeModifier } } }
            }
        };

        var bowls = new Category
        {
            Name = "Acai Bowls", Description = "Acai and smoothie bowls", SortOrder = 2, IsActive = true,
            Products = new List<Product>
            {
                new() { Name = "Classic Acai", Description = "Acai, granola, banana, honey", BasePrice = 10.00m, SortOrder = 0, IsAvailable = true,
                    ProductModifiers = new List<ProductModifier> { new() { Modifier = boostModifier } } },
                new() { Name = "Pitaya Bowl", Description = "Dragon fruit, mango, coconut, granola", BasePrice = 10.50m, SortOrder = 1, IsAvailable = true,
                    ProductModifiers = new List<ProductModifier> { new() { Modifier = boostModifier } } }
            }
        };

        var drinks = new Category
        {
            Name = "Drinks", Description = "Coffee, tea, and other beverages", SortOrder = 3, IsActive = true,
            Products = new List<Product>
            {
                new() { Name = "Cold Brew", Description = "House cold brew coffee", BasePrice = 4.50m, SortOrder = 0, IsAvailable = true,
                    ProductModifiers = new List<ProductModifier> { new() { Modifier = milkModifier } } },
                new() { Name = "Matcha Latte", Description = "Ceremonial grade matcha", BasePrice = 5.50m, SortOrder = 1, IsAvailable = true,
                    ProductModifiers = new List<ProductModifier> { new() { Modifier = milkModifier } } },
                new() { Name = "Water", Description = "Bottled water", BasePrice = 2.00m, SortOrder = 2, IsAvailable = true }
            }
        };

        context.Categories.AddRange(smoothies, juices, bowls, drinks);
        await context.SaveChangesAsync();
    }
}
