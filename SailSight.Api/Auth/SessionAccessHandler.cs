using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using SailSight.Api.Data;
using SailSight.Api.Models.Entities;

namespace SailSight.Api.Auth;

public sealed class SessionAccessRequirement(bool requireWrite) : IAuthorizationRequirement
{
    public bool RequireWrite { get; } = requireWrite;
}

public sealed class SessionAccessHandler(
    AppDbContext db,
    ICurrentUser currentUser,
    AuthOptions auth)
    : AuthorizationHandler<SessionAccessRequirement, Guid>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        SessionAccessRequirement requirement,
        Guid sessionId)
    {
        if (!currentUser.IsAuthenticated) return;

        if (auth.IsSingleUser)
        {
            context.Succeed(requirement);
            return;
        }

        var userId = currentUser.UserId;

        // Owner always has access.
        var isOwner = await db.Sessions
            .AnyAsync(s => s.Id == sessionId && s.OwnerUserId == userId);
        if (isOwner) { context.Succeed(requirement); return; }

        // Otherwise, must be in a team that has a share (all shares grant read access; write = owner only).
        if (requirement.RequireWrite) return;

        var hasShare = await (
            from share in db.SessionShares
            where share.SessionId == sessionId
            join member in db.TeamMembers on share.TeamId equals member.TeamId
            where member.UserId == userId
            select share.SessionId).AnyAsync();

        if (hasShare) context.Succeed(requirement);
    }
}
