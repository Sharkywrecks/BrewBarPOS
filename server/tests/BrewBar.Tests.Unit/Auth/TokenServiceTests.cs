using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using BrewBar.Core.Entities.Identity;
using BrewBar.Infrastructure.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Moq;

namespace BrewBar.Tests.Unit.Auth;

public class TokenServiceTests
{
    private readonly Mock<UserManager<AppUser>> _userManagerMock;
    private readonly IConfiguration _config;
    private readonly TokenService _sut;

    public TokenServiceTests()
    {
        _userManagerMock = new Mock<UserManager<AppUser>>(
            Mock.Of<IUserStore<AppUser>>(), null!, null!, null!, null!, null!, null!, null!, null!);

        _config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = "this-is-a-test-secret-key-at-least-32-chars!",
                ["Jwt:Issuer"] = "BrewBar-Test",
                ["Jwt:Audience"] = "BrewBar-Test-Audience"
            })
            .Build();

        _sut = new TokenService(_config, _userManagerMock.Object);
    }

    [Fact]
    public async Task CreateToken_ShouldReturnValidJwt()
    {
        var user = new AppUser { Id = "user-1", Email = "test@brewbar.com", DisplayName = "Test Cashier" };
        _userManagerMock.Setup(m => m.GetRolesAsync(user)).ReturnsAsync(new List<string> { "Cashier" });

        var token = await _sut.CreateToken(user);

        token.Should().NotBeNullOrWhiteSpace();
        var handler = new JwtSecurityTokenHandler();
        handler.CanReadToken(token).Should().BeTrue();
    }

    [Fact]
    public async Task CreateToken_ShouldIncludeUserClaims()
    {
        var user = new AppUser { Id = "user-1", Email = "test@brewbar.com", DisplayName = "Test Cashier" };
        _userManagerMock.Setup(m => m.GetRolesAsync(user)).ReturnsAsync(new List<string> { "Cashier" });

        var token = await _sut.CreateToken(user);

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        jwt.Claims.Should().Contain(c => c.Type == ClaimTypes.NameIdentifier && c.Value == "user-1");
        jwt.Claims.Should().Contain(c => c.Type == ClaimTypes.Email && c.Value == "test@brewbar.com");
        jwt.Claims.Should().Contain(c => c.Type == ClaimTypes.Name && c.Value == "Test Cashier");
    }

    [Fact]
    public async Task CreateToken_ShouldIncludeRoles()
    {
        var user = new AppUser { Id = "user-1", Email = "admin@brewbar.com", DisplayName = "Admin" };
        _userManagerMock.Setup(m => m.GetRolesAsync(user)).ReturnsAsync(new List<string> { "Admin", "Manager" });

        var token = await _sut.CreateToken(user);

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        var roles = jwt.Claims.Where(c => c.Type == ClaimTypes.Role).Select(c => c.Value).ToList();
        roles.Should().Contain("Admin");
        roles.Should().Contain("Manager");
    }

    [Fact]
    public async Task CreateToken_ShouldSetCorrectIssuerAndAudience()
    {
        var user = new AppUser { Id = "user-1", Email = "test@brewbar.com", DisplayName = "Test" };
        _userManagerMock.Setup(m => m.GetRolesAsync(user)).ReturnsAsync(new List<string>());

        var token = await _sut.CreateToken(user);

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        jwt.Issuer.Should().Be("BrewBar-Test");
        jwt.Audiences.Should().Contain("BrewBar-Test-Audience");
    }

    [Fact]
    public async Task CreateToken_ShouldExpireInSevenDays()
    {
        var user = new AppUser { Id = "user-1", Email = "test@brewbar.com", DisplayName = "Test" };
        _userManagerMock.Setup(m => m.GetRolesAsync(user)).ReturnsAsync(new List<string>());

        var token = await _sut.CreateToken(user);

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        jwt.ValidTo.Should().BeCloseTo(DateTime.UtcNow.AddDays(7), TimeSpan.FromMinutes(1));
    }

    [Fact]
    public async Task CreateToken_WithNoEmail_ShouldUseEmptyString()
    {
        var user = new AppUser { Id = "user-1", Email = null, DisplayName = "PIN-only Cashier" };
        _userManagerMock.Setup(m => m.GetRolesAsync(user)).ReturnsAsync(new List<string>());

        var token = await _sut.CreateToken(user);

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        jwt.Claims.Should().Contain(c => c.Type == ClaimTypes.Email && c.Value == string.Empty);
    }

    [Fact]
    public void CreateToken_WithMissingSecret_ShouldThrow()
    {
        var badConfig = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        var sut = new TokenService(badConfig, _userManagerMock.Object);
        var user = new AppUser { Id = "user-1", DisplayName = "Test" };
        _userManagerMock.Setup(m => m.GetRolesAsync(user)).ReturnsAsync(new List<string>());

        var act = () => sut.CreateToken(user);

        act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*JWT secret*");
    }
}
