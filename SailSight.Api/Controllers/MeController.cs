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
using SailSight.Shared.Dtos.Tokens;

namespace SailSight.Api.Controllers;

[ApiVersion("1.0")]
[ApiController]
[Authorize]
[Route("api/v{version:apiVersion}/me")]
public class MeController(
    AppDbContext db,
    UserManager<AppUser> userManager,
    ICurrentUser currentUser,
    IAuditService audit,
    AuthOptions authOptions,
    NotificationBus notificationBus) : ControllerBase
{
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
        await userManager.UpdateAsync(user);
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
        var sessions = await db.Sessions.Where(s => s.OwnerUserId == userId).ToListAsync(ct);
        var sessionIds = sessions.Select(s => s.Id).ToList();
        var races = await db.Races.Where(r => sessionIds.Contains(r.SessionId)).ToListAsync(ct);

        var dto = new GlobalStatsDto(
            totalBoats, sessions.Count, races.Count,
            sessions.Count > 0 ? sessions.Sum(s => (s.EndedAt - s.StartedAt).TotalSeconds) : 0.0,
            races.Count > 0 ? races.Where(r => r.EndedAt.HasValue).Sum(r => (r.EndedAt!.Value - r.StartedAt).TotalSeconds) : 0.0,
            races.Count > 0 ? races.Where(r => r.EndedAt.HasValue).Sum(r => r.SailedDistanceMeters) : 0.0,
            races.Count > 0 ? races.Max(r => r.MaxSpeedOverGround) : 0f,
            sessions.Count > 0 ? sessions.Min(s => s.StartedAt) : null,
            sessions.Count > 0 ? sessions.Max(s => s.StartedAt) : null);
        return Ok(dto);
    }

    // ── Personal Access Tokens ──────────────────────────────────────────
    [HttpGet("tokens")]
    public async Task<ActionResult<List<PersonalAccessTokenDto>>> ListTokens(CancellationToken ct)
    {
        var userId = currentUser.UserId;
        var tokens = await db.PersonalAccessTokens
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new PersonalAccessTokenDto(p.Id, p.Name, p.TokenPrefix, p.CreatedAt, p.ExpiresAt, p.LastUsedAt, p.RevokedAt))
            .ToListAsync(ct);
        return Ok(tokens);
    }

    [HttpPost("tokens")]
    public async Task<ActionResult<CreatePatResponse>> CreateToken([FromBody] CreatePatRequest req, CancellationToken ct)
    {
        if (authOptions.IsSingleUser) return BadRequest(new { error = "pats_disabled_in_single_user" });
        var token = PatHasher.Generate();
        var hash = PatHasher.Hash(token);
        var pat = new PersonalAccessToken
        {
            UserId = currentUser.UserId,
            Name = req.Name,
            TokenHash = hash,
            TokenPrefix = token.Length > 12 ? token.Substring(0, 12) : token,
            ExpiresAt = req.ExpiresInDays.HasValue ? DateTimeOffset.UtcNow.AddDays(req.ExpiresInDays.Value) : null,
        };
        db.PersonalAccessTokens.Add(pat);
        await db.SaveChangesAsync(ct);
        return Ok(new CreatePatResponse(
            new PersonalAccessTokenDto(pat.Id, pat.Name, pat.TokenPrefix, pat.CreatedAt, pat.ExpiresAt, null, null),
            token));
    }

    [HttpDelete("tokens/{id:guid}")]
    public async Task<IActionResult> RevokeToken(Guid id, CancellationToken ct)
    {
        var userId = currentUser.UserId;
        var pat = await db.PersonalAccessTokens.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId, ct);
        if (pat is null) return NotFound();
        pat.RevokedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── Team Invitations ────────────────────────────────────────────────
    [HttpGet("invites")]
    public async Task<ActionResult<List<PendingTeamInviteDto>>> GetMyInvites(CancellationToken ct)
    {
        var userId = currentUser.UserId;
        var invites = await db.TeamInvites
            .Where(i => i.InvitedUserId == userId && i.AcceptedAt == null && i.DeclinedAt == null && i.ExpiresAt > DateTimeOffset.UtcNow)
            .Select(i => new PendingTeamInviteDto(
                i.Id, i.TeamId, i.Team.Name,
                i.Team.Members.Where(m => m.Role == TeamRole.Owner).Select(m => m.User.Email!).FirstOrDefault() ?? "",
                i.Role, i.CreatedAt, i.ExpiresAt))
            .ToListAsync(ct);
        return Ok(invites);
    }

    [HttpPost("invites/{inviteId:guid}/accept")]
    public async Task<IActionResult> AcceptInvite(Guid inviteId, CancellationToken ct)
    {
        var userId = currentUser.UserId;
        var invite = await db.TeamInvites.FirstOrDefaultAsync(i => i.Id == inviteId && i.InvitedUserId == userId, ct);
        if (invite is null) return NotFound();
        if (invite.AcceptedAt is not null) return BadRequest(new { error = "already_accepted" });
        if (invite.DeclinedAt is not null) return BadRequest(new { error = "already_declined" });
        if (invite.ExpiresAt < DateTimeOffset.UtcNow) return BadRequest(new { error = "expired" });

        var alreadyMember = await db.TeamMembers.AnyAsync(m => m.TeamId == invite.TeamId && m.UserId == userId, ct);
        if (!alreadyMember)
        {
            if (!Enum.TryParse<TeamRole>(invite.Role, ignoreCase: true, out var role))
                role = TeamRole.Member;
            db.TeamMembers.Add(new TeamMember { TeamId = invite.TeamId, UserId = userId, Role = role });
        }
        invite.AcceptedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await audit.LogAsync("team.invite_accepted", "team", invite.TeamId.ToString(), ct: ct);
        return Ok(new { teamId = invite.TeamId });
    }

    [HttpPost("invites/{inviteId:guid}/decline")]
    public async Task<IActionResult> DeclineInvite(Guid inviteId, CancellationToken ct)
    {
        var userId = currentUser.UserId;
        var invite = await db.TeamInvites.FirstOrDefaultAsync(i => i.Id == inviteId && i.InvitedUserId == userId, ct);
        if (invite is null) return NotFound();
        if (invite.AcceptedAt is not null) return BadRequest(new { error = "already_accepted" });
        if (invite.DeclinedAt is not null) return BadRequest(new { error = "already_declined" });
        if (invite.ExpiresAt < DateTimeOffset.UtcNow) return BadRequest(new { error = "expired" });

        invite.DeclinedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
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
            notificationBus.Unsubscribe(userId);
        }
    }

    private async Task SendNotificationCountsAsync(Guid userId, bool isAdmin, CancellationToken ct)
    {
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