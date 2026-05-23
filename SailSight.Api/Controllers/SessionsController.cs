using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SailSight.Api.Audit;
using SailSight.Api.Auth;
using SailSight.Api.Data;
using SailSight.Api.Models.Entities;
using SailSight.Api.Services;
using SailSight.Shared.Dtos;
using SailSight.Shared.Dtos.Courses;
using SailSight.Shared.Dtos.Races;
using SailSight.Shared.Dtos.Sessions;
using SailSight.Shared.Dtos.Shares;

namespace SailSight.Api.Controllers;

[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/sessions")]
public class SessionsController(
    AppDbContext db,
    VkxIngestionService ingestionService,
    ICurrentUser currentUser,
    SessionAuthorizer sessionAuth,
    IAuditService audit) : ControllerBase
{
    [HttpPost]
    [Authorize]
    [RequestSizeLimit(200_000_000)]
    public async Task<ActionResult<SessionDetailDto>> Upload(IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "No file provided." });

        var ownerId = currentUser.UserId;

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        var fileBytes = ms.ToArray();
        var contentHash = VkxIngestionService.ComputeHash(fileBytes);

        if (await ingestionService.IsDuplicateAsync(ownerId, contentHash, ct))
            return Conflict(new { message = "A session with the same file content has already been uploaded." });

        var session = await ingestionService.IngestAsync(ownerId, fileBytes, file.FileName, contentHash, ct);

        var dto = new SessionDetailDto(
            session.Id, session.BoatId, null, session.CourseId, null,
            session.FileName, session.DisplayName, session.ContentHash, session.FormatVersion,
            session.TelemetryRateHz, session.IsFixedToBodyFrame, session.IsPublic,
            session.StartedAt, session.EndedAt, session.UploadedAt, session.Notes,
            IsOwned: true,
            [.. session.Races.OrderBy(r => r.RaceNumber).Select(r => new RaceDto(
                r.Id, r.RaceNumber, r.CourseId, r.Course?.Name,
                r.CountdownStartedAt, r.CountdownDurationSeconds,
                r.StartedAt, r.EndedAt,
                r.EndedAt.HasValue ? (r.EndedAt.Value - r.StartedAt).TotalSeconds : null,
                r.SailedDistanceMeters, r.MaxSpeedOverGround, r.Notes))]
        );
        return CreatedAtAction(nameof(GetById), new { id = session.Id }, dto);
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<PagedResult<SessionSummaryDto>>> GetAll(
        [FromQuery] Guid? boatId,
        [FromQuery] Guid? courseId,
        [FromQuery] int? year,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        [FromQuery] string? search,
        [FromQuery] string? visibility,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 25;
        if (pageSize > 100) pageSize = 100;

        var visibleIds = sessionAuth.ReadableSessionIds();
        var userId = currentUser.IsAuthenticated ? currentUser.UserId : (Guid?)null;

        var userTeamIds = userId.HasValue
            ? await db.TeamMembers.Where(m => m.UserId == userId.Value).Select(m => m.TeamId).ToListAsync(ct)
            : [];

        var query = db.Sessions.Where(s => visibleIds.Contains(s.Id))
            .Include(s => s.Boat)
            .Include(s => s.Course)
            .Include(s => s.Races)
            .Include(s => s.Shares).ThenInclude(sh => sh.Team)
            .AsQueryable();

        if (boatId.HasValue) query = query.Where(s => s.BoatId == boatId.Value);
        if (courseId.HasValue) query = query.Where(s => s.CourseId == courseId.Value);
        if (year.HasValue) query = query.Where(s => s.StartedAt.Year == year.Value);
        if (from.HasValue) query = query.Where(s => s.StartedAt >= from.Value);
        if (to.HasValue) query = query.Where(s => s.StartedAt <= to.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            var pattern = $"%{s}%";
            query = query.Where(x =>
                EF.Functions.ILike(x.FileName, pattern) ||
                (x.DisplayName != null && EF.Functions.ILike(x.DisplayName, pattern)));
        }

        if (!string.IsNullOrWhiteSpace(visibility))
        {
            var vis = visibility.Trim().ToLowerInvariant();
            switch (vis)
            {
                case "mine":
                    if (!userId.HasValue) return Ok(new PagedResult<SessionSummaryDto>([], 0, page, pageSize));
                    query = query.Where(x => x.OwnerUserId == userId.Value);
                    break;
                case "team":
                    if (!userId.HasValue || userTeamIds.Count == 0)
                        return Ok(new PagedResult<SessionSummaryDto>([], 0, page, pageSize));
                    query = query.Where(x => x.OwnerUserId != userId.Value
                        && x.Shares.Any(sh => userTeamIds.Contains(sh.TeamId)));
                    break;
                case "public":
                    query = query.Where(x => x.IsPublic);
                    break;
            }
        }

        var total = await query.CountAsync(ct);
        var sessions = await query
            .OrderByDescending(s => s.UploadedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var items = sessions.Select(s => new SessionSummaryDto(
            s.Id, s.BoatId, s.Boat?.Name,
            s.CourseId, s.Course?.Name,
            s.FileName, s.DisplayName, s.FormatVersion, s.TelemetryRateHz, s.IsFixedToBodyFrame,
            s.StartedAt, s.EndedAt, s.UploadedAt, s.Notes, s.Races.Count,
            IsOwned: userId.HasValue && s.OwnerUserId == userId.Value,
            IsPublic: s.IsPublic,
            SharedViaTeams: s.Shares
                .Where(sh => userTeamIds.Contains(sh.TeamId))
                .Select(sh => sh.Team.Name)
                .ToList()
        )).ToList();

        return Ok(new PagedResult<SessionSummaryDto>(items, total, page, pageSize));
    }

    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    public async Task<ActionResult<SessionDetailDto>> GetById(Guid id, CancellationToken ct)
    {
        if (!await sessionAuth.CanReadAsync(id, ct)) return NotFound();

        var session = await db.Sessions
            .Include(s => s.Boat)
            .Include(s => s.Course)
            .Include(s => s.Races.OrderBy(r => r.RaceNumber))
                .ThenInclude(r => r.Course)
            .FirstOrDefaultAsync(s => s.Id == id, ct);
        if (session is null) return NotFound();

        var isOwned = currentUser.IsAuthenticated && session.OwnerUserId == currentUser.UserId;
        return Ok(BuildDetail(session, isOwned));
    }

    [HttpGet("{id:guid}/course-layout")]
    [AllowAnonymous]
    [EndpointSummary("Coordinate-only course layout for a public session (anonymous safe).")]
    public async Task<ActionResult<PublicCourseLayoutDto>> GetCourseLayout(Guid id, CancellationToken ct)
    {
        // Only expose course geometry for sessions that are explicitly public.
        // Owners/team members should use the regular course endpoint with full details.
        var session = await db.Sessions
            .Where(s => s.Id == id && s.IsPublic)
            .Select(s => new { s.CourseId })
            .FirstOrDefaultAsync(ct);
        if (session is null || session.CourseId is null) return NotFound();

        var course = await db.Courses
            .Where(c => c.Id == session.CourseId)
            .Include(c => c.StartMark1)
            .Include(c => c.StartMark2)
            .Include(c => c.FinishMark1)
            .Include(c => c.FinishMark2)
            .Include(c => c.Legs.OrderBy(l => l.SortOrder))
                .ThenInclude(l => l.Mark)
            .Include(c => c.Legs)
                .ThenInclude(l => l.GateMark)
            .FirstOrDefaultAsync(ct);
        if (course is null) return NotFound();

        var legs = course.Legs.OrderBy(l => l.SortOrder).Select(l => new PublicCourseLegDto(
            l.SortOrder,
            l.LegType.ToString(),
            l.PassingSide.ToString(),
            l.Mark.Latitude, l.Mark.Longitude,
            l.GateMark?.Latitude, l.GateMark?.Longitude
        )).ToList();

        var dto = new PublicCourseLayoutDto(
            course.StartLineSource.ToString(),
            course.StartMark1?.Latitude, course.StartMark1?.Longitude,
            course.StartMark2?.Latitude, course.StartMark2?.Longitude,
            course.FinishLineSource.ToString(),
            course.FinishMark1?.Latitude, course.FinishMark1?.Longitude,
            course.FinishMark2?.Latitude, course.FinishMark2?.Longitude,
            legs);
        return Ok(dto);
    }

    [HttpPatch("{id:guid}")]
    [Authorize]
    public async Task<ActionResult<SessionDetailDto>> Patch(Guid id, PatchSessionRequest request, CancellationToken ct)
    {
        var userId = currentUser.UserId;
        var session = await db.Sessions
            .Include(s => s.Boat)
            .Include(s => s.Course)
            .Include(s => s.Races.OrderBy(r => r.RaceNumber))
                .ThenInclude(r => r.Course)
            .FirstOrDefaultAsync(s => s.Id == id && s.OwnerUserId == userId, ct);
        if (session is null) return NotFound();

        if (request.BoatId.HasValue) session.BoatId = request.BoatId.Value;
        if (request.CourseId.HasValue) session.CourseId = request.CourseId.Value;
        if (request.Notes is not null) session.Notes = request.Notes;
        if (request.IsPublic.HasValue) session.IsPublic = request.IsPublic.Value;
        if (request.DisplayName is not null)
            session.DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? null : request.DisplayName.Trim();
        await db.SaveChangesAsync(ct);
        await db.Entry(session).Reference(s => s.Boat).LoadAsync(ct);
        await db.Entry(session).Reference(s => s.Course).LoadAsync(ct);
        return Ok(BuildDetail(session, isOwned: true));
    }

    [HttpDelete("{id:guid}")]
    [Authorize]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var userId = currentUser.UserId;
        var session = await db.Sessions.FirstOrDefaultAsync(s => s.Id == id && s.OwnerUserId == userId, ct);
        if (session is null) return NotFound();
        db.Sessions.Remove(session);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── Shares ──────────────────────────────────────────────────────────

    [HttpGet("{sessionId:guid}/shares")]
    [Authorize]
    public async Task<ActionResult<List<SessionShareDto>>> GetShares(Guid sessionId, CancellationToken ct)
    {
        var userId = currentUser.UserId;
        if (!await db.Sessions.AnyAsync(s => s.Id == sessionId && s.OwnerUserId == userId, ct)) return NotFound();
        var shares = await db.SessionShares
            .Where(sh => sh.SessionId == sessionId)
            .Select(sh => new SessionShareDto(sh.SessionId, sh.TeamId, sh.Team.Name, sh.CreatedAt))
            .ToListAsync(ct);
        return Ok(shares);
    }

    [HttpPut("{sessionId:guid}/shares")]
    [Authorize]
    public async Task<ActionResult<SessionShareDto>> CreateOrUpdateShare(Guid sessionId, [FromBody] CreateShareRequest req, CancellationToken ct)
    {
        var userId = currentUser.UserId;
        if (!await db.Sessions.AnyAsync(s => s.Id == sessionId && s.OwnerUserId == userId, ct)) return NotFound();

        var isMember = await db.TeamMembers.AnyAsync(m => m.TeamId == req.TeamId && m.UserId == userId, ct);
        if (!isMember) return BadRequest(new { error = "not_team_member" });

        var existing = await db.SessionShares.FirstOrDefaultAsync(sh => sh.SessionId == sessionId && sh.TeamId == req.TeamId, ct);
        if (existing is null)
        {
            existing = new SessionShare { SessionId = sessionId, TeamId = req.TeamId };
            db.SessionShares.Add(existing);
        }
        await db.SaveChangesAsync(ct);
        await audit.LogAsync("session.share", "session", sessionId.ToString(), details: req.TeamId.ToString(), ct: ct);

        var teamName = await db.Teams.Where(t => t.Id == req.TeamId).Select(t => t.Name).FirstAsync(ct);
        return Ok(new SessionShareDto(sessionId, req.TeamId, teamName, existing.CreatedAt));
    }

    [HttpDelete("{sessionId:guid}/shares/{teamId:guid}")]
    [Authorize]
    public async Task<IActionResult> DeleteShare(Guid sessionId, Guid teamId, CancellationToken ct)
    {
        var userId = currentUser.UserId;
        if (!await db.Sessions.AnyAsync(s => s.Id == sessionId && s.OwnerUserId == userId, ct)) return NotFound();
        var share = await db.SessionShares.FirstOrDefaultAsync(sh => sh.SessionId == sessionId && sh.TeamId == teamId, ct);
        if (share is null) return NotFound();
        db.SessionShares.Remove(share);
        await db.SaveChangesAsync(ct);
        await audit.LogAsync("session.unshare", "session", sessionId.ToString(), details: teamId.ToString(), ct: ct);
        return NoContent();
    }

    private static SessionDetailDto BuildDetail(Models.Entities.Session session, bool isOwned) =>
        new(
            session.Id, session.BoatId, session.Boat?.Name,
            session.CourseId, session.Course?.Name,
            session.FileName, session.DisplayName, session.ContentHash, session.FormatVersion,
            session.TelemetryRateHz, session.IsFixedToBodyFrame, session.IsPublic,
            session.StartedAt, session.EndedAt, session.UploadedAt, session.Notes,
            isOwned,
            [.. session.Races.Select(r => new RaceDto(
                r.Id, r.RaceNumber, r.CourseId, r.Course?.Name,
                r.CountdownStartedAt, r.CountdownDurationSeconds,
                r.StartedAt, r.EndedAt,
                r.EndedAt.HasValue ? (r.EndedAt.Value - r.StartedAt).TotalSeconds : null,
                r.SailedDistanceMeters, r.MaxSpeedOverGround, r.Notes))]);
}
