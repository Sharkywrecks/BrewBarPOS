using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using BrewBar.Core.Interfaces;

namespace BrewBar.Infrastructure.Services;

/// <summary>
/// Sends raw bytes to a Windows printer via the spooler (winspool.drv).
/// Works with USB printers mapped to LPT ports or any printer installed in Windows.
/// </summary>
public class WindowsRawPrintHelper : IWindowsRawPrinter
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct DocInfo1
    {
        [MarshalAs(UnmanagedType.LPWStr)]
        public string DocName;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string? OutputFile;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string DataType;
    }

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern int StartDocPrinter(IntPtr hPrinter, int level, ref DocInfo1 di);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    /// <summary>
    /// Send raw bytes directly to a named Windows printer.
    /// </summary>
    public void SendRawData(string printerName, byte[] data)
    {
        if (!OpenPrinter(printerName, out var hPrinter, IntPtr.Zero))
        {
            throw new InvalidOperationException(
                $"Cannot open printer '{printerName}'. Error code: {Marshal.GetLastWin32Error()}");
        }

        try
        {
            var docInfo = new DocInfo1
            {
                DocName = "BrewBar Receipt",
                OutputFile = null,
                DataType = "RAW",
            };

            if (StartDocPrinter(hPrinter, 1, ref docInfo) == 0)
            {
                throw new InvalidOperationException(
                    $"StartDocPrinter failed. Error code: {Marshal.GetLastWin32Error()}");
            }

            try
            {
                if (!StartPagePrinter(hPrinter))
                {
                    throw new InvalidOperationException(
                        $"StartPagePrinter failed. Error code: {Marshal.GetLastWin32Error()}");
                }

                var pUnmanagedBytes = Marshal.AllocCoTaskMem(data.Length);
                try
                {
                    Marshal.Copy(data, 0, pUnmanagedBytes, data.Length);
                    if (!WritePrinter(hPrinter, pUnmanagedBytes, data.Length, out _))
                    {
                        throw new InvalidOperationException(
                            $"WritePrinter failed. Error code: {Marshal.GetLastWin32Error()}");
                    }
                }
                finally
                {
                    Marshal.FreeCoTaskMem(pUnmanagedBytes);
                }

                EndPagePrinter(hPrinter);
            }
            finally
            {
                EndDocPrinter(hPrinter);
            }
        }
        finally
        {
            ClosePrinter(hPrinter);
        }
    }

    /// <summary>
    /// Check if a named printer exists and can be opened.
    /// </summary>
    public bool IsPrinterAvailable(string printerName)
    {
        if (!OpenPrinter(printerName, out var hPrinter, IntPtr.Zero))
            return false;

        ClosePrinter(hPrinter);
        return true;
    }

    // ── Printer enumeration via EnumPrinters ──────────────────

    private const int PRINTER_ENUM_LOCAL = 0x00000002;
    private const int PRINTER_ENUM_CONNECTIONS = 0x00000004;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct PrinterInfo2
    {
        public IntPtr pServerName;
        public IntPtr pPrinterName;
        public IntPtr pShareName;
        public IntPtr pPortName;
        public IntPtr pDriverName;
        public IntPtr pComment;
        public IntPtr pLocation;
        public IntPtr pDevMode;
        public IntPtr pSepFile;
        public IntPtr pPrintProcessor;
        public IntPtr pDatatype;
        public IntPtr pParameters;
        public IntPtr pSecurityDescriptor;
        public uint Attributes;
        public uint Priority;
        public uint DefaultPriority;
        public uint StartTime;
        public uint UntilTime;
        public uint Status;
        public uint cJobs;
        public uint AveragePPM;
    }

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool EnumPrinters(int flags, string? name, int level, IntPtr pPrinterEnum, int cbBuf, out int pcbNeeded, out int pcReturned);

    /// <summary>
    /// Find the first installed Windows printer whose name contains the given substring (case-insensitive).
    /// Returns null if no match is found.
    /// </summary>
    public string? FindPrinterByName(string searchTerm)
    {
        foreach (var name in EnumerateInstalledPrinters())
        {
            if (name.Contains(searchTerm, StringComparison.OrdinalIgnoreCase))
                return name;
        }
        return null;
    }

    private static List<string> EnumerateInstalledPrinters()
    {
        var names = new List<string>();
        const int flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;

        // First call to get required buffer size
        EnumPrinters(flags, null, 2, IntPtr.Zero, 0, out var bytesNeeded, out _);
        if (bytesNeeded == 0)
            return names;

        var pBuffer = Marshal.AllocHGlobal(bytesNeeded);
        try
        {
            if (!EnumPrinters(flags, null, 2, pBuffer, bytesNeeded, out _, out var count))
                return names;

            var structSize = Marshal.SizeOf<PrinterInfo2>();
            for (var i = 0; i < count; i++)
            {
                var info = Marshal.PtrToStructure<PrinterInfo2>(pBuffer + i * structSize);
                var printerName = Marshal.PtrToStringUni(info.pPrinterName);
                if (printerName != null)
                    names.Add(printerName);
            }
        }
        finally
        {
            Marshal.FreeHGlobal(pBuffer);
        }

        return names;
    }
}
