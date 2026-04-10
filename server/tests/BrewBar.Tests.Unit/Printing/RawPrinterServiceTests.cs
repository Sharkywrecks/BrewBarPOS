using System.Net;
using System.Net.Sockets;
using BrewBar.Core.Interfaces;
using BrewBar.Infrastructure.Services;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;

namespace BrewBar.Tests.Unit.Printing;

public class RawPrinterServiceTests
{
    private readonly Mock<ILogger<RawPrinterService>> _loggerMock = new();
    private readonly Mock<IWindowsRawPrinter> _winPrinterMock = new();

    private IConfiguration BuildConfig(string host = "127.0.0.1", int port = 9100, int timeoutMs = 2000, string windowsName = "")
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Printer:Host"] = host,
                ["Printer:Port"] = port.ToString(),
                ["Printer:TimeoutMs"] = timeoutMs.ToString(),
                ["Printer:WindowsName"] = windowsName,
            })
            .Build();
    }

    private RawPrinterService CreateSut(IConfiguration? config = null)
    {
        return new RawPrinterService(config ?? BuildConfig(), _winPrinterMock.Object, _loggerMock.Object);
    }

    // ── Network mode tests ─────────────────────────────────────

    [Fact]
    public async Task PrintAsync_SendsDataViaTcpWhenNetworkAvailable()
    {
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;

        // Accept connections in a loop — the first is the availability probe, the second is the print job
        var received = new List<byte>();
        var serverTask = Task.Run(async () =>
        {
            // 1. Accept the probe connection from IsNetworkReachable (no data sent, just connects)
            using (var probeClient = await listener.AcceptTcpClientAsync()) { }

            // 2. Accept the actual print connection
            using var printClient = await listener.AcceptTcpClientAsync();
            var buffer = new byte[1024];
            var stream = printClient.GetStream();
            var bytesRead = await stream.ReadAsync(buffer);
            received.AddRange(buffer[..bytesRead]);
        });

        var config = BuildConfig(port: port);
        var sut = new RawPrinterService(config, _winPrinterMock.Object, _loggerMock.Object);
        var payload = new byte[] { 0x1B, 0x40, 0x48, 0x65, 0x6C, 0x6C, 0x6F };

        await sut.PrintAsync(payload);

        await serverTask.WaitAsync(TimeSpan.FromSeconds(5));
        received.Should().BeEquivalentTo(payload);
        _winPrinterMock.Verify(w => w.SendRawData(It.IsAny<string>(), It.IsAny<byte[]>()), Times.Never);
    }

    [Fact]
    public async Task IsAvailableAsync_ReturnsTrueWhenNetworkListening()
    {
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;

        var sut = CreateSut(BuildConfig(port: port));

        var result = await sut.IsAvailableAsync();

        result.Should().BeTrue();
    }

    // ── Windows fallback tests ─────────────────────────────────

    [Fact]
    public async Task PrintAsync_FallsBackToWindowsWhenNetworkUnreachable()
    {
        var config = BuildConfig(port: 1, timeoutMs: 200, windowsName: "POS-80");
        _winPrinterMock.Setup(w => w.IsPrinterAvailable("POS-80")).Returns(true);

        var sut = new RawPrinterService(config, _winPrinterMock.Object, _loggerMock.Object);
        var payload = new byte[] { 0x1B, 0x40 };

        await sut.PrintAsync(payload);

        _winPrinterMock.Verify(w => w.SendRawData("POS-80", payload), Times.Once);
    }

    [Fact]
    public async Task PrintAsync_AutoSearchesWindowsPrinterWhenNoNameConfigured()
    {
        var config = BuildConfig(port: 1, timeoutMs: 200);
        _winPrinterMock.Setup(w => w.FindPrinterByName("POS")).Returns("POS-80 Thermal");
        _winPrinterMock.Setup(w => w.IsPrinterAvailable("POS-80 Thermal")).Returns(true);

        var sut = new RawPrinterService(config, _winPrinterMock.Object, _loggerMock.Object);
        var payload = new byte[] { 0x1B, 0x40 };

        await sut.PrintAsync(payload);

        _winPrinterMock.Verify(w => w.SendRawData("POS-80 Thermal", payload), Times.Once);
    }

    [Fact]
    public async Task IsAvailableAsync_ReturnsTrueWhenWindowsPrinterAvailable()
    {
        var config = BuildConfig(port: 1, timeoutMs: 200, windowsName: "POS-80");
        _winPrinterMock.Setup(w => w.IsPrinterAvailable("POS-80")).Returns(true);

        var sut = new RawPrinterService(config, _winPrinterMock.Object, _loggerMock.Object);

        var result = await sut.IsAvailableAsync();

        result.Should().BeTrue();
    }

    [Fact]
    public async Task IsAvailableAsync_ReturnsFalseWhenNothingAvailable()
    {
        var config = BuildConfig(port: 1, timeoutMs: 200);
        _winPrinterMock.Setup(w => w.FindPrinterByName(It.IsAny<string>())).Returns((string?)null);

        var sut = new RawPrinterService(config, _winPrinterMock.Object, _loggerMock.Object);

        var result = await sut.IsAvailableAsync();

        result.Should().BeFalse();
    }

    [Fact]
    public async Task PrintAsync_ThrowsWhenNoPrinterAvailable()
    {
        var config = BuildConfig(port: 1, timeoutMs: 200);
        _winPrinterMock.Setup(w => w.FindPrinterByName(It.IsAny<string>())).Returns((string?)null);

        var sut = new RawPrinterService(config, _winPrinterMock.Object, _loggerMock.Object);

        var act = () => sut.PrintAsync(new byte[] { 0x1B, 0x40 });

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*No printer available*");
    }

    [Fact]
    public async Task PrintAsync_PrefersNetworkOverWindows()
    {
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;

        // Accept connections: probe + print
        _ = Task.Run(async () =>
        {
            using (var probe = await listener.AcceptTcpClientAsync()) { }
            using var print = await listener.AcceptTcpClientAsync();
            var buffer = new byte[1024];
            await print.GetStream().ReadAsync(buffer);
        });

        var config = BuildConfig(port: port, windowsName: "POS-80");
        _winPrinterMock.Setup(w => w.IsPrinterAvailable("POS-80")).Returns(true);

        var sut = new RawPrinterService(config, _winPrinterMock.Object, _loggerMock.Object);

        await sut.PrintAsync(new byte[] { 0x1B, 0x40 });

        // Should use network, NOT Windows
        _winPrinterMock.Verify(w => w.SendRawData(It.IsAny<string>(), It.IsAny<byte[]>()), Times.Never);
    }

    [Fact]
    public void Constructor_UsesDefaultsWhenConfigMissing()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        var sut = new RawPrinterService(config, _winPrinterMock.Object, _loggerMock.Object);
        sut.Should().NotBeNull();
    }
}
