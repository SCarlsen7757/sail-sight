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

        var path = ctx.Request.Path.Value ?? "";
        if ((path.StartsWith("/api/v1/auth/", StringComparison.OrdinalIgnoreCase) && !path.Equals("/api/v1/auth/providers", StringComparison.OrdinalIgnoreCase)) ||
            path.StartsWith("/api/v1/admin/users", StringComparison.OrdinalIgnoreCase) || path.StartsWith("/api/v1/admin/invitations", StringComparison.OrdinalIgnoreCase))
        {
            ctx.Response.StatusCode = StatusCodes.Status404NotFound;
            return Task.CompletedTask;
        }

        if (ctx.User?.Identity?.IsAuthenticated != true)
        {
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, Auth.AuthConstants.SystemUserId.ToString()),
                new Claim(ClaimTypes.Email, Auth.AuthConstants.SystemUserEmail),
                new Claim(ClaimTypes.Name, "Local User"),
                new Claim(ClaimTypes.Role, Auth.AuthConstants.AdminRole),
                new Claim(ClaimTypes.Role, Auth.AuthConstants.UserRole),
            };
            var identity = new ClaimsIdentity(claims, "SingleUser");
            ctx.User = new ClaimsPrincipal(identity);
        }
        return next(ctx);
    }
}
