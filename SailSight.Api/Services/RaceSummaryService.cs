using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SailSight.Api.Data;
using SailSight.Shared.Dtos.Races;

namespace SailSight.Api.Services;

public class RaceSummaryService(
    AppDbContext db,
    StartAnalysisService startAnalysisService,
    IRaceSummaryAgent agent)
{
    /// <summary>
    /// Builds the <see cref="RaceSummaryContext"/> and computes its content hash.
    /// Returns null when the race or session cannot be found.
    /// </summary>
    public async Task<(RaceSummaryContext Context, string Hash)?> BuildContextAsync(
        Guid raceId, CancellationToken ct)
    {
        var race = await db.Races
            .FirstOrDefaultAsync(r => r.Id == raceId, ct);
        if (race is null) return null;

        var sessionId = race.SessionId;
        var session = await db.Sessions
            .Include(s => s.Boat).ThenInclude(b => b!.BoatClass)
            .Include(s => s.Course)
            .FirstOrDefaultAsync(s => s.Id == sessionId, ct);
        if (session is null) return null;

        var duration = race.EndedAt.HasValue
            ? (race.EndedAt.Value - race.StartedAt).TotalSeconds
            : 0;

        // Aggregate telemetry stats — single queries, no full materialization.
        var avgSog = await db.Positions
            .Where(p => p.SessionId == sessionId && p.Time >= race.StartedAt && p.Time <= (race.EndedAt ?? race.StartedAt))
            .AverageAsync(p => (float?)p.SpeedOverGround, ct) ?? 0f;

        var avgWindSpeed = await db.WindReadings
            .Where(w => w.SessionId == sessionId && w.Time >= race.StartedAt && w.Time <= (race.EndedAt ?? race.StartedAt))
            .AverageAsync(w => (float?)w.WindSpeed, ct);

        var avgWindDir = await db.WindReadings
            .Where(w => w.SessionId == sessionId && w.Time >= race.StartedAt && w.Time <= (race.EndedAt ?? race.StartedAt))
            .AverageAsync(w => (float?)w.WindDirection, ct);

        // Start analysis
        var pinEnd = await db.LinePositions
            .Where(l => l.SessionId == sessionId && l.LineEnd == 0 && l.Time <= race.StartedAt)
            .OrderByDescending(l => l.Time)
            .Select(l => new LinePositionDto(l.Time, l.Latitude, l.Longitude))
            .FirstOrDefaultAsync(ct);

        var boatEnd = await db.LinePositions
            .Where(l => l.SessionId == sessionId && l.LineEnd == 1 && l.Time <= race.StartedAt)
            .OrderByDescending(l => l.Time)
            .Select(l => new LinePositionDto(l.Time, l.Latitude, l.Longitude))
            .FirstOrDefaultAsync(ct);

        var startAnalysis = await startAnalysisService.ComputeAsync(race, sessionId, pinEnd, boatEnd, ct);
        var startLineLength = StartAnalysisService.ComputeLineLength(pinEnd, boatEnd);

        var context = new RaceSummaryContext(
            BoatName: session.Boat?.Name ?? "Unknown",
            BoatClass: session.Boat?.BoatClass?.Name,
            CourseName: session.Course?.Name ?? race.Course?.Name,
            RaceNumber: race.RaceNumber,
            StartedAt: race.StartedAt,
            DurationSeconds: duration,
            SailedDistanceMeters: race.SailedDistanceMeters,
            MaxSpeedOverGroundMs: race.MaxSpeedOverGround,
            AvgSpeedOverGroundMs: avgSog,
            AvgWindSpeedMs: avgWindSpeed,
            AvgWindDirectionDeg: avgWindDir,
            StartAnalysis: startAnalysis,
            StartLineLengthMeters: startLineLength?.LengthMeters);

        var hash = ComputeContextHash(context);
        return (context, hash);
    }

    /// <summary>
    /// Streams tokens from the AI agent. The caller is responsible for accumulating
    /// and saving the result (see <see cref="SaveAsync"/>).
    /// </summary>
    public IAsyncEnumerable<string> StreamAsync(RaceSummaryContext context, CancellationToken ct)
        => agent.GenerateAsync(context, ct);

    /// <summary>
    /// Upserts the completed report into the database.
    /// </summary>
    public async Task SaveAsync(Guid raceId, string content, string model, string contextHash, CancellationToken ct)
    {
        var existing = await db.RaceSummaryReports
            .FirstOrDefaultAsync(r => r.RaceId == raceId, ct);

        if (existing is not null)
        {
            existing.Content = content;
            existing.Model = model;
            existing.ContextHash = contextHash;
            existing.GeneratedAt = DateTimeOffset.UtcNow;
        }
        else
        {
            var race = await db.Races.FirstAsync(r => r.Id == raceId, ct);
            db.RaceSummaryReports.Add(new()
            {
                SessionId = race.SessionId,
                RaceNumber = race.RaceNumber,
                RaceId = raceId,
                Content = content,
                Model = model,
                ContextHash = contextHash,
                GeneratedAt = DateTimeOffset.UtcNow
            });
        }

        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Computes the current context hash for staleness detection.
    /// </summary>
    public async Task<string?> ComputeCurrentHashAsync(Guid raceId, CancellationToken ct)
    {
        var result = await BuildContextAsync(raceId, ct);
        return result?.Hash;
    }

    private static string ComputeContextHash(RaceSummaryContext context)
    {
        var json = JsonSerializer.Serialize(context);
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(json));
        return Convert.ToHexStringLower(bytes);
    }
}
