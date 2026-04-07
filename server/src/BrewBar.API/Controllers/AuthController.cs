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

        return await CreateUserDto(user, ct);
    }

    [HttpPost("pin-login")]
    public async Task<ActionResult<UserDto>> PinLogin(PinLoginDto dto, CancellationToken ct)
    {
        var user = await _userManager.Users.FirstOrDefaultAsync(u => u.Pin == dto.Pin, ct);
        if (user == null) return Unauthorized(new ApiResponse(401, "Invalid PIN"));

        return await CreateUserDto(user, ct);
    }

    [HttpPost("register")]
    [Authorize(Roles = Roles.Admin)]
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

        return await CreateUserDto(user, ct);
    }

    [HttpGet("current")]
    [Authorize]
    public async Task<ActionResult<UserDto>> GetCurrentUser(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var user = await _userManager.FindByIdAsync(userId!);
        if (user == null) return NotFound(new ApiResponse(404));

        return await CreateUserDto(user, ct);
    }

    [HttpGet("users")]
    [Authorize(Roles = Roles.AdminOrManager)]
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

    private async Task<UserDto> CreateUserDto(AppUser user, CancellationToken ct)
    {
        var roles = await _userManager.GetRolesAsync(user);
        return new UserDto
        {
            Id = user.Id,
            Email = user.Email ?? string.Empty,
            DisplayName = user.DisplayName,
            Token = await _tokenService.CreateToken(user, ct),
            Roles = roles.ToList()
        };
    }
}
