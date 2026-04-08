using System.Threading;
using System.Windows.Forms;
using WixToolset.Dtf.WindowsInstaller;

namespace BrewBar.CustomActions;

public class BrowseFileAction
{
    [CustomAction]
    public static ActionResult BrowseMenuFile(Session session)
    {
        string? selectedPath = null;

        var thread = new Thread(() =>
        {
            using var dialog = new OpenFileDialog
            {
                Title = "Select Menu File",
                Filter = "Excel files (*.xlsx)|*.xlsx|All files (*.*)|*.*",
                FilterIndex = 1,
            };

            if (dialog.ShowDialog() == DialogResult.OK)
                selectedPath = dialog.FileName;
        });

        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();

        if (!string.IsNullOrEmpty(selectedPath))
            session["MENU_FILE"] = selectedPath;

        return ActionResult.Success;
    }
}
