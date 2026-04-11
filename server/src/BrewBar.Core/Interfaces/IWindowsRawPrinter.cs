namespace BrewBar.Core.Interfaces;

/// <summary>
/// Abstracts direct Windows printer access for testability.
/// </summary>
public interface IWindowsRawPrinter
{
    void SendRawData(string printerName, byte[] data);
    bool IsPrinterAvailable(string printerName);
    string? FindPrinterByName(string searchTerm);
    List<string> GetInstalledPrinters();
}
