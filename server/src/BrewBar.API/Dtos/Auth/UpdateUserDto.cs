using System.ComponentModel.DataAnnotations;

namespace BrewBar.API.Dtos.Auth;

public class UpdateUserDto
{
    [Required]
    public string DisplayName { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Role { get; set; } = "Cashier";
}
