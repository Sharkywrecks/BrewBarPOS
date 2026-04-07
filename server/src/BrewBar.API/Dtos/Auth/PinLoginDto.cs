using System.ComponentModel.DataAnnotations;

namespace BrewBar.API.Dtos.Auth;

public class PinLoginDto
{
    [Required]
    [StringLength(6, MinimumLength = 4)]
    public string Pin { get; set; } = string.Empty;
}
