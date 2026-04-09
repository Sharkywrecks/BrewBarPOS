using Microsoft.AspNetCore.Identity;

namespace BrewBar.Core.Entities.Identity;

public class AppUser : IdentityUser
{
    public string DisplayName { get; set; } = string.Empty;

    /// <summary>
    /// PIN stored as an Identity-style hash (via <see cref="IPasswordHasher{AppUser}"/>).
    /// Never store plaintext PINs — a DB dump would immediately expose staff impersonation.
    /// </summary>
    public string? PinHash { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
