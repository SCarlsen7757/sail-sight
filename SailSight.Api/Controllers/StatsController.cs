using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SailSight.Api.Data;
using SailSight.Shared.Dtos.Stats;

namespace SailSight.Api.Controllers;

[ApiVersion("1.0")]
[ApiController]
[AllowAnonymous]
[Route("api/v{version:apiVersion}/stats")]
public class StatsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    [EndpointSummary("Platform-wide aggregate statistics. Safe to expose publicly.")]
    public async Task<ActionResult<PlatformStatsDto>> GetPlatformStats(CancellationToken ct)
    {
        var boatClassCount = await db.BoatClasses.CountAsync(ct);
        var boatCount = await db.Boats.CountAsync(ct);
        var sessionCount = await db.Sessions.CountAsync(ct);
        var totalSessionDurationSeconds = await db.Sessions
            .SumAsync(s => (double)(s.EndedAt - s.StartedAt).TotalSeconds, ct);

        var races = await db.Races
            .Where(r => r.EndedAt.HasValue)
            .Select(r => new
            {
                DurationSeconds = (r.EndedAt!.Value - r.StartedAt).TotalSeconds,
                r.SailedDistanceMeters,
            })
            .ToListAsync(ct);

        var dto = new PlatformStatsDto(
            boatClassCount,
            boatCount,
            sessionCount,
            totalSessionDurationSeconds,
            races.Count,
            races.Sum(r => r.DurationSeconds),
            races.Sum(r => r.SailedDistanceMeters));

        return Ok(dto);
    }
}
