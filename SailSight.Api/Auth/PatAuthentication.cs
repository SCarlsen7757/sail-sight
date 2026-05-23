using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SailSight.Api.Data;

namespace SailSight.Api.Auth;

public sealed class PatAuthenticationOptions : AuthenticationSchemeOptions { }

public sealed class PatAuthenticationHandler(
    IOptionsMonitor<PatAuthenticationOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    AppDbContext db)
    : AuthenticationHandler<PatAuthenticationOptions>(options, logger, encoder)
{
    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var header = Request.Headers.Authorization.ToString();
        if (string.IsNullOrEmpty(header) || !header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            return AuthenticateResult.NoResult();

        var token = header.Substring("Bearer ".Length).Trim();
        if (!token.StartsWith(AuthConstants.PatPrefix, StringComparison.Ordinal))
            return AuthenticateResult.NoResult();

        var hash = PatHasher.Hash(token);
        var prefix = token.Length > 12 ? token.Substring(0, 12) : token;
        var pat = await db.PersonalAccessTokens
            .FirstOrDefaultAsync(p => p.TokenHash == hash && p.TokenPrefix == prefix);
        if (pat is null) return AuthenticateResult.Fail("Invalid token");
        if (pat.RevokedAt is not null) return AuthenticateResult.Fail("Token revoked");
        if (pat.ExpiresAt is not null && pat.ExpiresAt < DateTimeOffset.UtcNow)
            return AuthenticateResult.Fail("Token expired");

        pat.LastUsedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, pat.UserId.ToString()),
            new Claim("pat_id", pat.Id.ToString()),
        };
        var identity = new ClaimsIdentity(claims, AuthConstants.PatScheme);
        var principal = new ClaimsPrincipal(identity);
        return AuthenticateResult.Success(new AuthenticationTicket(principal, AuthConstants.PatScheme));
    }
}

public static class PatHasher
{
    public static string Hash(string token)
    {
        var bytes = System.Text.Encoding.UTF8.GetBytes(token);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash);
    }

    public static string Generate()
    {
        // 32 bytes of randomness → 256 bits.
        var bytes = RandomNumberGenerator.GetBytes(32);
        var b64 = Convert.ToBase64String(bytes)
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');
        return AuthConstants.PatPrefix + b64;
    }
}
