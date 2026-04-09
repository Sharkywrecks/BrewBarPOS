namespace BrewBar.API.Dtos.Auth;

public class UserDto
{
    public string Id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
    public string AuthMethod { get; set; } = string.Empty;
    public IList<string> Roles { get; set; } = new List<string>();
}
