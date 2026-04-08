// WiX custom action (JScript): show a file-open dialog via PowerShell, set MENU_FILE property.
var fso = new ActiveXObject("Scripting.FileSystemObject");
var shell = new ActiveXObject("WScript.Shell");
var tmpResult = shell.ExpandEnvironmentStrings("%TEMP%") + "\\brewbar_menu_pick.txt";
var tmpScript = shell.ExpandEnvironmentStrings("%TEMP%") + "\\brewbar_menu_pick.ps1";

// Clean up stale files
try { fso.DeleteFile(tmpResult); } catch (e) {}
try { fso.DeleteFile(tmpScript); } catch (e) {}

// Write a self-contained PowerShell script to a temp file (avoids all quoting issues)
var f = fso.CreateTextFile(tmpScript, true);
f.WriteLine("Add-Type -AssemblyName System.Windows.Forms");
f.WriteLine("[System.Windows.Forms.Application]::EnableVisualStyles()");
f.WriteLine("$d = New-Object System.Windows.Forms.OpenFileDialog");
f.WriteLine("$d.Title = 'Select Menu File'");
f.WriteLine("$d.Filter = 'Excel files (*.xlsx)|*.xlsx|All files (*.*)|*.*'");
f.WriteLine("$d.FilterIndex = 1");
f.WriteLine("if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {");
f.WriteLine("  [System.IO.File]::WriteAllText('" + tmpResult + "', $d.FileName)");
f.WriteLine("}");
f.Close();

// Run PowerShell with -Sta (required for WinForms), wait for it to finish
shell.Run("powershell.exe -NoProfile -ExecutionPolicy Bypass -Sta -File \"" + tmpScript + "\"", 0, true);

// Read the selected path back into the MSI property
if (fso.FileExists(tmpResult)) {
    var ts = fso.OpenTextFile(tmpResult, 1);
    var path = ts.ReadAll();
    ts.Close();
    try { fso.DeleteFile(tmpResult); } catch (e) {}
    if (path.length > 0) {
        Session.Property("MENU_FILE") = path;
    }
}

// Clean up
try { fso.DeleteFile(tmpScript); } catch (e) {}
