using BrewBar.API.Extensions;

namespace BrewBar.Tests.Integration;

/// <summary>
/// Fail-fast checks on Jwt:Secret. Protects against accidentally shipping with a
/// placeholder key that was previously committed to the repo.
/// </summary>
public class JwtStartupTests
{
    [Fact]
    public void ValidateJwtSecret_Null_Throws()
    {
        var ex = Assert.Throws<InvalidOperationException>(
            () => IdentityServicesExtensions.ValidateJwtSecret(null));
        Assert.Contains("missing", ex.Message);
    }

    [Fact]
    public void ValidateJwtSecret_Empty_Throws()
    {
        Assert.Throws<InvalidOperationException>(
            () => IdentityServicesExtensions.ValidateJwtSecret(""));
    }

    [Fact]
    public void ValidateJwtSecret_TooShort_Throws()
    {
        var ex = Assert.Throws<InvalidOperationException>(
            () => IdentityServicesExtensions.ValidateJwtSecret("too-short"));
        Assert.Contains("32 bytes", ex.Message);
    }

    [Theory]
    [InlineData("super-secret-key-for-development-at-least-32-chars")]
    [InlineData("brewbar-dev-local-jwt-secret-key-min-32-chars!!")]
    [InlineData("brewbar-desktop-local-jwt-secret-key-min-32-chars")]
    public void ValidateJwtSecret_PreviouslyCommittedPlaceholder_Throws(string placeholder)
    {
        var ex = Assert.Throws<InvalidOperationException>(
            () => IdentityServicesExtensions.ValidateJwtSecret(placeholder));
        Assert.Contains("known placeholder", ex.Message);
    }

    [Fact]
    public void ValidateJwtSecret_ValidKey_DoesNotThrow()
    {
        // Should not throw.
        IdentityServicesExtensions.ValidateJwtSecret(
            "some-freshly-generated-key-that-is-definitely-over-32-bytes");
    }
}
