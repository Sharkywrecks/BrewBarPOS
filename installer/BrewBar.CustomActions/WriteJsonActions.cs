using System;
using System.Globalization;
using System.IO;
using System.Text;
using WixToolset.Dtf.WindowsInstaller;

namespace BrewBar.CustomActions;

/// <summary>
/// Writes installer-collected configuration to JSON files on disk for the API +
/// Electron shell to consume on first launch. Implemented as managed custom actions
/// instead of cmd.exe / PowerShell heredocs because:
///
///   1. User-supplied passwords / store names may contain quotes, &amp;, |, %, $,
///      etc. — shell echo / PS literals would break or worse, allow injection.
///   2. CustomActionData is a single raw string passed in-process to the action,
///      with no shell parsing of any kind.
///   3. JsonEscape() is the only encoding step, and we control it.
///
/// Properties are propagated to deferred actions via SetProperty CAs in Package.wxs
/// (see WriteBootstrapJsonSetData / WriteDeploymentJsonSetData).
/// </summary>
public static class WriteJsonActions
{
    [CustomAction]
    public static ActionResult WriteBootstrapJson(Session session)
    {
        try
        {
            var data = session.CustomActionData;
            var installFolder = data["INSTALLFOLDER"];
            var displayName = data["ADMIN_NAME"];
            var email = data["ADMIN_EMAIL"];
            var password = data["ADMIN_PASSWORD"];
            var pin = data["ADMIN_PIN"];
            var storeName = data["STORE_NAME"];
            var taxRatePct = data["TAX_RATE_PCT"];
            var currency = data["CURRENCY_CODE"];

            // Skip silently if the operator left credentials blank — fall through to
            // first-run /api/auth/setup. Don't half-write a file with empty fields.
            if (string.IsNullOrWhiteSpace(displayName) ||
                string.IsNullOrWhiteSpace(email) ||
                string.IsNullOrWhiteSpace(password) ||
                string.IsNullOrWhiteSpace(pin))
            {
                session.Log("BrewBar bootstrap: admin credentials not provided, skipping bootstrap.json");
                return ActionResult.Success;
            }

            // Tax rate comes in as percentage (e.g. "15"), API stores as decimal (0.15).
            decimal taxRate = 0.15m;
            if (decimal.TryParse(taxRatePct, NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed))
                taxRate = parsed / 100m;

            var sb = new StringBuilder();
            sb.Append('{');
            sb.Append("\"admin\":{");
            sb.AppendFormat("\"displayName\":\"{0}\",", JsonEscape(displayName));
            sb.AppendFormat("\"email\":\"{0}\",", JsonEscape(email));
            sb.AppendFormat("\"password\":\"{0}\",", JsonEscape(password));
            sb.AppendFormat("\"pin\":\"{0}\"", JsonEscape(pin));
            sb.Append("},");
            sb.Append("\"businessSettings\":{");
            sb.AppendFormat("\"storeName\":\"{0}\",", JsonEscape(storeName ?? "BrewBar"));
            sb.AppendFormat(CultureInfo.InvariantCulture, "\"taxRate\":{0},", taxRate);
            sb.AppendFormat("\"currency\":\"{0}\"", JsonEscape(currency ?? "SCR"));
            sb.Append('}');
            sb.Append('}');

            var apiDir = Path.Combine(installFolder, "resources", "api");
            Directory.CreateDirectory(apiDir);
            var path = Path.Combine(apiDir, "bootstrap.json");
            File.WriteAllText(path, sb.ToString(), new UTF8Encoding(false));

            session.Log("BrewBar bootstrap: wrote {0}", path);
            return ActionResult.Success;
        }
        catch (Exception ex)
        {
            session.Log("BrewBar bootstrap: WriteBootstrapJson failed: {0}", ex);
            // Non-fatal — installer should still succeed; admin can use /api/auth/setup.
            return ActionResult.Success;
        }
    }

    [CustomAction]
    public static ActionResult WriteDeploymentJson(Session session)
    {
        try
        {
            var data = session.CustomActionData;
            var installFolder = data["INSTALLFOLDER"];
            var mode = data["DEPLOY_MODE"];
            var apiUrl = data["API_URL"];

            var sb = new StringBuilder();
            sb.Append('{');
            sb.AppendFormat("\"mode\":\"{0}\",", JsonEscape(mode ?? "standalone"));
            sb.AppendFormat("\"apiUrl\":\"{0}\",", JsonEscape(apiUrl ?? string.Empty));
            sb.Append("\"apiPort\":5000");
            sb.Append('}');

            var path = Path.Combine(installFolder, "deployment.json");
            File.WriteAllText(path, sb.ToString(), new UTF8Encoding(false));

            session.Log("BrewBar bootstrap: wrote {0}", path);
            return ActionResult.Success;
        }
        catch (Exception ex)
        {
            session.Log("BrewBar bootstrap: WriteDeploymentJson failed: {0}", ex);
            return ActionResult.Failure;
        }
    }

    /// <summary>
    /// Writes a per-install JWT signing key to appsettings.Desktop.local.json if it
    /// doesn't already exist. Idempotent — preserves the existing key on upgrade so
    /// previously issued tokens remain valid.
    /// </summary>
    [CustomAction]
    public static ActionResult WriteJwtSecret(Session session)
    {
        try
        {
            var installFolder = session.CustomActionData["INSTALLFOLDER"];
            var apiDir = Path.Combine(installFolder, "resources", "api");
            Directory.CreateDirectory(apiDir);
            var path = Path.Combine(apiDir, "appsettings.Desktop.local.json");
            if (File.Exists(path))
            {
                session.Log("BrewBar bootstrap: JWT secret file already exists, leaving in place");
                return ActionResult.Success;
            }

            var bytes = new byte[48];
            using (var rng = System.Security.Cryptography.RandomNumberGenerator.Create())
                rng.GetBytes(bytes);
            var key = Convert.ToBase64String(bytes);

            var content = "{\"Jwt\":{\"Secret\":\"" + JsonEscape(key) + "\"}}";
            File.WriteAllText(path, content, new UTF8Encoding(false));
            session.Log("BrewBar bootstrap: wrote {0}", path);
            return ActionResult.Success;
        }
        catch (Exception ex)
        {
            session.Log("BrewBar bootstrap: WriteJwtSecret failed: {0}", ex);
            return ActionResult.Failure;
        }
    }

    private static string JsonEscape(string s)
    {
        if (string.IsNullOrEmpty(s)) return string.Empty;
        var sb = new StringBuilder(s.Length + 8);
        foreach (var c in s)
        {
            switch (c)
            {
                case '"': sb.Append("\\\""); break;
                case '\\': sb.Append("\\\\"); break;
                case '\b': sb.Append("\\b"); break;
                case '\f': sb.Append("\\f"); break;
                case '\n': sb.Append("\\n"); break;
                case '\r': sb.Append("\\r"); break;
                case '\t': sb.Append("\\t"); break;
                default:
                    if (c < 0x20)
                        sb.AppendFormat(CultureInfo.InvariantCulture, "\\u{0:x4}", (int)c);
                    else
                        sb.Append(c);
                    break;
            }
        }
        return sb.ToString();
    }
}
