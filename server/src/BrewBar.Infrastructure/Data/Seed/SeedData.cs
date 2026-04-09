using BrewBar.Core.Enums;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace BrewBar.Infrastructure.Data.Seed;

public static class SeedData
{
    /// <summary>
    /// Seeds data that is safe in every environment: Identity roles only.
    /// Fresh installs start with zero users — the first admin must be created
    /// via POST /api/auth/setup (one-shot, rejected once any user exists).
    /// </summary>
    public static async Task SeedAsync(IServiceProvider services)
    {
        var logger = services.GetRequiredService<ILoggerFactory>().CreateLogger("SeedData");

        try
        {
            await SeedRoles(services, logger);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error seeding data");
            throw;
        }
    }

    private static async Task SeedRoles(IServiceProvider services, ILogger logger)
    {
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();

        foreach (var role in Enum.GetNames<UserRole>())
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new IdentityRole(role));
                logger.LogInformation("Created role: {Role}", role);
            }
        }
    }
}
