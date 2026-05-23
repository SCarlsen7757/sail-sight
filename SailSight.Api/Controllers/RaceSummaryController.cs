using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text;
using SailSight.Api.Auth;
using SailSight.Api.Data;
using SailSight.Api.Services;
using SailSight.Shared.Dtos.Races;

namespace SailSight.Api.Controllers;

[ApiVersion("1.0")]
[ApiController]
[Authorize]
[Route("api/v{version:apiVersion}/races/{raceId:guid}/summary")]
public class RaceSummaryController(AppDbContext db, IConfiguration config, IServiceProvider sp, SessionAuthorizer sessionAuth) : ControllerBase
{
    private RaceSummaryService? SummaryService => sp.GetService<RaceSummaryService>();

    [HttpGet]
    public async Task<ActionResult<RaceSummaryDto>> Get(Guid raceId, CancellationToken ct)
    {
        var race = await db.Races.FirstOrDefaultAsync(r => r.Id == raceId, ct);
        if (race is null) return NotFound();
        if (!await sessionAuth.CanReadAsync(race.SessionId, ct)) return NotFound();

        var report = await db.RaceSummaryReports
            .FirstOrDefaultAsync(r => r.RaceId == raceId, ct);
        if (report is null) return NotFound();

        var summaryService = SummaryService;
        var isStale = false;
        if (summaryService is not null)
        {
            var currentHash = await summaryService.ComputeCurrentHashAsync(raceId, ct);
            isStale = currentHash is not null && currentHash != report.ContextHash;
        }
        return Ok(new RaceSummaryDto(report.Content, report.Model, report.GeneratedAt, isStale));
    }

    [HttpPost]
    public async Task Post(Guid raceId, CancellationToken ct)
    {
        var race = await db.Races.FirstOrDefaultAsync(r => r.Id == raceId, ct);
        if (race is null || !await sessionAuth.CanWriteAsync(race.SessionId, ct))
        {
            HttpContext.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        var summaryService = SummaryService;
        if (summaryService is null)
        {
            HttpContext.Response.StatusCode = StatusCodes.Status501NotImplemented;
            return;
        }

        var result = await summaryService.BuildContextAsync(raceId, ct);
        if (result is null)
        {
            HttpContext.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        var (context, hash) = result.Value;
        var model = config["RaceSummary:Model"] ?? "gpt-4o-mini";

        Response.ContentType = "text/event-stream";
        Response.Headers.CacheControl = "no-cache";
        Response.Headers.Connection = "keep-alive";

        var accumulated = new StringBuilder();
        await foreach (var token in summaryService.StreamAsync(context, ct))
        {
            accumulated.Append(token);
            await Response.WriteAsync($"data: {token}\n\n", ct);
            await Response.Body.FlushAsync(ct);
        }
        await Response.WriteAsync("data: [DONE]\n\n", ct);
        await Response.Body.FlushAsync(ct);
        await summaryService.SaveAsync(raceId, accumulated.ToString(), model, hash, ct);
    }

    [HttpDelete]
    public async Task<IActionResult> Delete(Guid raceId, CancellationToken ct)
    {
        var race = await db.Races.FirstOrDefaultAsync(r => r.Id == raceId, ct);
        if (race is null) return NotFound();
        if (!await sessionAuth.CanWriteAsync(race.SessionId, ct)) return NotFound();

        var report = await db.RaceSummaryReports
            .FirstOrDefaultAsync(r => r.RaceId == raceId, ct);
        if (report is not null)
        {
            db.RaceSummaryReports.Remove(report);
            await db.SaveChangesAsync(ct);
        }
        return NoContent();
    }
}

