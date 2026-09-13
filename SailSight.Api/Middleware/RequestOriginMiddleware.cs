using Microsoft.Extensions.Options;
using SailSight.Api.Auth;

namespace SailSight.Api.Middleware;

public sealed class RequestOriginMiddleware(RequestDelegate next, IOptions<WebOptions> options)
{
    public async Task InvokeAsync(HttpContext context)
    {
        if (!HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method) && !HttpMethods.IsOptions(context.Request.Method))
        {
            var origin = context.Request.Headers.Origin.ToString();
            if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri) || uri.GetLeftPart(UriPartial.Authority) != origin.TrimEnd('/') ||
                !string.Equals(origin.TrimEnd('/'), new Uri(options.Value.PublicBaseUrl).GetLeftPart(UriPartial.Authority), StringComparison.OrdinalIgnoreCase))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { error = "invalid_origin" });
                return;
            }
        }
        await next(context);
    }
}
