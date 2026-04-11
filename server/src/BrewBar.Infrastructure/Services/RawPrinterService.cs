using System.Net.Sockets;
using BrewBar.Core.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BrewBar.Infrastructure.Services;

public class RawPrinterService : IRawPrinterService
{
    private readonly string _host;
    private readonly int _port;
    private readonly int _timeoutMs;
    private readonly string? _windowsPrinterName;
    private readonly IWindowsRawPrinter _windowsPrinter;
    private readonly ILogger<RawPrinterService> _logger;

    /// <summary>
    /// Resolved at first use: "Network", "Windows", or null (nothing available).
    /// </summary>
    private string? _resolvedMode;

    /// <summary>
    /// Explicitly selected Windows printer name (overrides auto-search).
    /// </summary>
    private string? _selectedPrinterName;

    public RawPrinterService(IConfiguration config, IWindowsRawPrinter windowsPrinter, ILogger<RawPrinterService> logger)
    {
        _host = config["Printer:Host"] ?? "127.0.0.1";
        _port = config.GetValue<int?>("Printer:Port") ?? 9100;
        _timeoutMs = config.GetValue<int?>("Printer:TimeoutMs") ?? 5000;
        _windowsPrinterName = config["Printer:WindowsName"];
        _windowsPrinter = windowsPrinter;
        _logger = logger;
    }

    public async Task PrintAsync(byte[] data, CancellationToken ct = default)
    {
        var mode = _resolvedMode ?? await ResolveMode(ct);

        if (mode == "Network")
        {
            await PrintViaTcp(data, ct);
        }
        else if (mode == "Windows")
        {
            var name = ResolveWindowsPrinterName()
                ?? throw new InvalidOperationException("No Windows printer found. Configure Printer:WindowsName in appsettings.");

            // Run synchronous P/Invoke on a thread-pool thread to avoid blocking
            await Task.Run(() => _windowsPrinter.SendRawData(name, data), ct);
            _logger.LogInformation("Sent {Bytes} bytes to Windows printer '{Printer}'", data.Length, name);
        }
        else
        {
            throw new InvalidOperationException("No printer available. Check network or Windows printer configuration.");
        }
    }

    public async Task<bool> IsAvailableAsync(CancellationToken ct = default)
    {
        var mode = await ResolveMode(ct);
        return mode != null;
    }

    public PrinterInfo GetPrinterInfo()
    {
        var winName = _selectedPrinterName ?? ResolveWindowsPrinterName();
        return new PrinterInfo
        {
            Connected = _resolvedMode != null,
            Mode = _resolvedMode,
            PrinterName = _resolvedMode == "Windows" ? winName : null,
            NetworkHost = _host,
            NetworkPort = _port,
        };
    }

    public List<string> GetInstalledPrinters() => _windowsPrinter.GetInstalledPrinters();

    public void SelectPrinter(string? printerName)
    {
        _selectedPrinterName = printerName;
        // Reset resolved mode so next print re-resolves with the new selection
        _resolvedMode = null;
        _logger.LogInformation("Printer selection changed to '{Printer}'", printerName ?? "(auto)");
    }

    // ── Mode resolution ────────────────────────────────────────

    private async Task<string?> ResolveMode(CancellationToken ct)
    {
        // 1. Try network first
        if (await IsNetworkReachable(ct))
        {
            _resolvedMode = "Network";
            _logger.LogInformation("Printer mode: Network ({Host}:{Port})", _host, _port);
            return _resolvedMode;
        }

        // 2. Fall back to Windows spooler
        var winName = ResolveWindowsPrinterName();
        if (winName != null && _windowsPrinter.IsPrinterAvailable(winName))
        {
            _resolvedMode = "Windows";
            _logger.LogInformation("Printer mode: Windows ('{Printer}')", winName);
            return _resolvedMode;
        }

        _logger.LogWarning("No printer available — network ({Host}:{Port}) unreachable and no Windows printer found", _host, _port);
        _resolvedMode = null;
        return null;
    }

    /// <summary>
    /// Resolve the Windows printer name: explicit config > auto-search for common thermal printer names.
    /// </summary>
    private string? ResolveWindowsPrinterName()
    {
        // Explicit runtime selection takes priority
        if (!string.IsNullOrEmpty(_selectedPrinterName))
            return _selectedPrinterName;

        if (!string.IsNullOrEmpty(_windowsPrinterName))
            return _windowsPrinterName;

        // Auto-search for common thermal/POS printer names
        string[] searchTerms = ["XEPOS", "POS", "Receipt", "Thermal", "LKS", "8030", "Generic"];
        foreach (var term in searchTerms)
        {
            var found = _windowsPrinter.FindPrinterByName(term);
            if (found != null)
                return found;
        }

        return null;
    }

    // ── Network (TCP) ──────────────────────────────────────────

    private async Task PrintViaTcp(byte[] data, CancellationToken ct)
    {
        using var client = new TcpClient();
        client.SendTimeout = _timeoutMs;

        await client.ConnectAsync(_host, _port, ct);

        var stream = client.GetStream();
        await stream.WriteAsync(data, ct);
        await stream.FlushAsync(ct);

        _logger.LogInformation("Sent {Bytes} bytes to printer at {Host}:{Port}", data.Length, _host, _port);
    }

    private async Task<bool> IsNetworkReachable(CancellationToken ct)
    {
        try
        {
            using var client = new TcpClient();
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(_timeoutMs);

            await client.ConnectAsync(_host, _port, cts.Token);
            return true;
        }
        catch (Exception ex) when (ex is SocketException or OperationCanceledException)
        {
            _logger.LogDebug("Printer at {Host}:{Port} is not reachable: {Message}", _host, _port, ex.Message);
            return false;
        }
    }
}
