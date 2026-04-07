namespace BrewBar.Core.Constants;

public static class Roles
{
    public const string Admin = "Admin";
    public const string Manager = "Manager";
    public const string Cashier = "Cashier";

    public const string AdminOrManager = $"{Admin},{Manager}";
}
