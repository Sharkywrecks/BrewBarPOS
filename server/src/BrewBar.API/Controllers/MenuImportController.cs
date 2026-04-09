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
    [RequestFormLimits(MultipartBodyLengthLimit = 2 * 1024 * 1024)] // 2MB — menu imports are tiny; tight cap protects against zip bombs
    public async Task<ActionResult<MenuImportResult>> Import(IFormFile file, CancellationToken ct)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "No file provided" });

        if (!file.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "File must be an .xlsx Excel file" });

        // Magic-byte check: .xlsx is a ZIP archive, so the first 4 bytes must be PK\x03\x04
        // (or PK\x05\x06 for an empty archive). Extension alone is trivially spoofable.
        await using var stream = file.OpenReadStream();
        var header = new byte[4];
        var read = await stream.ReadAsync(header.AsMemory(0, 4), ct);
        if (read < 4 || header[0] != 0x50 || header[1] != 0x4B
            || (header[2] != 0x03 && header[2] != 0x05)
            || (header[3] != 0x04 && header[3] != 0x06))
        {
            return BadRequest(new { message = "File does not appear to be a valid .xlsx archive" });
        }
        stream.Position = 0;

        var service = new MenuImportService(_context);
        var result = await service.ImportAsync(stream, ct);

        return Ok(result);
    }

    /// <summary>
    /// Export the current catalog as an .xlsx workbook with Id columns populated.
    /// Re-uploading the exported file will update existing records rather than create duplicates.
    /// </summary>
    [HttpGet("export")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Export(CancellationToken ct)
    {
        var service = new MenuImportService(_context);
        var bytes = await service.ExportAsync(ct);
        var filename = $"menu-export-{DateTime.UtcNow:yyyyMMdd-HHmmss}.xlsx";
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename);
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
