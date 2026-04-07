using BrewBar.Core.Entities.Identity;

namespace BrewBar.Core.Interfaces;

public interface ITokenService
{
    Task<string> CreateToken(AppUser user, CancellationToken ct = default);
}
