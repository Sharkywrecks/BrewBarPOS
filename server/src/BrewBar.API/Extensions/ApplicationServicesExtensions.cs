using BrewBar.Core.Interfaces;
using BrewBar.Infrastructure.Data;
using BrewBar.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace BrewBar.API.Extensions;

public static class ApplicationServicesExtensions
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services, IConfiguration config)
    {
        services.AddControllers();

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
