namespace BrewBar.Core.Interfaces;

public interface IRawPrinterService
{
    Task PrintAsync(byte[] data, CancellationToken ct = default);
    Task<bool> IsAvailableAsync(CancellationToken ct = default);
    PrinterInfo GetPrinterInfo();
    List<string> GetInstalledPrinters();
    void SelectPrinter(string? printerName);
}

public class PrinterInfo
{
    public bool Connected { get; set; }
    public string? Mode { get; set; }
    public string? PrinterName { get; set; }
    public string? NetworkHost { get; set; }
    public int? NetworkPort { get; set; }
}
