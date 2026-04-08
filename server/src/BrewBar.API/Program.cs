using BrewBar.API.Extensions;
using BrewBar.API.Middleware;
using BrewBar.Infrastructure.Data;
using BrewBar.Infrastructure.Data.Seed;
using BrewBar.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

// For published single-file exe, use the exe's directory (AppContext.BaseDirectory may be a temp extraction dir).
// For development/NSwag, fall back to AppContext.BaseDirectory which is the project output directory.
var processDir = Path.GetDirectoryName(Environment.ProcessPath);
var isPublishedExe = processDir != null
    && File.Exists(Path.Combine(processDir, "appsettings.json"));
var contentRoot = isPublishedExe ? processDir! : AppContext.BaseDirectory;

var envName = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
if (string.IsNullOrEmpty(envName) && File.Exists(Path.Combine(contentRoot, "appsettings.Desktop.json")))
{
    envName = "Desktop";
}

var wwwrootCandidate = Path.Combine(contentRoot, "wwwroot");
var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = contentRoot,
    WebRootPath = Directory.Exists(wwwrootCandidate) ? wwwrootCandidate : null,
    EnvironmentName = envName
});

builder.Services.AddApplicationServices(builder.Configuration);
builder.Services.AddIdentityServices(builder.Configuration);
builder.Services.AddSwaggerServices();

var app = builder.Build();

// Apply migrations and seed data (skip for NSwag client generation)
if (!app.Environment.IsEnvironment("NSwag"))
{
    using var scope = app.Services.CreateScope();
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();

    try
    {
        var context = services.GetRequiredService<BrewBarContext>();
        var identityContext = services.GetRequiredService<AppIdentityDbContext>();

        await context.Database.MigrateAsync();
        await identityContext.Database.MigrateAsync();

        await SeedData.SeedAsync(services);
    }
    catch (Exception ex)
    {
        logger.LogCritical(ex, "Error during migration/seed — shutting down");
        throw;
    }
}

app.UseMiddleware<ExceptionMiddleware>();

// Serve Angular static files (desktop mode)
var wwwroot = Path.Combine(app.Environment.ContentRootPath, "wwwroot");
if (Directory.Exists(wwwroot))
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseRouting();
app.UseCors("CorsPolicy");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/health/ready", () => Results.Ok(new { status = "healthy" }));

// SPA fallbacks — after all other routes so API endpoints aren't caught
if (Directory.Exists(wwwroot))
{
    app.MapFallbackToFile("/admin/{**slug}", "admin/index.html");
    app.MapFallbackToFile("{**slug}", "index.html");
}

app.Run();
