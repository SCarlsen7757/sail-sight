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
        var boatCount = await db.Boats.CountAsync(b => b.IsPublic, ct);
        var sessionCount = await db.Sessions.CountAsync(s => s.IsPublic, ct);
        var totalSessionDurationSeconds = await db.Sessions.Where(s => s.IsPublic)
            .SumAsync(s => (double)(s.EndedAt - s.StartedAt).TotalSeconds, ct);

        var races = db.Races
            .Where(r => r.EndedAt.HasValue && r.Session != null && r.Session.IsPublic)
            .Select(r => new
            {
                DurationSeconds = (r.EndedAt!.Value - r.StartedAt).TotalSeconds,
                r.SailedDistanceMeters,
            })
            ;

        var dto = new PlatformStatsDto(
            boatClassCount,
            boatCount,
            sessionCount,
            totalSessionDurationSeconds,
            await races.CountAsync(ct),
            await races.SumAsync(r => r.DurationSeconds, ct),
            await races.SumAsync(r => r.SailedDistanceMeters, ct));

        return Ok(dto);
    }
}
