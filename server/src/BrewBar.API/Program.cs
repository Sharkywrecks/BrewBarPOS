using BrewBar.API.Extensions;
using BrewBar.API.Middleware;
using BrewBar.Infrastructure.Data;
using BrewBar.Infrastructure.Data.Seed;
using BrewBar.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

// Auto-detect Desktop environment when appsettings.Desktop.json is present alongside the EXE
var contentRoot = AppContext.BaseDirectory;
var envName = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
if (string.IsNullOrEmpty(envName) && File.Exists(Path.Combine(contentRoot, "appsettings.Desktop.json")))
{
    envName = "Desktop";
}

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = contentRoot,
    EnvironmentName = envName
});

builder.Services.AddApplicationServices(builder.Configuration);
builder.Services.AddIdentityServices(builder.Configuration);
builder.Services.AddSwaggerServices();

var app = builder.Build();

// Apply migrations and seed data
using (var scope = app.Services.CreateScope())
{
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
        logger.LogError(ex, "Error during migration/seed");
    }
}

app.UseMiddleware<ExceptionMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("CorsPolicy");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/health/ready", () => Results.Ok(new { status = "healthy" }));

// Serve Angular static files (desktop mode) — only when wwwroot exists
var wwwroot = Path.Combine(app.Environment.ContentRootPath, "wwwroot");
if (Directory.Exists(wwwroot))
{
    app.UseStaticFiles();
    app.MapFallbackToFile("/admin/{**slug}", "admin/index.html");
    app.MapFallbackToFile("{**slug}", "pos/index.html");
}

app.Run();
