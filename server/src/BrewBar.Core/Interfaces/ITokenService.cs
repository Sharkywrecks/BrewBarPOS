using BrewBar.Core.Entities.Identity;

namespace BrewBar.Core.Interfaces;

public interface ITokenService
{
    Task<string> CreateToken(AppUser user, string authMethod, CancellationToken ct = default);
}
