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
using SailSight.Shared.Dtos.Sessions;
using SailSight.Shared.Dtos.Teams;

using SailSight.Api.Services;

namespace SailSight.Api.Controllers;

[ApiVersion("1.0")]
[ApiController]
[Authorize]
[Route("api/v{version:apiVersion}/teams")]
public class TeamsController(
    AppDbContext db,
    ICurrentUser currentUser,
    IAuditService audit,
    NotificationBus notificationBus) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<TeamDto>>> GetMyTeams(CancellationToken ct)
    {
        var userId = currentUser.UserId;
        var teams = await db.TeamMembers
            .Where(tm => tm.UserId == userId)
            .OrderBy(tm => tm.TeamId)
            .Select(tm => new TeamDto(
                tm.Team.Id, tm.Team.Name, tm.Team.CreatedAt,
                tm.Team.Members.Count, tm.Role.ToString()))
            .PageAsync(HttpContext, ct);
        return Ok(teams);
    }

    [HttpPost]
    public async Task<ActionResult<TeamDto>> Create([FromBody] CreateTeamRequest req, CancellationToken ct)
    {
        var userId = currentUser.UserId;
        await using var tx = await SecurityTransactions.BeginAsync(db, ct);
        var team = new Team { Name = req.Name, CreatedByUserId = userId };
        db.Teams.Add(team);
        db.TeamMembers.Add(new TeamMember { TeamId = team.Id, UserId = userId, Role = TeamRole.Owner });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        await audit.LogAsync("team.create", "team", team.Id.ToString(), ct: ct);
        return CreatedAtAction(nameof(GetById), new { teamId = team.Id },
            new TeamDto(team.Id, team.Name, team.CreatedAt, 1, TeamRole.Owner.ToString()));
    }

    [HttpGet("{teamId:guid}")]
    public async Task<ActionResult<TeamDetailDto>> GetById(Guid teamId, CancellationToken ct)
    {
        var userId = currentUser.UserId;
        var membership = await db.TeamMembers.FirstOrDefaultAsync(tm => tm.TeamId == teamId && tm.UserId == userId, ct);
        if (membership is null) return NotFound();

        var team = await db.Teams
            .Include(t => t.Members.OrderBy(m => m.UserId).Take(100)).ThenInclude(m => m.User)
            .FirstOrDefaultAsync(t => t.Id == teamId, ct);
        if (team is null) return NotFound();

        return Ok(new TeamDetailDto(team.Id, team.Name, team.CreatedAt,
            [.. team.Members.Select(m => new TeamMemberDto(m.UserId, m.User.Email!, m.User.DisplayName, m.Role.ToString(), m.JoinedAt))]));
    }

    [HttpPatch("{teamId:guid}")]
    public async Task<IActionResult> Update(Guid teamId, [FromBody] UpdateTeamRequest req, CancellationToken ct)
    {
        await using var tx = await SecurityTransactions.BeginAsync(db, ct);
        if (!await IsAdminAsync(teamId, ct)) return Forbid();
        var team = await db.Teams.FindAsync([teamId], ct);
        if (team is null) return NotFound();
        team.Name = req.Name;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Ok();
    }

    [HttpDelete("{teamId:guid}")]
    public async Task<IActionResult> Delete(Guid teamId, CancellationToken ct)
    {
        await using var tx = await SecurityTransactions.BeginAsync(db, ct);
        var userId = currentUser.UserId;
        var membership = await db.TeamMembers.FirstOrDefaultAsync(tm => tm.TeamId == teamId && tm.UserId == userId, ct);
        if (membership is null || membership.Role != TeamRole.Owner) return Forbid();
        var team = await db.Teams.FindAsync([teamId], ct);
        if (team is null) return NotFound();
        db.Teams.Remove(team);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        await audit.LogAsync("team.delete", "team", teamId.ToString(), ct: ct);
        return NoContent();
    }

    [HttpGet("{teamId:guid}/members")]
    public async Task<ActionResult<List<TeamMemberDto>>> GetMembers(Guid teamId, CancellationToken ct)
    {
        var userId = currentUser.UserId;
        if (!await db.TeamMembers.AnyAsync(tm => tm.TeamId == teamId && tm.UserId == userId, ct)) return NotFound();
        var members = await db.TeamMembers
            .Where(m => m.TeamId == teamId)
            .OrderBy(m => m.UserId)
            .Select(m => new TeamMemberDto(m.UserId, m.User.Email!, m.User.DisplayName, m.Role.ToString(), m.JoinedAt))
            .PageAsync(HttpContext, ct);
        return Ok(members);
    }

    [HttpPatch("{teamId:guid}/members/{memberId:guid}")]
    public async Task<IActionResult> UpdateMemberRole(Guid teamId, Guid memberId, [FromBody] UpdateMemberRoleRequest req, CancellationToken ct)
    {
        await using var tx = await SecurityTransactions.BeginAsync(db, ct);
        if (!await IsAdminAsync(teamId, ct)) return Forbid();
        if (!SecurityTransactions.TryTeamRole(req.Role, out var role)) return BadRequest();
        var member = await db.TeamMembers.FirstOrDefaultAsync(m => m.TeamId == teamId && m.UserId == memberId, ct);
        if (member is null) return NotFound();
        var actor = await db.TeamMembers.SingleAsync(m => m.TeamId == teamId && m.UserId == currentUser.UserId, ct);
        if (!SecurityTransactions.CanManage(actor.Role, member.Role, role)) return Forbid();
        if (member.Role == TeamRole.Owner && role != TeamRole.Owner &&
            await db.TeamMembers.CountAsync(m => m.TeamId == teamId && m.Role == TeamRole.Owner, ct) <= 1)
            return Conflict(new { error = "cannot_demote_last_owner" });
        member.Role = role;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        await audit.LogAsync("team.role_change", "team_member", $"{teamId}:{memberId}", details: role.ToString(), ct: ct);
        return Ok();
    }

    [HttpDelete("{teamId:guid}/members/{memberId:guid}")]
    public async Task<IActionResult> RemoveMember(Guid teamId, Guid memberId, CancellationToken ct)
    {
        await using var tx = await SecurityTransactions.BeginAsync(db, ct);
        var userId = currentUser.UserId;
        // Allow self-removal or admin removal.
        var requester = await db.TeamMembers.FirstOrDefaultAsync(m => m.TeamId == teamId && m.UserId == userId, ct);
        if (requester is null) return NotFound();
        if (memberId != userId && requester.Role < TeamRole.Admin) return Forbid();

        var target = await db.TeamMembers.FirstOrDefaultAsync(m => m.TeamId == teamId && m.UserId == memberId, ct);
        if (target is null) return NotFound();
        if (memberId != userId && !SecurityTransactions.CanManage(requester.Role, target.Role, TeamRole.Member)) return Forbid();
        // Prevent removing the last owner.
        if (target.Role == TeamRole.Owner)
        {
            var ownerCount = await db.TeamMembers.CountAsync(m => m.TeamId == teamId && m.Role == TeamRole.Owner, ct);
            if (ownerCount <= 1) return Conflict(new { error = "cannot_remove_last_owner" });
        }
        db.TeamMembers.Remove(target);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return NoContent();
    }

    [HttpPost("{teamId:guid}/invites")]
    public async Task<ActionResult<TeamInviteDto>> Invite(Guid teamId, [FromBody] InviteMemberRequest req, CancellationToken ct)
    {
        await using var tx = await SecurityTransactions.BeginAsync(db, ct);
        if (!await IsAdminAsync(teamId, ct)) return Forbid();
        if (!SecurityTransactions.TryTeamRole(req.Role, out var role)) return BadRequest();

        var actor = await db.TeamMembers.SingleAsync(m => m.TeamId == teamId && m.UserId == currentUser.UserId, ct);
        if (!SecurityTransactions.CanManage(actor.Role, TeamRole.Member, role)) return Forbid();
        var normalizedEmail = req.Email.ToUpperInvariant();
        var invitee = await db.Users.FirstOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail, ct);
        if (invitee is null) return NotFound(new { error = "user_not_found" });

        var alreadyMember = await db.TeamMembers.AnyAsync(m => m.TeamId == teamId && m.UserId == invitee.Id, ct);
        if (alreadyMember) return Conflict(new { error = "already_member" });

        var pendingInvite = await db.TeamInvites.AnyAsync(
            i => i.TeamId == teamId && i.InvitedUserId == invitee.Id && i.AcceptedAt == null && i.DeclinedAt == null && i.ExpiresAt > DateTimeOffset.UtcNow, ct);
        if (pendingInvite) return Conflict(new { error = "invite_already_pending" });

        var invite = new TeamInvite
        {
            TeamId = teamId,
            InvitedUserId = invitee.Id,
            Email = invitee.Email!,
            Role = role.ToString(),
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(7),
        };
        db.TeamInvites.Add(invite);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        await audit.LogAsync("team.invite", "team", teamId.ToString(), details: req.Email, ct: ct);
        notificationBus.Notify(invitee.Id);

        return Ok(new TeamInviteDto(invite.Id, invite.Email, invitee.DisplayName, invite.Role, invite.CreatedAt, invite.ExpiresAt));
    }

    [HttpGet("{teamId:guid}/invites")]
    public async Task<ActionResult<List<TeamPendingInviteDto>>> GetInvites(Guid teamId, CancellationToken ct)
    {
        if (!await IsAdminAsync(teamId, ct)) return Forbid();

        var invites = await db.TeamInvites
            .Where(i => i.TeamId == teamId && i.AcceptedAt == null && i.DeclinedAt == null && i.ExpiresAt > DateTimeOffset.UtcNow)
            .OrderBy(i => i.Id)
            .Select(i => new TeamPendingInviteDto(i.Id, i.InvitedUserId, i.Email, i.InvitedUser.DisplayName, i.Role, i.CreatedAt, i.ExpiresAt))
            .PageAsync(HttpContext, ct);

        return Ok(invites);
    }

    private async Task<bool> IsAdminAsync(Guid teamId, CancellationToken ct)
    {
        var userId = currentUser.UserId;
        var m = await db.TeamMembers.FirstOrDefaultAsync(tm => tm.TeamId == teamId && tm.UserId == userId, ct);
        return m is not null && m.Role >= TeamRole.Admin;
    }

    [HttpGet("{teamId:guid}/sessions")]
    public async Task<ActionResult<List<SessionSummaryDto>>> GetTeamSessions(Guid teamId, CancellationToken ct)
    {
        var userId = currentUser.UserId;
        if (!await db.TeamMembers.AnyAsync(tm => tm.TeamId == teamId && tm.UserId == userId, ct)) return NotFound();

        var sessions = await db.Sessions
            .Where(s => db.SessionShares.Any(sh => sh.SessionId == s.Id && sh.TeamId == teamId))
            .Include(s => s.Boat)
            .Include(s => s.Course)
            .Include(s => s.Races)
            .Include(s => s.Shares).ThenInclude(sh => sh.Team)
            .OrderByDescending(s => s.StartedAt).ThenBy(s => s.Id)
            .PageAsync(HttpContext, ct);

        var userTeamIds = await db.TeamMembers.Where(m => m.UserId == userId).Select(m => m.TeamId).ToListAsync(ct);

        var result = sessions.Select(s => new SessionSummaryDto(
            s.Id, s.BoatId, s.Boat?.Name,
            s.CourseId, s.Course?.Name,
            s.FileName, s.DisplayName, s.FormatVersion, s.TelemetryRateHz, s.IsFixedToBodyFrame,
            s.StartedAt, s.EndedAt, s.UploadedAt, s.Notes, s.Races.Count,
            IsOwned: s.OwnerUserId == userId,
            IsPublic: s.IsPublic,
            SharedViaTeams: s.Shares
                .Where(sh => userTeamIds.Contains(sh.TeamId))
                .Select(sh => sh.Team.Name)
                .ToList()
        )).ToList();

        return Ok(result);
    }
}
