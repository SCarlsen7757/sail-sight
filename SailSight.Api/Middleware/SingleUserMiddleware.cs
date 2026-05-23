using System.Security.Claims;

namespace SailSight.Api.Middleware;

/// <summary>
/// In single-user mode, injects a synthetic authenticated principal so that
/// the rest of the pipeline can pretend a user is logged in.
/// </summary>
public sealed class SingleUserMiddleware(RequestDelegate next, Auth.AuthOptions auth)
{
    public Task InvokeAsync(HttpContext ctx)
    {
        if (!auth.IsSingleUser) return next(ctx);

        if (ctx.User?.Identity?.IsAuthenticated != true)
        {
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, Auth.AuthConstants.SystemUserId.ToString()),
                new Claim(ClaimTypes.Email, Auth.AuthConstants.SystemUserEmail),
                new Claim(ClaimTypes.Name, "Local User"),
            };
            var identity = new ClaimsIdentity(claims, "SingleUser");
            ctx.User = new ClaimsPrincipal(identity);
        }
        return next(ctx);
    }
}
