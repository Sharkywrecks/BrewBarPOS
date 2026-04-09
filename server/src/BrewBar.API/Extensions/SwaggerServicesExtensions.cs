using Microsoft.OpenApi;

namespace BrewBar.API.Extensions;

public static class SwaggerServicesExtensions
{
    public static IServiceCollection AddSwaggerServices(this IServiceCollection services)
    {
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(opt =>
        {
            // Schema IDs for generic types: `Pagination<OrderDto>` should serialise
            // as `PaginationOfOrderDto`, not Swashbuckle's default `OrderDtoPagination`
            // (suffix-style) or the C# raw `Pagination[OrderDto]`. The frontend
            // imports `PaginationOfOrderDto` / `PaginationOfProductDto` directly,
            // so the schema IDs must follow the same convention.
            opt.CustomSchemaIds(type =>
            {
                if (!type.IsGenericType) return type.Name;
                var name = type.Name;
                var tickIndex = name.IndexOf('`');
                if (tickIndex > 0) name = name.Substring(0, tickIndex);
                var args = string.Join("And", type.GetGenericArguments().Select(t => t.Name));
                return $"{name}Of{args}";
            });

            // Operation IDs must be `Controller_Action` so NSwag's
            // SingleClientFromOperationId mode (configured in client/nswag.json)
            // produces method names like `auth_InitialSetup`, `auth_PinLogin`,
            // `categories_GetById` etc. The frontend's AuthService and the rest
            // of the codebase consume these names directly. Without this hook,
            // Swashbuckle defaults to just the action name and the regenerated
            // client breaks every existing call site.
            //
            // Minimal API endpoints (e.g. /health/ready) lack the "controller"
            // and "action" route values, so we fall back to the existing
            // RelativePath / endpoint name. TryGetValue avoids the KNF on the
            // dictionary lookup that would otherwise crash swagger generation.
            opt.CustomOperationIds(api =>
            {
                api.ActionDescriptor.RouteValues.TryGetValue("controller", out var controller);
                api.ActionDescriptor.RouteValues.TryGetValue("action", out var action);

                if (!string.IsNullOrEmpty(controller) && !string.IsNullOrEmpty(action))
                    return $"{controller}_{action}";

                // Minimal API / non-controller endpoint: fall back to a stable
                // synthetic id derived from the route, with non-alphanumerics
                // collapsed so it remains a valid C# / TypeScript identifier.
                var fallback = api.RelativePath ?? api.HttpMethod ?? "endpoint";
                return new string(fallback.Select(c => char.IsLetterOrDigit(c) ? c : '_').ToArray());
            });

            opt.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
                Description = "JWT Authorization header. Example: \"Bearer {token}\"",
                Name = "Authorization",
                In = ParameterLocation.Header,
                Type = SecuritySchemeType.ApiKey,
                Scheme = "Bearer"
            });

            opt.AddSecurityRequirement(_ => new OpenApiSecurityRequirement
            {
                { new OpenApiSecuritySchemeReference("Bearer"), new List<string>() }
            });
        });

        // Register NSwag OpenAPI document generator (required for NSwag CLI code generation)
        services.AddOpenApiDocument();

        return services;
    }
}
