using SailSight.Api.Helpers;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SailSight.Api.Audit;
using SailSight.Api.Auth;
using SailSight.Api.Data;
using SailSight.Api.Models.Entities;
using SailSight.Api.Services;
using SailSight.Shared.Dtos.Me;
using SailSight.Shared.Dtos.Stats;
using SailSight.Shared.Dtos.Teams;

namespace SailSight.Api.Controllers;

[ApiVersion("1.0")]
[ApiController]
[Authorize]
[Route("api/v{version:apiVersion}/me")]
public class MeController(
    AppDbContext db,
    IServiceProvider services,
    ICurrentUser currentUser,
    IAuditService audit,
    AuthOptions authOptions,
    NotificationBus notificationBus) : ControllerBase
{
    private UserManager<AppUser> userManager => services.GetRequiredService<UserManager<AppUser>>();

    [HttpGet]
    public async Task<ActionResult<UserProfileDto>> GetProfile()
    {
        if (authOptions.IsSingleUser)
        {
            return Ok(new UserProfileDto(
                AuthConstants.SystemUserId,
                AuthConstants.SystemUserEmail,
                "Local User",
                [AuthConstants.AdminRole, AuthConstants.UserRole],
                DateTimeOffset.UtcNow));
        }
        var user = await userManager.FindByIdAsync(currentUser.UserId.ToString());
        if (user is null) return NotFound();
        var roles = await userManager.GetRolesAsync(user);
        return Ok(new UserProfileDto(user.Id, user.Email!, user.DisplayName, [.. roles], user.CreatedAt));
    }

    [HttpPatch]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest req)
    {
        if (authOptions.IsSingleUser) return BadRequest();
        var user = await userManager.FindByIdAsync(currentUser.UserId.ToString());
        if (user is null) return NotFound();
        user.DisplayName = req.DisplayName;
        SecurityTransactions.Require(await userManager.UpdateAsync(user));
        return Ok();
    }

    [HttpPost("password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest req)
    {
        if (authOptions.IsSingleUser) return BadRequest();
        var user = await userManager.FindByIdAsync(currentUser.UserId.ToString());
        if (user is null) return NotFound();
        var result = await userManager.ChangePasswordAsync(user, req.CurrentPassword, req.NewPassword);
        if (!result.Succeeded)
            return BadRequest(new { errors = result.Errors.Select(e => e.Description) });
        return Ok();
    }

    [HttpGet("stats")]
    public async Task<ActionResult<GlobalStatsDto>> GetStats(CancellationToken ct)
    {
        var userId = currentUser.UserId;
        var totalBoats = await db.Boats.CountAsync(b => b.OwnerUserId == userId, ct);
        var sessions = db.Sessions.Where(s => s.OwnerUserId == userId);
        var sessionIds = sessions.Select(s => s.Id);
        var races = db.Races.Where(r => sessionIds.Contains(r.SessionId));
        var sessionCount = await sessions.CountAsync(ct);
        var raceCount = await races.CountAsync(ct);

        var dto = new GlobalStatsDto(
            totalBoats, sessionCount, raceCount,
            sessionCount > 0 ? await sessions.SumAsync(s => (s.EndedAt - s.StartedAt).TotalSeconds, ct) : 0.0,
            raceCount > 0 ? await races.Where(r => r.EndedAt.HasValue).SumAsync(r => (r.EndedAt!.Value - r.StartedAt).TotalSeconds, ct) : 0.0,
            raceCount > 0 ? await races.Where(r => r.EndedAt.HasValue).SumAsync(r => r.SailedDistanceMeters, ct) : 0.0,
            raceCount > 0 ? await races.MaxAsync(r => r.MaxSpeedOverGround, ct) : 0f,
            sessionCount > 0 ? await sessions.MinAsync(s => s.StartedAt, ct) : null,
            sessionCount > 0 ? await sessions.MaxAsync(s => s.StartedAt, ct) : null);
        return Ok(dto);
    }

    // ── Team Invitations ────────────────────────────────────────────────
    [HttpGet("invites")]
    public async Task<ActionResult<List<PendingTeamInviteDto>>> GetMyInvites(CancellationToken ct)
    {
        var userId = currentUser.UserId;
        var invites = await db.TeamInvites
            .Where(i => i.InvitedUserId == userId && i.AcceptedAt == null && i.DeclinedAt == null && i.ExpiresAt > DateTimeOffset.UtcNow)
            .OrderBy(i => i.Id)
            .Select(i => new PendingTeamInviteDto(
                i.Id, i.TeamId, i.Team.Name,
                i.Team.Members.Where(m => m.Role == TeamRole.Owner).Select(m => m.User.Email!).FirstOrDefault() ?? "",
                i.Role, i.CreatedAt, i.ExpiresAt))
            .PageAsync(HttpContext, ct);
        return Ok(invites);
    }

    [HttpPost("invites/{inviteId:guid}/accept")]
    public async Task<IActionResult> AcceptInvite(Guid inviteId, CancellationToken ct)
    {
        await using var tx = await SecurityTransactions.BeginAsync(db, ct);
        var userId = currentUser.UserId;
        var invite = await db.TeamInvites.FirstOrDefaultAsync(i => i.Id == inviteId && i.InvitedUserId == userId, ct);
        if (invite is null) return NotFound();
        if (invite.AcceptedAt is not null) return BadRequest(new { error = "already_accepted" });
        if (invite.DeclinedAt is not null) return BadRequest(new { error = "already_declined" });
        if (invite.ExpiresAt < DateTimeOffset.UtcNow) return BadRequest(new { error = "expired" });

        var alreadyMember = await db.TeamMembers.AnyAsync(m => m.TeamId == invite.TeamId && m.UserId == userId, ct);
        if (!alreadyMember)
        {
            if (!SecurityTransactions.TryTeamRole(invite.Role, out var role)) return BadRequest(new { error = "invalid_role" });
            db.TeamMembers.Add(new TeamMember { TeamId = invite.TeamId, UserId = userId, Role = role });
        }
        invite.AcceptedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        await audit.LogAsync("team.invite_accepted", "team", invite.TeamId.ToString(), ct: ct);
        return Ok(new { teamId = invite.TeamId });
    }

    [HttpPost("invites/{inviteId:guid}/decline")]
    public async Task<IActionResult> DeclineInvite(Guid inviteId, CancellationToken ct)
    {
        await using var tx = await SecurityTransactions.BeginAsync(db, ct);
        var userId = currentUser.UserId;
        var invite = await db.TeamInvites.FirstOrDefaultAsync(i => i.Id == inviteId && i.InvitedUserId == userId, ct);
        if (invite is null) return NotFound();
        if (invite.AcceptedAt is not null) return BadRequest(new { error = "already_accepted" });
        if (invite.DeclinedAt is not null) return BadRequest(new { error = "already_declined" });
        if (invite.ExpiresAt < DateTimeOffset.UtcNow) return BadRequest(new { error = "expired" });

        invite.DeclinedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        await audit.LogAsync("team.invite_declined", "team", invite.TeamId.ToString(), ct: ct);
        return NoContent();
    }

    [HttpGet("notification-counts")]
    public async Task<ActionResult<NotificationCountsDto>> GetNotificationCounts(CancellationToken ct)
    {
        if (authOptions.IsSingleUser)
        {
            var pendingRequests = await db.BoatClassRequests
                .CountAsync(r => r.Status == Models.Entities.BoatClassRequestStatus.Pending, ct);
            return Ok(new NotificationCountsDto(0, pendingRequests));
        }

        var userId = currentUser.UserId;
        var pendingInvites = await db.TeamInvites
            .CountAsync(i => i.InvitedUserId == userId && i.AcceptedAt == null && i.DeclinedAt == null && i.ExpiresAt > DateTimeOffset.UtcNow, ct);

        var isAdmin = await userManager.IsInRoleAsync(
            (await userManager.FindByIdAsync(userId.ToString()))!, AuthConstants.AdminRole);

        var pendingBoatClassRequests = isAdmin
            ? await db.BoatClassRequests.CountAsync(r => r.Status == Models.Entities.BoatClassRequestStatus.Pending, ct)
            : 0;

        return Ok(new NotificationCountsDto(pendingInvites, pendingBoatClassRequests));
    }

    /// <summary>
    /// Long-lived SSE endpoint that pushes <see cref="NotificationCountsDto"/> whenever
    /// notification-relevant data changes. The initial counts are sent immediately on connect.
    /// </summary>
    [HttpGet("notifications/stream")]
    public async Task StreamNotifications(CancellationToken ct)
    {
        Guid userId;
        bool isAdmin;

        if (authOptions.IsSingleUser)
        {
            userId = AuthConstants.SystemUserId;
            isAdmin = true;
        }
        else
        {
            userId = currentUser.UserId;
            var user = await userManager.FindByIdAsync(userId.ToString());
            if (user is null) { Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
            isAdmin = await userManager.IsInRoleAsync(user, AuthConstants.AdminRole);
        }

        Response.ContentType = "text/event-stream";
        Response.Headers.CacheControl = "no-cache";
        Response.Headers.Connection = "keep-alive";

        using var lifetime = CancellationTokenSource.CreateLinkedTokenSource(ct);
        lifetime.CancelAfter(TimeSpan.FromSeconds(30));
        ct = lifetime.Token;
        var reader = notificationBus.Subscribe(userId);
        try
        {
            await SendNotificationCountsAsync(userId, isAdmin, ct);

            await foreach (var _ in reader.ReadAllAsync(ct))
                await SendNotificationCountsAsync(userId, isAdmin, ct);
        }
        catch (OperationCanceledException) { /* client disconnected */ }
        finally
        {
            notificationBus.Unsubscribe(userId, reader);
        }
    }

    private async Task SendNotificationCountsAsync(Guid userId, bool isAdmin, CancellationToken ct)
    {
        if (!authOptions.IsSingleUser)
        {
            var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Id == userId, ct);
            var stamp = User.FindFirst("AspNet.Identity.SecurityStamp")?.Value;
            if (user == null || user.SecurityStamp != stamp) throw new OperationCanceledException();
            isAdmin = await userManager.IsInRoleAsync(user, AuthConstants.AdminRole);
        }
        int pendingInvites;
        int pendingBoatClassRequests;

        if (authOptions.IsSingleUser)
        {
            pendingInvites = 0;
            pendingBoatClassRequests = isAdmin
                ? await db.BoatClassRequests.CountAsync(r => r.Status == Models.Entities.BoatClassRequestStatus.Pending, ct)
                : 0;
        }
        else
        {
            pendingInvites = await db.TeamInvites
                .CountAsync(i => i.InvitedUserId == userId && i.AcceptedAt == null && i.DeclinedAt == null && i.ExpiresAt > DateTimeOffset.UtcNow, ct);
            pendingBoatClassRequests = isAdmin
                ? await db.BoatClassRequests.CountAsync(r => r.Status == Models.Entities.BoatClassRequestStatus.Pending, ct)
                : 0;
        }

        var counts = new NotificationCountsDto(pendingInvites, pendingBoatClassRequests);
        var json = System.Text.Json.JsonSerializer.Serialize(counts,
            new System.Text.Json.JsonSerializerOptions { PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase });
        await Response.WriteAsync($"data: {json}\n\n", ct);
        await Response.Body.FlushAsync(ct);
    }
}
