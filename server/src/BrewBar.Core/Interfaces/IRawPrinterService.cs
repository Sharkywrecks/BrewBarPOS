namespace BrewBar.Core.Interfaces;

public interface IRawPrinterService
{
    Task PrintAsync(byte[] data, CancellationToken ct = default);
    Task<bool> IsAvailableAsync(CancellationToken ct = default);
}
