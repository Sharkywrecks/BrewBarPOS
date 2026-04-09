namespace BrewBar.Core.Constants;

/// <summary>
/// Authorization policies. Admin/manager policies additionally require that the
/// caller's JWT was issued via password login (not pin login) — pin tokens are
/// scoped to POS use only and must not access elevated endpoints.
/// </summary>
public static class Policies
{
    public const string RequireAdmin = "RequireAdmin";
    public const string RequireAdminOrManager = "RequireAdminOrManager";
}
