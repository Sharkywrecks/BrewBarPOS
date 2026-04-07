using Microsoft.AspNetCore.Identity;

namespace BrewBar.Core.Entities.Identity;

public class AppUser : IdentityUser
{
    public string DisplayName { get; set; } = string.Empty;
    public string? Pin { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
