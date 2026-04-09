namespace BrewBar.API.Middleware;

/// <summary>
/// Adds standard security response headers. Configured for a POS app that serves
/// its own Angular SPA from /wwwroot — CSP allows inline styles (Angular component
/// styles compile to inline) but blocks inline scripts and disallows framing.
/// </summary>
public class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;

    public SecurityHeadersMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var headers = context.Response.Headers;

        // Set on every response. Use indexer (not Add) so middleware downstream
        // can override if it needs to (e.g. swagger UI).
        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "DENY";
        headers["Referrer-Policy"] = "no-referrer";
        headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";

        // Tight CSP for the SPA. Angular builds with hashed assets so 'self' is enough.
        // 'unsafe-inline' is required for Angular's component styles. Scripts: 'self' only.
        headers["Content-Security-Policy"] =
            "default-src 'self'; " +
            "script-src 'self'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data: blob:; " +
            "font-src 'self' data:; " +
            "connect-src 'self'; " +
            "frame-ancestors 'none'; " +
            "base-uri 'self'; " +
            "form-action 'self'";

        await _next(context);
    }
}
