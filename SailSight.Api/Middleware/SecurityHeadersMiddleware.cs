namespace SailSight.Api.Middleware;

public sealed class SecurityHeadersMiddleware(RequestDelegate next)
{
    public Task InvokeAsync(HttpContext ctx)
    {
        var h = ctx.Response.Headers;
        h["X-Content-Type-Options"] = "nosniff";
        h["X-Frame-Options"] = "DENY";
        h["Referrer-Policy"] = "no-referrer";
        h["X-Permitted-Cross-Domain-Policies"] = "none";
        // The browser only ever talks to the BFF; the API itself does not serve UI.
        h["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";
        return next(ctx);
    }
}
