using SailSight.Api.Helpers;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SailSight.Api.Auth;
using SailSight.Api.Data;
using SailSight.Shared.Dtos.Races;

namespace SailSight.Api.Controllers;

[ApiVersion("1.0")]
[ApiController]
[Authorize]
[Route("api/v{version:apiVersion}/performance")]
public class PerformanceController(AppDbContext db, SessionAuthorizer sessionAuth) : ControllerBase
{
    // AllowAnonymous so that public sessions are readable without authentication.
    // Session visibility is enforced by sessionAuth.CanReadAsync regardless.
    [AllowAnonymous]
    [HttpGet("legs")]
    public async Task<ActionResult<List<RaceLegPerformanceDto>>> GetLegs([FromQuery] Guid raceId, CancellationToken ct)
    {
        var sessionObj = await db.Races
            .AsNoTracking()
            .Where(r => r.Id == raceId)
            .Select(r => new { r.SessionId, r.AnalysisRevision, r.AnalysisStatus })
            .FirstOrDefaultAsync(ct);
        if (sessionObj == null) return NotFound();

        if (!await sessionAuth.CanReadAsync(sessionObj.SessionId, ct)) return NotFound();

        if (sessionObj.AnalysisRevision != Services.RaceLegAnalysisService.CurrentRevision || sessionObj.AnalysisStatus == Models.Entities.RaceAnalysisStatus.Error)
            return Ok(new List<RaceLegPerformanceDto>());

        var perfs = await db.RaceLegPerformances
            .AsNoTracking()
            .Where(p => p.RaceId == raceId)
            .OrderBy(p => p.LegIndex)
            .Select(p => new RaceLegPerformanceDto(
                p.Id,
                p.RaceId,
                p.CourseLegId,
                p.CourseLeg.LegName ?? $"Leg {p.LegIndex}",
                p.LegIndex,
                p.Status.ToString(), p.Reason,
                p.ExitedPreviousMarkAt,
                p.EnteredCurrentMarkAt, p.ExitedCurrentMarkAt,
                p.SailedDistanceMeters,
                p.AverageSpeedOverGround,
                p.AverageVelocityMadeGood,
                p.MaxSpeedOverGround, p.TargetType.ToString(), p.TargetLatitude, p.TargetLongitude))
            .PageAsync(HttpContext, ct);

        return Ok(perfs);
    }
}
