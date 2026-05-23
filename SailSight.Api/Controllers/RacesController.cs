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
public class RacesController(AppDbContext db, StartAnalysisService startAnalysis, SessionAuthorizer sessionAuth) : ControllerBase
{
    [AllowAnonymous]
    [HttpGet]
    public async Task<ActionResult<List<RaceDto>>> GetAll([FromQuery] Guid sessionId, CancellationToken ct)
    {
        if (!await sessionAuth.CanReadAsync(sessionId, ct)) return NotFound();

        var races = await db.Races
            .Where(r => r.SessionId == sessionId)
            .OrderBy(r => r.RaceNumber)
            .Select(r => new RaceDto(
                r.Id, r.RaceNumber, r.CourseId, r.Course != null ? r.Course.Name : null,
                r.CountdownStartedAt, r.CountdownDurationSeconds,
                r.StartedAt, r.EndedAt,
                r.EndedAt.HasValue ? (r.EndedAt.Value - r.StartedAt).TotalSeconds : null,
                r.SailedDistanceMeters, r.MaxSpeedOverGround, r.Notes))
            .ToListAsync(ct);
        return Ok(races);
    }

    [AllowAnonymous]
    [HttpGet("{raceId:guid}")]
    public async Task<ActionResult<RaceDetailDto>> GetById(Guid raceId, CancellationToken ct)
    {
        var race = await db.Races.FirstOrDefaultAsync(r => r.Id == raceId, ct);
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
            race.StartedAt, race.EndedAt, duration, race.SailedDistanceMeters, race.MaxSpeedOverGround, race.Notes,
            pinEnd, boatEnd, startAnalysisResult));
    }

    [AllowAnonymous]
    [HttpGet("{raceId:guid}/telemetry/positions")]
    public async Task<IActionResult> GetPositions(Guid raceId, [FromQuery] double? from, [FromQuery] double? to, CancellationToken ct)
    {
        var race = await db.Races.FirstOrDefaultAsync(r => r.Id == raceId, ct);
        if (race is null) return NotFound();
        if (!await sessionAuth.CanReadAsync(race.SessionId, ct)) return NotFound();
        var (start, end) = ComputeTimeWindow(race, from, to);
        var positions = db.Positions
            .Where(p => p.SessionId == race.SessionId && p.Time >= start && p.Time <= end)
            .OrderBy(p => p.Time)
            .Select(p => new PositionDto(p.Time, p.Latitude, p.Longitude, p.SpeedOverGround, p.CourseOverGround, p.Altitude, p.QuaternionW, p.QuaternionX, p.QuaternionY, p.QuaternionZ))
            .AsAsyncEnumerable();
        return Ok(positions);
    }

    [AllowAnonymous]
    [HttpGet("{raceId:guid}/telemetry/wind")]
    public async Task<IActionResult> GetWind(Guid raceId, [FromQuery] double? from, [FromQuery] double? to, CancellationToken ct)
    {
        var race = await db.Races.FirstOrDefaultAsync(r => r.Id == raceId, ct);
        if (race is null) return NotFound();
        if (!await sessionAuth.CanReadAsync(race.SessionId, ct)) return NotFound();
        var (start, end) = ComputeTimeWindow(race, from, to);
        var readings = db.WindReadings
            .Where(w => w.SessionId == race.SessionId && w.Time >= start && w.Time <= end)
            .OrderBy(w => w.Time)
            .Select(w => new WindDto(w.Time, w.WindDirection, w.WindSpeed))
            .AsAsyncEnumerable();
        return Ok(readings);
    }

    [AllowAnonymous]
    [HttpGet("{raceId:guid}/telemetry/speed-through-water")]
    public async Task<IActionResult> GetSpeedThroughWater(Guid raceId, [FromQuery] double? from, [FromQuery] double? to, CancellationToken ct)
    {
        var race = await db.Races.FirstOrDefaultAsync(r => r.Id == raceId, ct);
        if (race is null) return NotFound();
        if (!await sessionAuth.CanReadAsync(race.SessionId, ct)) return NotFound();
        var (start, end) = ComputeTimeWindow(race, from, to);
        var readings = db.SpeedThroughWater
            .Where(s => s.SessionId == race.SessionId && s.Time >= start && s.Time <= end)
            .OrderBy(s => s.Time)
            .Select(s => new SpeedThroughWaterDto(s.Time, s.ForwardSpeed, s.HorizontalSpeed))
            .AsAsyncEnumerable();
        return Ok(readings);
    }

    [AllowAnonymous]
    [HttpGet("{raceId:guid}/telemetry/depth")]
    public async Task<IActionResult> GetDepth(Guid raceId, [FromQuery] double? from, [FromQuery] double? to, CancellationToken ct)
    {
        var race = await db.Races.FirstOrDefaultAsync(r => r.Id == raceId, ct);
        if (race is null) return NotFound();
        if (!await sessionAuth.CanReadAsync(race.SessionId, ct)) return NotFound();
        var (start, end) = ComputeTimeWindow(race, from, to);
        var readings = db.DepthReadings
            .Where(d => d.SessionId == race.SessionId && d.Time >= start && d.Time <= end)
            .OrderBy(d => d.Time)
            .Select(d => new DepthDto(d.Time, d.Depth))
            .AsAsyncEnumerable();
        return Ok(readings);
    }

    [AllowAnonymous]
    [HttpGet("{raceId:guid}/telemetry/temperature")]
    public async Task<IActionResult> GetTemperature(Guid raceId, [FromQuery] double? from, [FromQuery] double? to, CancellationToken ct)
    {
        var race = await db.Races.FirstOrDefaultAsync(r => r.Id == raceId, ct);
        if (race is null) return NotFound();
        if (!await sessionAuth.CanReadAsync(race.SessionId, ct)) return NotFound();
        var (start, end) = ComputeTimeWindow(race, from, to);
        var readings = db.TemperatureReadings
            .Where(t => t.SessionId == race.SessionId && t.Time >= start && t.Time <= end)
            .OrderBy(t => t.Time)
            .Select(t => new TemperatureDto(t.Time, t.Temperature))
            .AsAsyncEnumerable();
        return Ok(readings);
    }

    [AllowAnonymous]
    [HttpGet("{raceId:guid}/telemetry/load")]
    public async Task<IActionResult> GetLoad(Guid raceId, [FromQuery] double? from, [FromQuery] double? to, CancellationToken ct)
    {
        var race = await db.Races.FirstOrDefaultAsync(r => r.Id == raceId, ct);
        if (race is null) return NotFound();
        if (!await sessionAuth.CanReadAsync(race.SessionId, ct)) return NotFound();
        var (start, end) = ComputeTimeWindow(race, from, to);
        var readings = db.LoadReadings
            .Where(l => l.SessionId == race.SessionId && l.Time >= start && l.Time <= end)
            .OrderBy(l => l.Time)
            .Select(l => new LoadDto(l.Time, l.SensorName, l.Load))
            .AsAsyncEnumerable();
        return Ok(readings);
    }

    [AllowAnonymous]
    [HttpGet("{raceId:guid}/telemetry/shift-angles")]
    public async Task<IActionResult> GetShiftAngles(Guid raceId, [FromQuery] double? from, [FromQuery] double? to, CancellationToken ct)
    {
        var race = await db.Races.FirstOrDefaultAsync(r => r.Id == raceId, ct);
        if (race is null) return NotFound();
        if (!await sessionAuth.CanReadAsync(race.SessionId, ct)) return NotFound();
        var (start, end) = ComputeTimeWindow(race, from, to);
        var readings = db.ShiftAngles
            .Where(s => s.SessionId == race.SessionId && s.Time >= start && s.Time <= end)
            .OrderBy(s => s.Time)
            .Select(s => new ShiftAngleDto(s.Time, s.IsPort, s.IsManual, s.TrueHeading, s.SpeedOverGround))
            .AsAsyncEnumerable();
        return Ok(readings);
    }

    [AllowAnonymous]
    [HttpGet("{raceId:guid}/telemetry")]
    [EndpointSummary("Fetches all telemetry channels in a single request.")]
    public async Task<ActionResult<RaceTelemetryDto>> GetTelemetry(Guid raceId, [FromQuery] double? from, [FromQuery] double? to, CancellationToken ct)
    {
        var race = await db.Races.FirstOrDefaultAsync(r => r.Id == raceId, ct);
        if (race is null) return NotFound();
        if (!await sessionAuth.CanReadAsync(race.SessionId, ct)) return NotFound();
        var (start, end) = ComputeTimeWindow(race, from, to);
        var sid = race.SessionId;

        var positions = await db.Positions
            .Where(p => p.SessionId == sid && p.Time >= start && p.Time <= end)
            .OrderBy(p => p.Time)
            .Select(p => new PositionDto(p.Time, p.Latitude, p.Longitude, p.SpeedOverGround, p.CourseOverGround, p.Altitude, p.QuaternionW, p.QuaternionX, p.QuaternionY, p.QuaternionZ))
            .ToListAsync(ct);

        var wind = await db.WindReadings
            .Where(w => w.SessionId == sid && w.Time >= start && w.Time <= end)
            .OrderBy(w => w.Time)
            .Select(w => new WindDto(w.Time, w.WindDirection, w.WindSpeed))
            .ToListAsync(ct);

        var stw = await db.SpeedThroughWater
            .Where(s => s.SessionId == sid && s.Time >= start && s.Time <= end)
            .OrderBy(s => s.Time)
            .Select(s => new SpeedThroughWaterDto(s.Time, s.ForwardSpeed, s.HorizontalSpeed))
            .ToListAsync(ct);

        var depth = await db.DepthReadings
            .Where(d => d.SessionId == sid && d.Time >= start && d.Time <= end)
            .OrderBy(d => d.Time)
            .Select(d => new DepthDto(d.Time, d.Depth))
            .ToListAsync(ct);

        var temperature = await db.TemperatureReadings
            .Where(t => t.SessionId == sid && t.Time >= start && t.Time <= end)
            .OrderBy(t => t.Time)
            .Select(t => new TemperatureDto(t.Time, t.Temperature))
            .ToListAsync(ct);

        var load = await db.LoadReadings
            .Where(l => l.SessionId == sid && l.Time >= start && l.Time <= end)
            .OrderBy(l => l.Time)
            .Select(l => new LoadDto(l.Time, l.SensorName, l.Load))
            .ToListAsync(ct);

        var shiftAngles = await db.ShiftAngles
            .Where(s => s.SessionId == sid && s.Time >= start && s.Time <= end)
            .OrderBy(s => s.Time)
            .Select(s => new ShiftAngleDto(s.Time, s.IsPort, s.IsManual, s.TrueHeading, s.SpeedOverGround))
            .ToListAsync(ct);

        return Ok(new RaceTelemetryDto(positions, wind, stw, depth, temperature, load, shiftAngles));
    }

    [AllowAnonymous]
    [HttpGet("{raceId:guid}/analysis/start-line-length")]
    public async Task<ActionResult<StartLineLengthDto>> GetStartLineLength(Guid raceId, CancellationToken ct)
    {
        var race = await db.Races.FirstOrDefaultAsync(r => r.Id == raceId, ct);
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
            .FirstOrDefaultAsync(r => r.Id == raceId, ct);
        if (race is null) return NotFound();
        if (!await sessionAuth.CanWriteAsync(race.SessionId, ct)) return NotFound();

        if (request.CourseId.HasValue)
            race.CourseId = request.CourseId.Value == Guid.Empty ? null : request.CourseId.Value;
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

    private static (DateTimeOffset Start, DateTimeOffset End) ComputeTimeWindow(Race race, double? fromSeconds, double? toSeconds)
    {
        var start = fromSeconds.HasValue ? race.StartedAt.AddSeconds(fromSeconds.Value) : race.StartedAt;
        var end = toSeconds.HasValue ? race.StartedAt.AddSeconds(toSeconds.Value) : race.EndedAt ?? race.StartedAt;
        return (start, end);
    }
}
