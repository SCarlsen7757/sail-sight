using System.Security.Cryptography;
using SailSight.Api.Auth;

namespace SailSight.Api.Middleware;

/// <summary>
/// Double-submit cookie CSRF protection. On any state-changing request from a
/// cookie-authenticated session, the request must include the CSRF token in
/// the <see cref="AuthConstants.CsrfHeaderName"/> header that matches the
/// <see cref="AuthConstants.CsrfCookieName"/> cookie.
/// </summary>
public sealed class CsrfMiddleware(RequestDelegate next)
{
    private static readonly HashSet<string> SafeMethods = new(StringComparer.OrdinalIgnoreCase) { "GET", "HEAD", "OPTIONS" };

    public async Task InvokeAsync(HttpContext ctx)
    {
        // Always issue a CSRF cookie for browsers (so the BFF can read it).
        if (!ctx.Request.Cookies.ContainsKey(AuthConstants.CsrfCookieName))
        {
            var token = GenerateToken();
            ctx.Response.Cookies.Append(AuthConstants.CsrfCookieName, token, new CookieOptions
            {
                HttpOnly = false, // read by BFF JS
                Secure = ctx.Request.IsHttps,
                SameSite = SameSiteMode.Lax,
                Path = "/",
            });
        }

        if (SafeMethods.Contains(ctx.Request.Method))
        {
            await next(ctx); return;
        }

        // Require an explicit browser header for authenticated mutations.
        if (ctx.User?.Identity?.IsAuthenticated == true)
        {
            var cookie = ctx.Request.Cookies[AuthConstants.CsrfCookieName];
            var header = ctx.Request.Headers[AuthConstants.CsrfHeaderName].ToString();
            if (string.IsNullOrEmpty(cookie) || string.IsNullOrEmpty(header) || !FixedTimeEquals(cookie, header))
            {
                ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
                await ctx.Response.WriteAsJsonAsync(new { error = "csrf_token_invalid" });
                return;
            }
        }

        await next(ctx);
    }

    private static string GenerateToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }

    private static bool FixedTimeEquals(string a, string b)
    {
        if (a.Length != b.Length) return false;
        var aBytes = System.Text.Encoding.UTF8.GetBytes(a);
        var bBytes = System.Text.Encoding.UTF8.GetBytes(b);
        return CryptographicOperations.FixedTimeEquals(aBytes, bBytes);
    }
}
