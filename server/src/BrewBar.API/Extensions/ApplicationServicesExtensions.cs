using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using BrewBar.Core.Interfaces;
using BrewBar.Infrastructure.Data;
using BrewBar.Infrastructure.Services;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace BrewBar.API.Extensions;

public static class ApplicationServicesExtensions
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services, IConfiguration config)
    {
        services.AddControllers()
            // Serialise enums as their string names ("SCR", "USD") instead of the
            // default integer ordinals. This is what the Angular client expects:
            // SettingsService and AppCurrencyPipe key off Currency.SCR / Currency.USD
            // / etc., not Currency._0 / Currency._1. With ordinal serialisation, the
            // generated TypeScript enum has no named members and the client doesn't
            // compile against the rest of the codebase.
            //
            // Swashbuckle automatically reflects this in the OpenAPI schema (it
            // inspects registered IJsonHelper / JsonOptions converters), so the
            // schema describes Currency as `"type": "string", "enum": ["SCR", ...]`
            // and NSwag emits a proper named TypeScript enum.
            .AddJsonOptions(opt =>
            {
                opt.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
            });

        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = 429;
            options.AddFixedWindowLimiter("fixed", opt =>
            {
                opt.PermitLimit = 100;
                opt.Window = TimeSpan.FromMinutes(1);
                opt.QueueLimit = 10;
                opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
            });

            // Per-IP limiter for auth endpoints — brute-force protection that complements
            // Identity's per-user AccessFailedCount lockout. Applied via [EnableRateLimiting("auth")]
            // on /login, /pin-login, and /setup. The limit is config-driven so the integration
            // test fixture can raise it (a single fixed test IP would otherwise trip on the
            // 10/minute production cap and break unrelated tests with 429s).
            var authPermitLimit = config.GetValue<int?>("RateLimit:AuthPermitLimit") ?? 10;
            options.AddPolicy("auth", context =>
            {
                var key = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
                return RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = authPermitLimit,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst
                });
            });
        });

        var provider = config["DatabaseProvider"] ?? "MySql";

        services.AddDbContext<BrewBarContext>(options =>
        {
            if (provider.Equals("Sqlite", StringComparison.OrdinalIgnoreCase))
            {
                var conn = config.GetConnectionString("DefaultConnection") ?? "Data Source=brewbar.db";
                options.UseSqlite(conn);
            }
            else
            {
                var conn = config.GetConnectionString("DefaultConnection")
                    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");
                options.UseMySql(conn, ServerVersion.AutoDetect(conn));
            }
        });

        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<ITokenService, TokenService>();
        services.AddSingleton<IWindowsRawPrinter, WindowsRawPrintHelper>();
        services.AddSingleton<IRawPrinterService, RawPrinterService>();

        services.AddCors(opt =>
        {
            opt.AddPolicy("CorsPolicy", policy =>
            {
                policy.AllowAnyHeader().AllowAnyMethod().WithOrigins(
                    config.GetSection("AllowedOrigins").Get<string[]>() ?? new[] { "http://localhost:4200", "http://localhost:4201" });
            });
        });

        return services;
    }
}
