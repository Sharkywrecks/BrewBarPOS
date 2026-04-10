using BrewBar.API.Dtos.Print;
using BrewBar.API.Errors;
using BrewBar.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BrewBar.API.Controllers;

[Authorize]
public class PrintController : BaseApiController
{
    private readonly IRawPrinterService _printerService;

    public PrintController(IRawPrinterService printerService)
    {
        _printerService = printerService;
    }

    [HttpPost]
    [ProducesResponseType(typeof(PrintResultDto), 200)]
    public async Task<ActionResult<PrintResultDto>> Print(PrintRequestDto dto, CancellationToken ct)
    {
        byte[] data;
        try
        {
            data = Convert.FromBase64String(dto.Data);
        }
        catch (FormatException)
        {
            return BadRequest(new ApiResponse(400, "Invalid base64 data"));
        }

        if (data.Length == 0)
        {
            return BadRequest(new ApiResponse(400, "Print data must not be empty"));
        }

        try
        {
            await _printerService.PrintAsync(data, ct);
            return Ok(new PrintResultDto { Success = true });
        }
        catch (Exception ex)
        {
            return StatusCode(502, new ApiResponse(502, $"Printer error: {ex.Message}"));
        }
    }

    [HttpGet("status")]
    [ProducesResponseType(typeof(PrinterStatusDto), 200)]
    public async Task<ActionResult<PrinterStatusDto>> GetStatus(CancellationToken ct)
    {
        var available = await _printerService.IsAvailableAsync(ct);
        return Ok(new PrinterStatusDto { Available = available });
    }
}
