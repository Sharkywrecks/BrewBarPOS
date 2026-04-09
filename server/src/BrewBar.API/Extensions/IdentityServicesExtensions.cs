using System.Text;
using BrewBar.Core.Constants;
using BrewBar.Core.Entities.Identity;
using BrewBar.Infrastructure.Identity;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace BrewBar.API.Extensions;

public static class IdentityServicesExtensions
{
    // Keys that were previously committed to the repo. Any of these appearing as the active
    // Jwt:Secret means the operator forgot to set BREWBAR_JWT_KEY — fail fast rather than
    // silently accept a known-compromised signing key.
    internal static readonly string[] CompromisedJwtSecrets = new[]
    {
        "super-secret-key-for-development-at-least-32-chars",
        "brewbar-dev-local-jwt-secret-key-min-32-chars!!",
        "brewbar-desktop-local-jwt-secret-key-min-32-chars"
    };

    public static void ValidateJwtSecret(string? secret)
    {
        if (string.IsNullOrWhiteSpace(secret))
            throw new InvalidOperationException(
                "Jwt:Secret is missing. Set the BREWBAR_JWT_KEY environment variable or Jwt:Secret in user-secrets.");

        if (Encoding.UTF8.GetByteCount(secret) < 32)
            throw new InvalidOperationException(
                "Jwt:Secret must be at least 32 bytes (HMAC-SHA256 requirement).");

        if (CompromisedJwtSecrets.Contains(secret))
            throw new InvalidOperationException(
                "Jwt:Secret is set to a known placeholder that was previously committed to the repo. " +
                "Generate a new random key and configure it via BREWBAR_JWT_KEY.");
    }

    public static IServiceCollection AddIdentityServices(this IServiceCollection services, IConfiguration config)
    {
        var jwtSecret = config["Jwt:Secret"];
        ValidateJwtSecret(jwtSecret);

        var provider = config["DatabaseProvider"] ?? "MySql";
        var connectionString = config.GetConnectionString("IdentityConnection")
            ?? config.GetConnectionString("DefaultConnection");

        services.AddDbContext<AppIdentityDbContext>(options =>
        {
            if (provider.Equals("Sqlite", StringComparison.OrdinalIgnoreCase))
            {
                options.UseSqlite(connectionString ?? "Data Source=brewbar.db");
            }
            else
            {
                var conn = connectionString
                    ?? throw new InvalidOperationException("Connection string not found.");
                options.UseMySql(conn, ServerVersion.AutoDetect(conn));
            }
        });

        services.AddIdentityCore<AppUser>(opt =>
        {
            // Stricter than the previous 6-char-no-symbol policy. Still permissive
            // enough for cafe staff who'll memorise their password — 8 chars + a
            // digit + a non-alphanumeric is roughly NIST 800-63B "memorised secret".
            opt.Password.RequiredLength = 8;
            opt.Password.RequireDigit = true;
            opt.Password.RequireLowercase = true;
            opt.Password.RequireUppercase = false;
            opt.Password.RequireNonAlphanumeric = true;

            // Lockout protects both /login and /pin-login against brute-force. Honoured
            // explicitly in AuthController via UserManager.IsLockedOutAsync /
            // AccessFailedAsync / ResetAccessFailedCountAsync.
            opt.Lockout.AllowedForNewUsers = true;
            opt.Lockout.MaxFailedAccessAttempts = 5;
            opt.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
        })
        .AddRoles<IdentityRole>()
        .AddEntityFrameworkStores<AppIdentityDbContext>()
        .AddSignInManager<SignInManager<AppUser>>();

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(opt =>
            {
                opt.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret!)),
                    ValidateIssuer = true,
                    ValidIssuer = config["Jwt:Issuer"],
                    ValidateAudience = true,
                    ValidAudience = config["Jwt:Audience"],
                    ValidateLifetime = true
                };
            });

        services.AddAuthorization(options =>
        {
            // Admin/manager endpoints require BOTH the role AND a token issued via password
            // login. Pin tokens are scoped to POS and must not reach elevated endpoints,
            // even if a cashier somehow holds an Admin/Manager role.
            options.AddPolicy(Policies.RequireAdmin, policy => policy
                .RequireAuthenticatedUser()
                .RequireRole(Roles.Admin)
                .RequireClaim(AuthClaims.AuthMethod, AuthClaims.AuthMethodPassword));

            options.AddPolicy(Policies.RequireAdminOrManager, policy => policy
                .RequireAuthenticatedUser()
                .RequireRole(Roles.Admin, Roles.Manager)
                .RequireClaim(AuthClaims.AuthMethod, AuthClaims.AuthMethodPassword));
        });

        return services;
    }
}
