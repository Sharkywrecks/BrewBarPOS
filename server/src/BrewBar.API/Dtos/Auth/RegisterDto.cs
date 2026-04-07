using System.ComponentModel.DataAnnotations;

namespace BrewBar.API.Dtos.Auth;

public class RegisterDto
{
    [Required]
    public string DisplayName { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    [StringLength(100, MinimumLength = 6)]
    public string Password { get; set; } = string.Empty;

    [StringLength(6, MinimumLength = 4)]
    public string? Pin { get; set; }

    [Required]
    public string Role { get; set; } = "Cashier";
}
