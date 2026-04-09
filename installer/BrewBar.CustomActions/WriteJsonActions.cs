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
/// Property propagation pipeline: deferred CAs cannot read MSI properties directly,
/// so an immediate "Prepare*" CA reads them via session["X"], base64-encodes each
/// value, and writes the joined result to the property whose name matches the
/// deferred CA (MSI then exposes that string as session.CustomActionData inside
/// the deferred sandbox). Base64 — instead of the WiX SetProperty CA's raw
/// "key=[VALUE];key=[VALUE]" substitution — is required because CustomActionData
/// has no escaping for the ';' field separator or '=' kv separator: a password
/// containing ';' would otherwise silently truncate (regression: 2026-04-09).
/// </summary>
public static class WriteJsonActions
{
    // ─── Immediate CAs: read properties + pack base64 CustomActionData ─────

    [CustomAction]
    public static ActionResult PrepareBootstrapData(Session session)
    {
        try
        {
            var sb = new StringBuilder();
            AppendB64(sb, "INSTALLFOLDER",  session["INSTALLFOLDER"]);
            AppendB64(sb, "ADMIN_NAME",     session["ADMIN_NAME"]);
            AppendB64(sb, "ADMIN_EMAIL",    session["ADMIN_EMAIL"]);
            AppendB64(sb, "ADMIN_PASSWORD", session["ADMIN_PASSWORD"]);
            AppendB64(sb, "ADMIN_PIN",      session["ADMIN_PIN"]);
            AppendB64(sb, "STORE_NAME",     session["STORE_NAME"]);
            AppendB64(sb, "TAX_RATE_PCT",   session["TAX_RATE_PCT"]);
            AppendB64(sb, "CURRENCY_CODE",  session["CURRENCY_CODE"]);
            session["WriteBootstrapJson"] = sb.ToString();
            return ActionResult.Success;
        }
        catch (Exception ex)
        {
            session.Log("BrewBar bootstrap: PrepareBootstrapData failed: {0}", ex);
            return ActionResult.Success; // non-fatal — deferred CA will skip on missing fields
        }
    }

    [CustomAction]
    public static ActionResult PrepareDeploymentData(Session session)
    {
        try
        {
            var sb = new StringBuilder();
            AppendB64(sb, "INSTALLFOLDER", session["INSTALLFOLDER"]);
            AppendB64(sb, "DEPLOY_MODE",   session["DEPLOY_MODE"]);
            AppendB64(sb, "API_URL",       session["API_URL"]);
            session["WriteDeploymentJson"] = sb.ToString();
            return ActionResult.Success;
        }
        catch (Exception ex)
        {
            session.Log("BrewBar bootstrap: PrepareDeploymentData failed: {0}", ex);
            return ActionResult.Failure;
        }
    }

    [CustomAction]
    public static ActionResult PrepareJwtSecretData(Session session)
    {
        try
        {
            var sb = new StringBuilder();
            AppendB64(sb, "INSTALLFOLDER", session["INSTALLFOLDER"]);
            session["WriteJwtSecret"] = sb.ToString();
            return ActionResult.Success;
        }
        catch (Exception ex)
        {
            session.Log("BrewBar bootstrap: PrepareJwtSecretData failed: {0}", ex);
            return ActionResult.Failure;
        }
    }

    // ─── Deferred CAs: decode + write files ────────────────────────────────

    [CustomAction]
    public static ActionResult WriteBootstrapJson(Session session)
    {
        try
        {
            var data = session.CustomActionData;
            var installFolder = B64Decode(data["INSTALLFOLDER"]);
            var displayName   = B64Decode(data["ADMIN_NAME"]);
            var email         = B64Decode(data["ADMIN_EMAIL"]);
            var password      = B64Decode(data["ADMIN_PASSWORD"]);
            var pin           = B64Decode(data["ADMIN_PIN"]);
            var storeName     = B64Decode(data["STORE_NAME"]);
            var taxRatePct    = B64Decode(data["TAX_RATE_PCT"]);
            var currency      = B64Decode(data["CURRENCY_CODE"]);

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
            var installFolder = B64Decode(data["INSTALLFOLDER"]);
            var mode          = B64Decode(data["DEPLOY_MODE"]);
            var apiUrl        = B64Decode(data["API_URL"]);

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
            var installFolder = B64Decode(session.CustomActionData["INSTALLFOLDER"]);
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

    // ─── CustomActionData base64 packing ───────────────────────────────────
    //
    // CustomActionData has no escape mechanism for ';' (field separator) or '='
    // (key/value separator). The previous SetProperty CA emitted raw values via
    // [PROPERTY] substitution, so a password containing ';' would silently
    // truncate at the first occurrence. Base64-encoding each value before
    // packing eliminates the collision entirely (the alphabet is A-Z a-z 0-9
    // + / =, and trailing '=' padding is fine because it only appears at the
    // very end of a token, not as a delimiter).

    private static void AppendB64(StringBuilder sb, string key, string? value)
    {
        if (sb.Length > 0) sb.Append(';');
        sb.Append(key);
        sb.Append('=');
        sb.Append(Convert.ToBase64String(Encoding.UTF8.GetBytes(value ?? string.Empty)));
    }

    private static string B64Decode(string? value)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;
        try { return Encoding.UTF8.GetString(Convert.FromBase64String(value!)); }
        catch (FormatException) { return string.Empty; }
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
