using SailSight.Api.Helpers;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SailSight.Api.Auth;
using SailSight.Api.Data;
using SailSight.Api.Models.Entities;
using SailSight.Api.Services;
using SailSight.Shared.Dtos.Races;
using SailSight.Shared.Dtos.Telemetry;

namespace SailSight.Api.Controllers;

[ApiVersion("1.0")]
[ApiController]
[Authorize]
[Route("api/v{version:apiVersion}/races")]
public class RacesController(AppDbContext db, StartAnalysisService startAnalysis, RaceLegAnalysisService legAnalysis, SessionAuthorizer sessionAuth) : ControllerBase
{
    [AllowAnonymous]
    [HttpGet]
    public async Task<ActionResult<List<RaceDto>>> GetAll([FromQuery] Guid sessionId, CancellationToken ct)
    {
        if (!await sessionAuth.CanReadAsync(sessionId, ct)) return NotFound();

        var privateAccess = await sessionAuth.CanReadPrivateAsync(sessionId, ct);
        var races = await db.Races
            .Where(r => r.SessionId == sessionId)
            .OrderBy(r => r.RaceNumber)
            .Select(r => new RaceDto(
                r.Id, r.RaceNumber, r.CourseId, r.Course != null ? r.Course.Name : null,
                r.CountdownStartedAt, r.CountdownDurationSeconds,
                r.StartedAt, r.EndedAt,
                r.EndedAt.HasValue ? (r.EndedAt.Value - r.StartedAt).TotalSeconds : null,
                r.SailedDistanceMeters, r.MaxSpeedOverGround, privateAccess ? r.Notes : null))
            .PageAsync(HttpContext, ct);
        return Ok(races);
    }

    [AllowAnonymous]
    [HttpGet("{raceId:guid}")]
    public async Task<ActionResult<RaceDetailDto>> GetById(Guid raceId, CancellationToken ct)
    {
        var race = await db.Races
            .Include(r => r.Session)
            .FirstOrDefaultAsync(r => r.Id == raceId && sessionAuth.ReadableSessionIds().Contains(r.SessionId), ct);
        if (race is null) return NotFound();
        if (!await sessionAuth.CanReadAsync(race.SessionId, ct)) return NotFound();

        var pinEnd = await db.LinePositions
            .Where(l => l.SessionId == race.SessionId && l.LineEnd == 0 && l.Time <= race.StartedAt)
            .OrderByDescending(l => l.Time)
            .Select(l => new LinePositionDto(l.Time, l.Latitude, l.Longitude))
            .FirstOrDefaultAsync(ct);

        var boatEnd = await db.LinePositions
            .Where(l => l.SessionId == race.SessionId && l.LineEnd == 1 && l.Time <= race.StartedAt)
            .OrderByDescending(l => l.Time)
            .Select(l => new LinePositionDto(l.Time, l.Latitude, l.Longitude))
            .FirstOrDefaultAsync(ct);

        var duration = race.EndedAt.HasValue ? (race.EndedAt.Value - race.StartedAt).TotalSeconds : (double?)null;
        var startAnalysisResult = await startAnalysis.ComputeAsync(race, race.SessionId, pinEnd, boatEnd, ct);
        return Ok(new RaceDetailDto(race.Id, race.SessionId, race.RaceNumber, race.CourseId, race.CountdownStartedAt, race.CountdownDurationSeconds,
            race.StartedAt, race.EndedAt, duration, race.SailedDistanceMeters, race.MaxSpeedOverGround, await sessionAuth.CanReadPrivateAsync(race.SessionId, ct) ? race.Notes : null,
            pinEnd, boatEnd, startAnalysisResult, race.Session?.TelemetryRateHz ?? 1, race.Session?.BoatId));
    }

    [AllowAnonymous]
    [HttpGet("{raceId:guid}/telemetry/positions")]
    public async Task<IActionResult> GetPositions(Guid raceId, [FromQuery] double? from, [FromQuery] double? to, CancellationToken ct)
    {
        var race = await db.Races.Include(r => r.Session).FirstOrDefaultAsync(r => r.Id == raceId && sessionAuth.ReadableSessionIds().Contains(r.SessionId), ct);
        if (race is null) return NotFound();
        if (!await sessionAuth.CanReadAsync(race.SessionId, ct)) return NotFound();
        var (start, end) = ComputeTimeWindow(race, from, to);
        var positions = await db.Positions
            .Where(p => p.SessionId == race.SessionId && p.Time >= start && p.Time <= end)
            .OrderBy(p => p.Time)
            .Select(p => new PositionDto(p.Time, p.Latitude, p.Longitude, p.SpeedOverGround, p.CourseOverGround, p.Altitude, p.QuaternionW, p.QuaternionX, p.QuaternionY, p.QuaternionZ))
            .Skip(PageOffset()).Take(10_000).ToListAsync(ct);
        NextPage(positions.Count);
        return Ok(positions);
    }

    [AllowAnonymous]
    [HttpGet("{raceId:guid}/telemetry/wind")]
    public async Task<IActionResult> GetWind(Guid raceId, [FromQuery] double? from, [FromQuery] double? to, CancellationToken ct)
    {
        var race = await db.Races.Include(r => r.Session).FirstOrDefaultAsync(r => r.Id == raceId && sessionAuth.ReadableSessionIds().Contains(r.SessionId), ct);
        if (race is null) return NotFound();
        if (!await sessionAuth.CanReadAsync(race.SessionId, ct)) return NotFound();
        var (start, end) = ComputeTimeWindow(race, from, to);
        var readings = await db.WindReadings
            .Where(w => w.SessionId == race.SessionId && w.Time >= start && w.Time <= end)
            .OrderBy(w => w.Time)
            .Select(w => new WindDto(w.Time, w.WindDirection, w.WindSpeed))
            .Skip(PageOffset()).Take(10_000).ToListAsync(ct);
        NextPage(readings.Count);
        return Ok(readings);
    }

    [AllowAnonymous]
    [HttpGet("{raceId:guid}/telemetry/speed-through-water")]
    public async Task<IActionResult> GetSpeedThroughWater(Guid raceId, [FromQuery] double? from, [FromQuery] double? to, CancellationToken ct)
    {
        var race = await db.Races.Include(r => r.Session).FirstOrDefaultAsync(r => r.Id == raceId && sessionAuth.ReadableSessionIds().Contains(r.SessionId), ct);
        if (race is null) return NotFound();
        if (!await sessionAuth.CanReadAsync(race.SessionId, ct)) return NotFound();
        var (start, end) = ComputeTimeWindow(race, from, to);
        var readings = await db.SpeedThroughWater
            .Where(s => s.SessionId == race.SessionId && s.Time >= start && s.Time <= end)
            .OrderBy(s => s.Time)
            .Select(s => new SpeedThroughWaterDto(s.Time, s.ForwardSpeed, s.HorizontalSpeed))
            .Skip(PageOffset()).Take(10_000).ToListAsync(ct);
        NextPage(readings.Count);
        return Ok(readings);
    }

    [AllowAnonymous]
    [HttpGet("{raceId:guid}/telemetry/depth")]
    public async Task<IActionResult> GetDepth(Guid raceId, [FromQuery] double? from, [FromQuery] double? to, CancellationToken ct)
    {
        var race = await db.Races.Include(r => r.Session).FirstOrDefaultAsync(r => r.Id == raceId && sessionAuth.ReadableSessionIds().Contains(r.SessionId), ct);
        if (race is null) return NotFound();
        if (!await sessionAuth.CanReadAsync(race.SessionId, ct)) return NotFound();
        var (start, end) = ComputeTimeWindow(race, from, to);
        var readings = await db.DepthReadings
            .Where(d => d.SessionId == race.SessionId && d.Time >= start && d.Time <= end)
            .OrderBy(d => d.Time)
            .Select(d => new DepthDto(d.Time, d.Depth))
            .Skip(PageOffset()).Take(10_000).ToListAsync(ct);
        NextPage(readings.Count);
        return Ok(readings);
    }

    [AllowAnonymous]
    [HttpGet("{raceId:guid}/telemetry/temperature")]
    public async Task<IActionResult> GetTemperature(Guid raceId, [FromQuery] double? from, [FromQuery] double? to, CancellationToken ct)
    {
        var race = await db.Races.Include(r => r.Session).FirstOrDefaultAsync(r => r.Id == raceId && sessionAuth.ReadableSessionIds().Contains(r.SessionId), ct);
        if (race is null) return NotFound();
        if (!await sessionAuth.CanReadAsync(race.SessionId, ct)) return NotFound();
        var (start, end) = ComputeTimeWindow(race, from, to);
        var readings = await db.TemperatureReadings
            .Where(t => t.SessionId == race.SessionId && t.Time >= start && t.Time <= end)
            .OrderBy(t => t.Time)
            .Select(t => new TemperatureDto(t.Time, t.Temperature))
            .Skip(PageOffset()).Take(10_000).ToListAsync(ct);
        NextPage(readings.Count);
        return Ok(readings);
    }

    [AllowAnonymous]
    [HttpGet("{raceId:guid}/telemetry/load")]
    public async Task<IActionResult> GetLoad(Guid raceId, [FromQuery] double? from, [FromQuery] double? to, CancellationToken ct)
    {
        var race = await db.Races.Include(r => r.Session).FirstOrDefaultAsync(r => r.Id == raceId && sessionAuth.ReadableSessionIds().Contains(r.SessionId), ct);
        if (race is null) return NotFound();
        if (!await sessionAuth.CanReadAsync(race.SessionId, ct)) return NotFound();
        var (start, end) = ComputeTimeWindow(race, from, to);
        var readings = await db.LoadReadings
            .Where(l => l.SessionId == race.SessionId && l.Time >= start && l.Time <= end)
            .OrderBy(l => l.Time)
            .Select(l => new LoadDto(l.Time, l.SensorName, l.Load))
            .Skip(PageOffset()).Take(10_000).ToListAsync(ct);
        NextPage(readings.Count);
        return Ok(readings);
    }

    [AllowAnonymous]
    [HttpGet("{raceId:guid}/telemetry/shift-angles")]
    public async Task<IActionResult> GetShiftAngles(Guid raceId, [FromQuery] double? from, [FromQuery] double? to, CancellationToken ct)
    {
        var race = await db.Races.Include(r => r.Session).FirstOrDefaultAsync(r => r.Id == raceId && sessionAuth.ReadableSessionIds().Contains(r.SessionId), ct);
        if (race is null) return NotFound();
        if (!await sessionAuth.CanReadAsync(race.SessionId, ct)) return NotFound();
        var (start, end) = ComputeTimeWindow(race, from, to);
        var readings = await db.ShiftAngles
            .Where(s => s.SessionId == race.SessionId && s.Time >= start && s.Time <= end)
            .OrderBy(s => s.Time)
            .Select(s => new ShiftAngleDto(s.Time, s.IsPort, s.IsManual, s.TrueHeading, s.SpeedOverGround))
            .Skip(PageOffset()).Take(10_000).ToListAsync(ct);
        NextPage(readings.Count);
        return Ok(readings);
    }

    [AllowAnonymous]
    [HttpGet("{raceId:guid}/telemetry")]
    [EndpointSummary("Fetches all telemetry channels in a single request.")]
    public async Task<ActionResult<RaceTelemetryDto>> GetTelemetry(Guid raceId, [FromQuery] double? from, [FromQuery] double? to, CancellationToken ct)
    {
        var race = await db.Races.Include(r => r.Session).FirstOrDefaultAsync(r => r.Id == raceId && sessionAuth.ReadableSessionIds().Contains(r.SessionId), ct);
        if (race is null) return NotFound();
        if (!await sessionAuth.CanReadAsync(race.SessionId, ct)) return NotFound();
        var (start, end) = ComputeTimeWindow(race, from, to);
        var sid = race.SessionId;

        var positions = await db.Positions
            .Where(p => p.SessionId == sid && p.Time >= start && p.Time <= end)
            .OrderBy(p => p.Time)
            .Select(p => new PositionDto(p.Time, p.Latitude, p.Longitude, p.SpeedOverGround, p.CourseOverGround, p.Altitude, p.QuaternionW, p.QuaternionX, p.QuaternionY, p.QuaternionZ))
            .Skip(PageOffset()).Take(10_000).ToListAsync(ct);

        var wind = await db.WindReadings
            .Where(w => w.SessionId == sid && w.Time >= start && w.Time <= end)
            .OrderBy(w => w.Time)
            .Select(w => new WindDto(w.Time, w.WindDirection, w.WindSpeed))
            .Skip(PageOffset()).Take(10_000).ToListAsync(ct);

        var stw = await db.SpeedThroughWater
            .Where(s => s.SessionId == sid && s.Time >= start && s.Time <= end)
            .OrderBy(s => s.Time)
            .Select(s => new SpeedThroughWaterDto(s.Time, s.ForwardSpeed, s.HorizontalSpeed))
            .Skip(PageOffset()).Take(10_000).ToListAsync(ct);

        var depth = await db.DepthReadings
            .Where(d => d.SessionId == sid && d.Time >= start && d.Time <= end)
            .OrderBy(d => d.Time)
            .Select(d => new DepthDto(d.Time, d.Depth))
            .Skip(PageOffset()).Take(10_000).ToListAsync(ct);

        var temperature = await db.TemperatureReadings
            .Where(t => t.SessionId == sid && t.Time >= start && t.Time <= end)
            .OrderBy(t => t.Time)
            .Select(t => new TemperatureDto(t.Time, t.Temperature))
            .Skip(PageOffset()).Take(10_000).ToListAsync(ct);

        var load = await db.LoadReadings
            .Where(l => l.SessionId == sid && l.Time >= start && l.Time <= end)
            .OrderBy(l => l.Time)
            .Select(l => new LoadDto(l.Time, l.SensorName, l.Load))
            .Skip(PageOffset()).Take(10_000).ToListAsync(ct);

        var shiftAngles = await db.ShiftAngles
            .Where(s => s.SessionId == sid && s.Time >= start && s.Time <= end)
            .OrderBy(s => s.Time)
            .Select(s => new ShiftAngleDto(s.Time, s.IsPort, s.IsManual, s.TrueHeading, s.SpeedOverGround))
            .Skip(PageOffset()).Take(10_000).ToListAsync(ct);

        NextPage(new[] { positions.Count, wind.Count, stw.Count, depth.Count, temperature.Count, load.Count, shiftAngles.Count }.Max());
        return Ok(new RaceTelemetryDto(positions, wind, stw, depth, temperature, load, shiftAngles));
    }

    [AllowAnonymous]
    [HttpGet("{raceId:guid}/analysis/start-line-length")]
    public async Task<ActionResult<StartLineLengthDto>> GetStartLineLength(Guid raceId, CancellationToken ct)
    {
        var race = await db.Races.Include(r => r.Session).FirstOrDefaultAsync(r => r.Id == raceId && sessionAuth.ReadableSessionIds().Contains(r.SessionId), ct);
        if (race is null) return NotFound();
        if (!await sessionAuth.CanReadAsync(race.SessionId, ct)) return NotFound();

        var pinEnd = await db.LinePositions
            .Where(l => l.SessionId == race.SessionId && l.LineEnd == 0 && l.Time <= race.StartedAt)
            .OrderByDescending(l => l.Time)
            .Select(l => new LinePositionDto(l.Time, l.Latitude, l.Longitude))
            .FirstOrDefaultAsync(ct);
        var boatEnd = await db.LinePositions
            .Where(l => l.SessionId == race.SessionId && l.LineEnd == 1 && l.Time <= race.StartedAt)
            .OrderByDescending(l => l.Time)
            .Select(l => new LinePositionDto(l.Time, l.Latitude, l.Longitude))
            .FirstOrDefaultAsync(ct);
        var result = StartAnalysisService.ComputeLineLength(pinEnd, boatEnd);
        if (result is null) return NoContent();
        return Ok(result);
    }

    [HttpPatch("{raceId:guid}")]
    public async Task<ActionResult<RaceDto>> Patch(Guid raceId, PatchRaceRequest request, CancellationToken ct)
    {
        var race = await db.Races
            .Include(r => r.Course)
            .FirstOrDefaultAsync(r => r.Id == raceId && sessionAuth.ReadableSessionIds().Contains(r.SessionId), ct);
        if (race is null) return NotFound();
        if (!await sessionAuth.CanWriteAsync(race.SessionId, ct)) return NotFound();

        if (request.CourseId.HasValue && request.CourseId.Value != Guid.Empty && !await sessionAuth.OwnsCourseAsync(request.CourseId.Value, ct)) return BadRequest(new { error = "invalid_course" });
        if (request.CourseId.HasValue)
        {
            race.CourseId = request.CourseId.Value == Guid.Empty ? null : request.CourseId.Value;
            if (race.CourseId != null)
            {
                // Trigger leg analysis
                await legAnalysis.AnalyzeRaceAsync(race.Id, ct);
            }
        }
        if (request.Notes is not null)
            race.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes;
        await db.SaveChangesAsync(ct);
        await db.Entry(race).Reference(r => r.Course).LoadAsync(ct);

        return Ok(new RaceDto(
            race.Id, race.RaceNumber, race.CourseId, race.Course?.Name,
            race.CountdownStartedAt, race.CountdownDurationSeconds,
            race.StartedAt, race.EndedAt,
            race.EndedAt.HasValue ? (race.EndedAt.Value - race.StartedAt).TotalSeconds : null,
            race.SailedDistanceMeters, race.MaxSpeedOverGround, race.Notes));
    }

    private int PageOffset()
    {
        if (!Request.Query.TryGetValue("offset", out var value)) return 0;
        if (!int.TryParse(value, out var offset) || offset < 0 || offset > 5_000_000)
            throw new BadHttpRequestException("Invalid telemetry offset.", 400);
        return offset;
    }
    private void NextPage(int count)
    {
        if (count == 10_000) Response.Headers["X-Next-Offset"] = (PageOffset() + 10_000).ToString();
    }

    private static (DateTimeOffset Start, DateTimeOffset End) ComputeTimeWindow(Race race, double? fromSeconds, double? toSeconds)
    {
        if ((fromSeconds.HasValue && !double.IsFinite(fromSeconds.Value)) ||
            (toSeconds.HasValue && !double.IsFinite(toSeconds.Value))) throw new BadHttpRequestException("Invalid time window.", 400);
        var session = race.Session ?? throw new BadHttpRequestException("Session unavailable.", 404);
        var minimum = (session.StartedAt - race.StartedAt).TotalSeconds;
        var maximum = (session.EndedAt - race.StartedAt).TotalSeconds;
        if ((fromSeconds.HasValue && (fromSeconds < minimum || fromSeconds > maximum)) ||
            (toSeconds.HasValue && (toSeconds < minimum || toSeconds > maximum)) ||
            (fromSeconds ?? 0) > (toSeconds ?? (race.EndedAt ?? session.EndedAt).Subtract(race.StartedAt).TotalSeconds))
            throw new BadHttpRequestException("Time window must be ordered and within the session.", 400);
        var start = fromSeconds.HasValue ? race.StartedAt.AddSeconds(fromSeconds.Value) : race.StartedAt;
        var end = toSeconds.HasValue ? race.StartedAt.AddSeconds(toSeconds.Value) : race.EndedAt ?? session.EndedAt;
        return (start, end);
    }
}
