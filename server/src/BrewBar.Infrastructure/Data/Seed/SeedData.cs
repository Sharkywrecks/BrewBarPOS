using BrewBar.Core.Constants;
using BrewBar.Core.Entities.Identity;
using BrewBar.Core.Enums;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace BrewBar.Infrastructure.Data.Seed;

public static class SeedData
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        var logger = services.GetRequiredService<ILoggerFactory>().CreateLogger("SeedData");

        try
        {
            await SeedRolesAndAdmin(services, logger);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error seeding data");
            throw;
        }
    }

    private static async Task SeedRolesAndAdmin(IServiceProvider services, ILogger logger)
    {
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
        var userManager = services.GetRequiredService<UserManager<AppUser>>();

        // Seed roles
        foreach (var role in Enum.GetNames<UserRole>())
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new IdentityRole(role));
                logger.LogInformation("Created role: {Role}", role);
            }
        }

        // Seed default admin
        const string adminEmail = "admin@brewbar.local";
        if (await userManager.FindByEmailAsync(adminEmail) == null)
        {
            var admin = new AppUser
            {
                DisplayName = "Admin",
                Email = adminEmail,
                UserName = adminEmail,
                Pin = "1234"
            };

            var result = await userManager.CreateAsync(admin, "Admin123!");
            if (result.Succeeded)
            {
                await userManager.AddToRoleAsync(admin, Roles.Admin);
                logger.LogInformation("Created default admin user: {Email}", adminEmail);
            }
            else
            {
                logger.LogWarning("Failed to create admin: {Errors}", string.Join(", ", result.Errors.Select(e => e.Description)));
            }
        }

        // Seed demo cashier
        const string cashierEmail = "cashier@brewbar.local";
        if (await userManager.FindByEmailAsync(cashierEmail) == null)
        {
            var cashier = new AppUser
            {
                DisplayName = "Demo Cashier",
                Email = cashierEmail,
                UserName = cashierEmail,
                Pin = "0000"
            };

            var result = await userManager.CreateAsync(cashier, "Cashier123!");
            if (result.Succeeded)
            {
                await userManager.AddToRoleAsync(cashier, Roles.Cashier);
                logger.LogInformation("Created demo cashier: {Email}", cashierEmail);
            }
        }
    }

}
