namespace BrewBar.API.Errors;

public class ApiResponse
{
    public int StatusCode { get; set; }
    public string? Message { get; set; }

    public ApiResponse(int statusCode, string? message = null)
    {
        StatusCode = statusCode;
        Message = message ?? GetDefaultMessageForStatusCode(statusCode);
    }

    private static string? GetDefaultMessageForStatusCode(int statusCode) => statusCode switch
    {
        400 => "A bad request was made",
        401 => "You are not authorized",
        403 => "You are forbidden from accessing this resource",
        404 => "Resource was not found",
        500 => "An internal server error occurred",
        _ => null
    };
}

public class ApiException : ApiResponse
{
    public string? Details { get; set; }

    public ApiException(int statusCode, string? message = null, string? details = null)
        : base(statusCode, message)
    {
        Details = details;
    }
}

public class ApiValidationErrorResponse : ApiResponse
{
    public IEnumerable<string> Errors { get; set; }

    public ApiValidationErrorResponse() : base(400)
    {
        Errors = new List<string>();
    }
}
