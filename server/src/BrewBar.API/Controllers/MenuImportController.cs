using BrewBar.Infrastructure.Data;
using BrewBar.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BrewBar.API.Controllers;

public class MenuImportController : BaseApiController
{
    private readonly BrewBarContext _context;

    public MenuImportController(BrewBarContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Import menu from an Excel (.xlsx) file.
    /// Creates categories, products, modifiers, and links.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Admin")]
    [RequestSizeLimit(10 * 1024 * 1024)] // 10MB
    public async Task<ActionResult<MenuImportResult>> Import(IFormFile file, CancellationToken ct)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "No file provided" });

        if (!file.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "File must be an .xlsx Excel file" });

        var service = new MenuImportService(_context);
        using var stream = file.OpenReadStream();
        var result = await service.ImportAsync(stream, ct);

        return Ok(result);
    }

    /// <summary>
    /// Download the menu template Excel file.
    /// </summary>
    [HttpGet("template")]
    [AllowAnonymous]
    public IActionResult GetTemplate()
    {
        var templatePath = Path.Combine(AppContext.BaseDirectory, "Resources", "menu-template.xlsx");
        if (!System.IO.File.Exists(templatePath))
            return NotFound(new { message = "Template file not found" });

        var bytes = System.IO.File.ReadAllBytes(templatePath);
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "menu-template.xlsx");
    }
}
