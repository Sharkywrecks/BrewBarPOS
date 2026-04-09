using System.Security.Claims;
using BrewBar.API.Dtos.Auth;
using BrewBar.API.Errors;
using BrewBar.Core.Entities.Identity;
using BrewBar.Core.Interfaces;
using BrewBar.Core.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace BrewBar.API.Controllers;

public class AuthController : BaseApiController
{
    private readonly UserManager<AppUser> _userManager;
    private readonly SignInManager<AppUser> _signInManager;
    private readonly IPasswordHasher<AppUser> _passwordHasher;
    private readonly ITokenService _tokenService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        UserManager<AppUser> userManager,
        SignInManager<AppUser> signInManager,
        IPasswordHasher<AppUser> passwordHasher,
        ITokenService tokenService,
        ILogger<AuthController> logger)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _passwordHasher = passwordHasher;
        _tokenService = tokenService;
        _logger = logger;
    }

    [HttpPost("login")]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<UserDto>> Login(LoginDto dto, CancellationToken ct)
    {
        var user = await _userManager.FindByEmailAsync(dto.Email);
        if (user == null) return Unauthorized(new ApiResponse(401, "Invalid email or password"));

        if (await _userManager.IsLockedOutAsync(user))
            return Unauthorized(new ApiResponse(401, "Account is locked. Try again later."));

        var result = await _signInManager.CheckPasswordSignInAsync(user, dto.Password, lockoutOnFailure: true);
        if (!result.Succeeded)
        {
            _logger.LogWarning("Failed login for {Email} from {Ip}", dto.Email, HttpContext.Connection.RemoteIpAddress);
            return Unauthorized(new ApiResponse(401, "Invalid email or password"));
        }

        return await CreateUserDto(user, AuthClaims.AuthMethodPassword, ct);
    }

    [HttpPost("pin-login")]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<UserDto>> PinLogin(PinLoginDto dto, CancellationToken ct)
    {
        // Scope lookup to a single user selected via GET /api/auth/staff. This removes
        // both the whole-table scan (was FirstOrDefault(u => u.Pin == dto.Pin)) and the
        // associated timing side channel, and makes per-user lockout meaningful.
        var user = await _userManager.FindByIdAsync(dto.UserId);
        if (user == null || string.IsNullOrEmpty(user.PinHash))
            return Unauthorized(new ApiResponse(401, "Invalid credentials"));

        if (await _userManager.IsLockedOutAsync(user))
            return Unauthorized(new ApiResponse(401, "Account is locked. Try again later."));

        var verify = _passwordHasher.VerifyHashedPassword(user, user.PinHash, dto.Pin);
        if (verify == PasswordVerificationResult.Failed)
        {
            await _userManager.AccessFailedAsync(user);
            _logger.LogWarning("Failed PIN login for {UserId} from {Ip}", user.Id, HttpContext.Connection.RemoteIpAddress);
            return Unauthorized(new ApiResponse(401, "Invalid credentials"));
        }

        if (verify == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PinHash = _passwordHasher.HashPassword(user, dto.Pin);
            await _userManager.UpdateAsync(user);
        }

        await _userManager.ResetAccessFailedCountAsync(user);
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
            UserName = dto.Email
        };

        if (!string.IsNullOrEmpty(dto.Pin))
            user.PinHash = _passwordHasher.HashPassword(user, dto.Pin);

        var result = await _userManager.CreateAsync(user, dto.Password);
        if (!result.Succeeded) return BadRequest(new ApiResponse(400, string.Join(", ", result.Errors.Select(e => e.Description))));

        var validRoles = new[] { Roles.Admin, Roles.Manager, Roles.Cashier };
        var role = validRoles.Contains(dto.Role) ? dto.Role : Roles.Cashier;
        await _userManager.AddToRoleAsync(user, role);

        return await CreateUserDto(user, AuthClaims.AuthMethodPassword, ct);
    }

    /// <summary>
    /// One-shot bootstrap: creates the first admin account. Rejected with 409 as soon
    /// as any user exists, so this cannot be used to hijack an already-configured install.
    /// </summary>
    [HttpPost("setup")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<UserDto>> InitialSetup(InitialSetupDto dto, CancellationToken ct)
    {
        if (await _userManager.Users.AnyAsync(ct))
        {
            _logger.LogWarning("Rejected /setup call from {Ip} — setup already completed",
                HttpContext.Connection.RemoteIpAddress);
            return Conflict(new ApiResponse(409, "Setup has already been completed"));
        }

        var admin = new AppUser
        {
            DisplayName = dto.DisplayName,
            Email = dto.Email,
            UserName = dto.Email
        };
        admin.PinHash = _passwordHasher.HashPassword(admin, dto.Pin);

        var createResult = await _userManager.CreateAsync(admin, dto.Password);
        if (!createResult.Succeeded)
            return BadRequest(new ApiResponse(400, string.Join(", ", createResult.Errors.Select(e => e.Description))));

        var roleResult = await _userManager.AddToRoleAsync(admin, Roles.Admin);
        if (!roleResult.Succeeded)
        {
            // Roll back so the endpoint stays idempotent — otherwise a failed role assignment
            // would leave a user in the DB and permanently block future /setup calls.
            await _userManager.DeleteAsync(admin);
            return BadRequest(new ApiResponse(400, string.Join(", ", roleResult.Errors.Select(e => e.Description))));
        }

        _logger.LogInformation("Initial admin created via /setup: {Email}", dto.Email);
        return await CreateUserDto(admin, AuthClaims.AuthMethodPassword, ct);
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

    [HttpPut("users/{id}")]
    [Authorize(Policy = Policies.RequireAdmin)]
    public async Task<ActionResult<UserDto>> UpdateUser(string id, UpdateUserDto dto, CancellationToken ct)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null) return NotFound(new ApiResponse(404));

        var validRoles = new[] { Roles.Admin, Roles.Manager, Roles.Cashier };
        if (!validRoles.Contains(dto.Role))
            return BadRequest(new ApiResponse(400, "Invalid role"));

        // Reject email collisions against *other* users.
        var existing = await _userManager.FindByEmailAsync(dto.Email);
        if (existing != null && existing.Id != user.Id)
            return BadRequest(new ApiResponse(400, "Email is already in use"));

        var currentRoles = await _userManager.GetRolesAsync(user);
        var wasAdmin = currentRoles.Contains(Roles.Admin);
        var willBeAdmin = dto.Role == Roles.Admin;

        // Block demoting the last remaining admin — would lock the system out of admin endpoints.
        if (wasAdmin && !willBeAdmin)
        {
            var adminCount = (await _userManager.GetUsersInRoleAsync(Roles.Admin)).Count;
            if (adminCount <= 1)
                return BadRequest(new ApiResponse(400, "Cannot demote the last admin"));
        }

        user.DisplayName = dto.DisplayName;
        user.Email = dto.Email;
        user.UserName = dto.Email;

        var updateResult = await _userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
            return BadRequest(new ApiResponse(400, string.Join(", ", updateResult.Errors.Select(e => e.Description))));

        if (currentRoles.Count > 0)
            await _userManager.RemoveFromRolesAsync(user, currentRoles);
        await _userManager.AddToRoleAsync(user, dto.Role);

        return await CreateUserDto(user, AuthClaims.AuthMethodPassword, ct);
    }

    [HttpPost("users/{id}/reset-pin")]
    [Authorize(Policy = Policies.RequireAdmin)]
    public async Task<IActionResult> ResetPin(string id, ResetPinDto dto, CancellationToken ct)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null) return NotFound(new ApiResponse(404));

        user.PinHash = _passwordHasher.HashPassword(user, dto.Pin);
        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
            return BadRequest(new ApiResponse(400, string.Join(", ", result.Errors.Select(e => e.Description))));

        // Clear lockout state so a previously-locked staff member can sign back in immediately.
        await _userManager.ResetAccessFailedCountAsync(user);
        _logger.LogInformation("PIN reset for {UserId} by {Caller}", user.Id, User.FindFirstValue(ClaimTypes.NameIdentifier));
        return NoContent();
    }

    [HttpDelete("users/{id}")]
    [Authorize(Policy = Policies.RequireAdmin)]
    public async Task<IActionResult> DeleteUser(string id, CancellationToken ct)
    {
        var callerId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (callerId == id)
            return BadRequest(new ApiResponse(400, "You cannot delete your own account"));

        var user = await _userManager.FindByIdAsync(id);
        if (user == null) return NotFound(new ApiResponse(404));

        var roles = await _userManager.GetRolesAsync(user);
        if (roles.Contains(Roles.Admin))
        {
            var adminCount = (await _userManager.GetUsersInRoleAsync(Roles.Admin)).Count;
            if (adminCount <= 1)
                return BadRequest(new ApiResponse(400, "Cannot delete the last admin"));
        }

        var result = await _userManager.DeleteAsync(user);
        if (!result.Succeeded)
            return BadRequest(new ApiResponse(400, string.Join(", ", result.Errors.Select(e => e.Description))));

        _logger.LogInformation("User {UserId} deleted by {Caller}", id, callerId);
        return NoContent();
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
