using System.Security.Claims;
using BrewBar.API.Dtos.Auth;
using BrewBar.API.Errors;
using BrewBar.Core.Entities.Identity;
using BrewBar.Core.Interfaces;
using BrewBar.Core.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BrewBar.API.Controllers;

public class AuthController : BaseApiController
{
    private readonly UserManager<AppUser> _userManager;
    private readonly SignInManager<AppUser> _signInManager;
    private readonly ITokenService _tokenService;

    public AuthController(
        UserManager<AppUser> userManager,
        SignInManager<AppUser> signInManager,
        ITokenService tokenService)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _tokenService = tokenService;
    }

    [HttpPost("login")]
    public async Task<ActionResult<UserDto>> Login(LoginDto dto, CancellationToken ct)
    {
        var user = await _userManager.FindByEmailAsync(dto.Email);
        if (user == null) return Unauthorized(new ApiResponse(401, "Invalid email or password"));

        var result = await _signInManager.CheckPasswordSignInAsync(user, dto.Password, false);
        if (!result.Succeeded) return Unauthorized(new ApiResponse(401, "Invalid email or password"));

        return await CreateUserDto(user, AuthClaims.AuthMethodPassword, ct);
    }

    [HttpPost("pin-login")]
    public async Task<ActionResult<UserDto>> PinLogin(PinLoginDto dto, CancellationToken ct)
    {
        var user = await _userManager.Users.FirstOrDefaultAsync(u => u.Pin == dto.Pin, ct);
        if (user == null) return Unauthorized(new ApiResponse(401, "Invalid PIN"));

        return await CreateUserDto(user, AuthClaims.AuthMethodPin, ct);
    }

    [HttpPost("register")]
    [Authorize(Policy = Policies.RequireAdmin)]
    public async Task<ActionResult<UserDto>> Register(RegisterDto dto, CancellationToken ct)
    {
        if (await _userManager.FindByEmailAsync(dto.Email) != null)
            return BadRequest(new ApiResponse(400, "Email is already in use"));

        var user = new AppUser
        {
            DisplayName = dto.DisplayName,
            Email = dto.Email,
            UserName = dto.Email,
            Pin = dto.Pin
        };

        var result = await _userManager.CreateAsync(user, dto.Password);
        if (!result.Succeeded) return BadRequest(new ApiResponse(400, string.Join(", ", result.Errors.Select(e => e.Description))));

        var validRoles = new[] { Roles.Admin, Roles.Manager, Roles.Cashier };
        var role = validRoles.Contains(dto.Role) ? dto.Role : Roles.Cashier;
        await _userManager.AddToRoleAsync(user, role);

        return await CreateUserDto(user, AuthClaims.AuthMethodPassword, ct);
    }

    /// <summary>
    /// One-time initial setup: updates the default admin account with custom credentials.
    /// Only works when the default admin (admin@brewbar.local) still exists.
    /// </summary>
    [HttpPost("setup")]
    [AllowAnonymous]
    public async Task<ActionResult> InitialSetup(InitialSetupDto dto, CancellationToken ct)
    {
        const string defaultEmail = "admin@brewbar.local";
        var admin = await _userManager.FindByEmailAsync(defaultEmail);
        if (admin == null)
            return BadRequest(new ApiResponse(400, "Initial setup already completed"));

        // Update credentials
        admin.DisplayName = dto.DisplayName;
        admin.Email = dto.Email;
        admin.UserName = dto.Email;
        admin.Pin = dto.Pin;

        var updateResult = await _userManager.UpdateAsync(admin);
        if (!updateResult.Succeeded)
            return BadRequest(new ApiResponse(400, string.Join(", ", updateResult.Errors.Select(e => e.Description))));

        // Change password
        var token = await _userManager.GeneratePasswordResetTokenAsync(admin);
        var pwResult = await _userManager.ResetPasswordAsync(admin, token, dto.Password);
        if (!pwResult.Succeeded)
            return BadRequest(new ApiResponse(400, string.Join(", ", pwResult.Errors.Select(e => e.Description))));

        return Ok(new ApiResponse(200, "Admin account configured"));
    }

    [HttpGet("current")]
    [Authorize]
    public async Task<ActionResult<UserDto>> GetCurrentUser(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var user = await _userManager.FindByIdAsync(userId!);
        if (user == null) return NotFound(new ApiResponse(404));

        // Preserve the auth method from the existing token rather than re-issuing one — calling
        // this endpoint must not silently upgrade a pin session into a password session.
        var authMethod = User.FindFirstValue(AuthClaims.AuthMethod) ?? AuthClaims.AuthMethodPin;
        var roles = await _userManager.GetRolesAsync(user);
        return new UserDto
        {
            Id = user.Id,
            Email = user.Email ?? string.Empty,
            DisplayName = user.DisplayName,
            AuthMethod = authMethod,
            Roles = roles.ToList()
        };
    }

    [HttpGet("staff")]
    public async Task<ActionResult<IList<StaffDto>>> GetStaff(CancellationToken ct)
    {
        var users = await _userManager.Users
            .Select(u => new StaffDto { Id = u.Id, DisplayName = u.DisplayName })
            .OrderBy(u => u.DisplayName)
            .ToListAsync(ct);

        return Ok(users);
    }

    [HttpGet("users")]
    [Authorize(Policy = Policies.RequireAdminOrManager)]
    public async Task<ActionResult<IList<UserDto>>> GetUsers(CancellationToken ct)
    {
        var users = await _userManager.Users.ToListAsync(ct);
        var result = new List<UserDto>();

        foreach (var user in users)
        {
            var roles = await _userManager.GetRolesAsync(user);
            result.Add(new UserDto
            {
                Id = user.Id,
                Email = user.Email ?? string.Empty,
                DisplayName = user.DisplayName,
                Roles = roles.ToList()
            });
        }

        return Ok(result);
    }

    private async Task<UserDto> CreateUserDto(AppUser user, string authMethod, CancellationToken ct)
    {
        var roles = await _userManager.GetRolesAsync(user);
        return new UserDto
        {
            Id = user.Id,
            Email = user.Email ?? string.Empty,
            DisplayName = user.DisplayName,
            Token = await _tokenService.CreateToken(user, authMethod, ct),
            AuthMethod = authMethod,
            Roles = roles.ToList()
        };
    }
}
