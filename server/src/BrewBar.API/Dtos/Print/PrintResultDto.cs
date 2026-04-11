namespace BrewBar.API.Dtos.Print;

public class PrintResultDto
{
    public bool Success { get; set; }
}

public class PrinterStatusDto
{
    public bool Available { get; set; }
}

public class PrinterInfoDto
{
    public bool Connected { get; set; }
    public string? Mode { get; set; }
    public string? PrinterName { get; set; }
    public string? NetworkHost { get; set; }
    public int? NetworkPort { get; set; }
    public List<string> InstalledPrinters { get; set; } = [];
}

public class SelectPrinterDto
{
    /// <summary>
    /// The Windows printer name to use, or null to revert to auto-detection.
    /// </summary>
    public string? PrinterName { get; set; }
}
