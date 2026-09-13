using Microsoft.EntityFrameworkCore;
using SailSight.Api.Data;

namespace SailSight.Api.Auth;

/// <summary>
/// Helper for checking that a session is accessible to the current user.
/// Read: owner, any team member with a share, or the session is public.
/// Write: owner only.
/// </summary>
public sealed class SessionAuthorizer(AppDbContext db, ICurrentUser currentUser, AuthOptions auth)
{
    public IQueryable<Guid> PrivateSessionIds()
    {
        if (!currentUser.IsAuthenticated) return db.Sessions.Where(s => false).Select(s => s.Id);
        var uid = currentUser.UserId;
        return db.Sessions.Where(s => s.OwnerUserId == uid ||
            s.Shares.Any(sh => db.TeamMembers.Any(m => m.TeamId == sh.TeamId && m.UserId == uid)))
            .Select(s => s.Id);
    }

    public Task<bool> CanReadPrivateAsync(Guid id, CancellationToken ct = default) => PrivateSessionIds().ContainsAsync(id, ct);

    public Task<bool> OwnsBoatAsync(Guid id, CancellationToken ct) =>
        db.Boats.AnyAsync(b => b.Id == id && b.OwnerUserId == currentUser.UserId, ct);
    public Task<bool> OwnsCourseAsync(Guid id, CancellationToken ct) =>
        db.Courses.AnyAsync(c => c.Id == id && c.OwnerUserId == currentUser.UserId, ct);

    public static string PublicTitle(Models.Entities.Session session) =>
        string.IsNullOrWhiteSpace(session.DisplayName) ? $"Session {session.StartedAt:yyyy-MM-dd}" : session.DisplayName;

    public Task<bool> CanReadAsync(Guid sessionId, CancellationToken ct = default) => CanAsync(sessionId, write: false, ct);
    public Task<bool> CanWriteAsync(Guid sessionId, CancellationToken ct = default) => CanAsync(sessionId, write: true, ct);

    private async Task<bool> CanAsync(Guid sessionId, bool write, CancellationToken ct)
    {
        if (auth.IsSingleUser) return await db.Sessions.AnyAsync(s => s.Id == sessionId, ct);

        if (write)
        {
            if (!currentUser.IsAuthenticated) return false;
            var userId = currentUser.UserId;
            return await db.Sessions.AnyAsync(s => s.Id == sessionId && s.OwnerUserId == userId, ct);
        }

        // Read: public sessions are visible to anyone
        var isPublic = await db.Sessions.AnyAsync(s => s.Id == sessionId && s.IsPublic, ct);
        if (isPublic) return true;

        if (!currentUser.IsAuthenticated) return false;
        var uid = currentUser.UserId;

        var isOwner = await db.Sessions.AnyAsync(s => s.Id == sessionId && s.OwnerUserId == uid, ct);
        if (isOwner) return true;

        return await (
            from share in db.SessionShares
            where share.SessionId == sessionId
            join member in db.TeamMembers on share.TeamId equals member.TeamId
            where member.UserId == uid
            select share.SessionId).AnyAsync(ct);
    }

    /// <summary>
    /// Returns the queryable of session IDs the current user can read (owned + team-shared + public).
    /// </summary>
    public IQueryable<Guid> ReadableSessionIds()
    {
        if (auth.IsSingleUser) return db.Sessions.Select(s => s.Id);

        var publicIds = db.Sessions.Where(s => s.IsPublic).Select(s => s.Id);

        if (!currentUser.IsAuthenticated) return publicIds;

        var userId = currentUser.UserId;
        var owned = db.Sessions.Where(s => s.OwnerUserId == userId).Select(s => s.Id);
        var shared = db.SessionShares
            .Where(sh => db.TeamMembers.Any(m => m.TeamId == sh.TeamId && m.UserId == userId))
            .Select(sh => sh.SessionId);
        return owned.Union(shared).Union(publicIds);
    }
}
