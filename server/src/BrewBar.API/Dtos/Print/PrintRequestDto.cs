namespace BrewBar.API.Dtos.Print;

public class PrintRequestDto
{
    /// <summary>
    /// Base64-encoded ESC/POS byte payload.
    /// </summary>
    public required string Data { get; set; }
}
