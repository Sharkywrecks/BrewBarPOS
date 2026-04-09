using System.Text.Json;
using System.Text.Json.Serialization;
using BrewBar.Core.Constants;
using BrewBar.Core.Entities;
using BrewBar.Core.Entities.Identity;
using BrewBar.Core.Enums;
using BrewBar.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace BrewBar.API.Bootstrap;

/// <summary>
/// First-launch bootstrap. Reads a JSON file written by the MSI installer (or any
/// other deployment tool) and atomically creates the initial admin user + business
/// settings. Runs once per install: gated on a zero-users precondition (same as
/// /api/auth/setup) so a stolen file cannot be replayed against a configured DB.
///
/// The file is deleted in every terminal case (success, validation failure, ignored
/// because users already exist) so plaintext credentials never linger on disk longer
/// than one API startup.
/// </summary>
public static class BootstrapService
{
    public static async Task RunAsync(IServiceProvider services, IConfiguration config, ILogger logger)
    {
        var path = ResolveBootstrapPath(config);
        if (path is null || !File.Exists(path))
            return;

        logger.LogInformation("Bootstrap file detected at {Path}, processing...", path);

        try
        {
            await ProcessAsync(services, path, logger);
        }
        catch (Exception ex)
        {
            // Never log file contents — it has plaintext credentials.
            logger.LogError(ex, "Bootstrap failed; deleting file to prevent retry with bad data");
        }
        finally
        {
            TryDelete(path, logger);
        }
    }

    private static async Task ProcessAsync(IServiceProvider services, string path, ILogger logger)
    {
        var json = await File.ReadAllTextAsync(path);

        BootstrapPayload? payload;
        try
        {
            payload = JsonSerializer.Deserialize<BootstrapPayload>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                Converters = { new JsonStringEnumConverter() }
            });
        }
        catch (JsonException)
        {
            logger.LogError("Bootstrap file is not valid JSON");
            return;
        }

        if (payload?.Admin is null)
        {
            logger.LogError("Bootstrap file is missing admin section");
            return;
        }

        var validation = payload.Admin.Validate();
        if (validation is not null)
        {
            logger.LogError("Bootstrap admin section invalid: {Reason}", validation);
            return;
        }

        using var scope = services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var passwordHasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<AppUser>>();
        var dbContext = scope.ServiceProvider.GetRequiredService<BrewBarContext>();

        if (await userManager.Users.AnyAsync())
        {
            logger.LogWarning("Bootstrap file present but users already exist; ignoring");
            return;
        }

        var admin = new AppUser
        {
            DisplayName = payload.Admin.DisplayName!,
            Email = payload.Admin.Email,
            UserName = payload.Admin.Email
        };
        admin.PinHash = passwordHasher.HashPassword(admin, payload.Admin.Pin!);

        var createResult = await userManager.CreateAsync(admin, payload.Admin.Password!);
        if (!createResult.Succeeded)
        {
            logger.LogError("Failed to create bootstrap admin: {Errors}",
                string.Join(", ", createResult.Errors.Select(e => e.Description)));
            return;
        }

        var roleResult = await userManager.AddToRoleAsync(admin, Roles.Admin);
        if (!roleResult.Succeeded)
        {
            // Roll back so the next startup can retry from a clean state if the file
            // hasn't been deleted yet.
            await userManager.DeleteAsync(admin);
            logger.LogError("Failed to assign Admin role during bootstrap: {Errors}",
                string.Join(", ", roleResult.Errors.Select(e => e.Description)));
            return;
        }

        // Apply business settings if provided. Failure here is non-fatal — the admin
        // can edit them via the UI later.
        if (payload.BusinessSettings is not null)
        {
            try
            {
                await ApplyBusinessSettingsAsync(dbContext, payload.BusinessSettings);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to apply bootstrap business settings (admin still created)");
            }
        }

        logger.LogInformation("Bootstrap complete: admin {Email} created", payload.Admin.Email);
    }

    private static async Task ApplyBusinessSettingsAsync(BrewBarContext db, BootstrapBusinessSettings dto)
    {
        var existing = await db.Set<BusinessSettings>().OrderBy(s => s.Id).FirstOrDefaultAsync();
        if (existing is null)
        {
            existing = new BusinessSettings();
            db.Set<BusinessSettings>().Add(existing);
        }

        if (!string.IsNullOrWhiteSpace(dto.StoreName)) existing.StoreName = dto.StoreName!;
        if (dto.StoreInfo is not null) existing.StoreInfo = dto.StoreInfo;
        if (dto.TaxRate is not null) existing.TaxRate = dto.TaxRate.Value;
        if (dto.Currency is not null) existing.Currency = dto.Currency.Value;
        if (dto.DiscountApprovalThreshold is not null) existing.DiscountApprovalThreshold = dto.DiscountApprovalThreshold.Value;

        await db.SaveChangesAsync();
    }

    private static string? ResolveBootstrapPath(IConfiguration config)
    {
        // Explicit override (env var BREWBAR_BOOTSTRAP_FILE or Bootstrap:FilePath in config).
        var explicitPath = config["Bootstrap:FilePath"];
        if (!string.IsNullOrWhiteSpace(explicitPath)) return explicitPath;

        // Default: bootstrap.json next to the running API exe. The MSI installer drops
        // it at [INSTALLFOLDER]\resources\api\bootstrap.json which matches.
        var processDir = Path.GetDirectoryName(Environment.ProcessPath);
        if (string.IsNullOrEmpty(processDir)) return null;
        return Path.Combine(processDir, "bootstrap.json");
    }

    private static void TryDelete(string path, ILogger logger)
    {
        try
        {
            if (File.Exists(path)) File.Delete(path);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to delete bootstrap file at {Path} — credentials remain on disk!", path);
        }
    }

    // ─── Payload schema ────────────────────────────────────────────

    internal sealed class BootstrapPayload
    {
        public BootstrapAdmin? Admin { get; set; }
        public BootstrapBusinessSettings? BusinessSettings { get; set; }
    }

    internal sealed class BootstrapAdmin
    {
        public string? DisplayName { get; set; }
        public string? Email { get; set; }
        public string? Password { get; set; }
        public string? Pin { get; set; }

        public string? Validate()
        {
            if (string.IsNullOrWhiteSpace(DisplayName)) return "displayName is required";
            if (string.IsNullOrWhiteSpace(Email)) return "email is required";
            if (string.IsNullOrWhiteSpace(Password) || Password!.Length < 6) return "password must be >= 6 chars";
            if (string.IsNullOrWhiteSpace(Pin) || Pin!.Length is < 4 or > 6) return "pin must be 4-6 chars";
            if (!Pin.All(char.IsDigit)) return "pin must be digits only";
            return null;
        }
    }

    internal sealed class BootstrapBusinessSettings
    {
        public string? StoreName { get; set; }
        public string? StoreInfo { get; set; }
        public decimal? TaxRate { get; set; }
        public Currency? Currency { get; set; }
        public decimal? DiscountApprovalThreshold { get; set; }
    }
}
