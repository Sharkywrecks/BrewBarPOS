using System.ComponentModel.DataAnnotations;

namespace BrewBar.API.Dtos.Auth;

public class PinLoginDto
{
    /// <summary>
    /// Staff user id — obtained from GET /api/auth/staff. Required so PIN verification
    /// is a constant-time hash check scoped to one user instead of a brute-forceable
    /// whole-table scan.
    /// </summary>
    [Required]
    public string UserId { get; set; } = string.Empty;

    [Required]
    [StringLength(6, MinimumLength = 4)]
    public string Pin { get; set; } = string.Empty;
}
