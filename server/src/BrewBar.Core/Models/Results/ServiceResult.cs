namespace BrewBar.Core.Models.Results;

public enum ResultStatus
{
    Success,
    NotFound,
    Validation,
    Conflict,
    Unauthorized
}

public record ServiceResult<T>
{
    public ResultStatus Status { get; init; }
    public T? Data { get; init; }
    public string? Message { get; init; }
    public IReadOnlyList<string>? Errors { get; init; }

    public bool IsSuccess => Status == ResultStatus.Success;

    public static ServiceResult<T> Ok(T data) =>
        new() { Status = ResultStatus.Success, Data = data };

    public static ServiceResult<T> NotFound(string message = "Resource not found") =>
        new() { Status = ResultStatus.NotFound, Message = message };

    public static ServiceResult<T> Validation(string message, IReadOnlyList<string>? errors = null) =>
        new() { Status = ResultStatus.Validation, Message = message, Errors = errors };

    public static ServiceResult<T> Conflict(string message) =>
        new() { Status = ResultStatus.Conflict, Message = message };

    public static ServiceResult<T> Unauthorized(string message = "Unauthorized") =>
        new() { Status = ResultStatus.Unauthorized, Message = message };
}
