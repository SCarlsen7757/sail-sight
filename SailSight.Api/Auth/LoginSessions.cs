using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using SailSight.Api.Data;
using SailSight.Api.Models.Entities;

namespace SailSight.Api.Auth;

/// <summary>
/// Server-side record of each signed-in browser. A cookie is only accepted while its login session exists,
/// so signing out cannot be undone by a renewed cookie from a request that was still in flight.
/// </summary>
public sealed class LoginSessionStore(AppDbContext db, AuthOptions auth)
{
    private TimeSpan Lifetime => TimeSpan.FromDays(auth.Cookie.SlidingExpirationDays);

    public static Guid? IdOf(ClaimsPrincipal? principal) =>
        Guid.TryParse(principal?.FindFirstValue(AuthConstants.LoginSessionClaim), out var id) ? id : null;

    public async Task<Guid> CreateAsync(Guid userId, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        await db.LoginSessions.Where(s => s.UserId == userId && s.ExpiresAt < now).ExecuteDeleteAsync(ct);
        var session = new LoginSession { UserId = userId, CreatedAt = now, ExpiresAt = now + Lifetime };
        db.LoginSessions.Add(session);
        await db.SaveChangesAsync(ct);
        return session.Id;
    }

    public Task<bool> IsActiveAsync(Guid id, Guid userId, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        return db.LoginSessions.AnyAsync(s => s.Id == id && s.UserId == userId && s.ExpiresAt > now, ct);
    }

    public Task ExtendAsync(Guid id, CancellationToken ct = default)
    {
        var expiresAt = DateTimeOffset.UtcNow + Lifetime;
        return db.LoginSessions.Where(s => s.Id == id).ExecuteUpdateAsync(s => s.SetProperty(x => x.ExpiresAt, expiresAt), ct);
    }

    public Task RevokeAsync(Guid? id, Guid userId, CancellationToken ct = default) =>
        id is null ? Task.CompletedTask : db.LoginSessions.Where(s => s.Id == id && s.UserId == userId).ExecuteDeleteAsync(ct);
}
