using System.Text;
using BrewBar.Core.Entities.Identity;
using BrewBar.Infrastructure.Identity;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace BrewBar.API.Extensions;

public static class IdentityServicesExtensions
{
    public static IServiceCollection AddIdentityServices(this IServiceCollection services, IConfiguration config)
    {
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
            opt.Password.RequireNonAlphanumeric = false;
            opt.Password.RequiredLength = 6;
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
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(
                        config["Jwt:Secret"] ?? throw new InvalidOperationException("JWT secret not configured"))),
                    ValidateIssuer = true,
                    ValidIssuer = config["Jwt:Issuer"],
                    ValidateAudience = true,
                    ValidAudience = config["Jwt:Audience"],
                    ValidateLifetime = true
                };
            });

        services.AddAuthorization();

        return services;
    }
}
