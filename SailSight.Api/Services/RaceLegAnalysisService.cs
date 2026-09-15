using Microsoft.EntityFrameworkCore;
using SailSight.Api.Data;
using SailSight.Api.Models.Entities;

namespace SailSight.Api.Services;

public class RaceLegAnalysisService(AppDbContext db)
{
    public const int CurrentRevision = 1;

    public async Task AnalyzeRaceAsync(Guid raceId, CancellationToken ct = default)
    {
        var race = await db.Races.FirstOrDefaultAsync(r => r.Id == raceId, ct);
        if (race is null) return;
        // Query the assigned id directly: a tracked navigation may still refer to the old course.
        var course = race.CourseId is { } courseId ? await db.Courses.AsNoTracking()
            .Include(c => c.Legs).ThenInclude(l => l.Mark)
            .Include(c => c.Legs).ThenInclude(l => l.GateMark)
            .FirstOrDefaultAsync(c => c.Id == courseId, ct) : null;
        List<RaceLegPerformance> results = [];
        race.AnalysisStatus = RaceAnalysisStatus.Incomplete;
        race.AnalysisReason = course is null ? "No course assigned to this race."
            : race.EndedAt is null ? "No race-end event was recorded."
            : course.Legs.Count == 0 ? "The assigned course has no legs." : null;
        if (race.AnalysisReason is null)
        {
            var query = db.Positions.AsNoTracking().Where(p => p.SessionId == race.SessionId);
            var samples = await query.Where(p => p.Time >= race.StartedAt && p.Time <= race.EndedAt).OrderBy(p => p.Time).ToListAsync(ct);
            var before = await query.Where(p => p.Time < race.StartedAt).OrderByDescending(p => p.Time).FirstOrDefaultAsync(ct);
            var after = await query.Where(p => p.Time > race.EndedAt).OrderBy(p => p.Time).FirstOrDefaultAsync(ct);
            if (before is not null) samples.Insert(0, before);
            if (after is not null) samples.Add(after);
            var positions = samples.Select(p => new PositionAnalysisData(p.Time, p.Latitude, p.Longitude, p.SpeedOverGround, p.CourseOverGround)).ToList();
            results = RaceLegCalculator.Calculate(race.Id, race.StartedAt, race.EndedAt!.Value, positions, course!.Legs.ToList());
            race.AnalysisStatus = results.All(p => p.Status == LegPerformanceStatus.Completed) ? RaceAnalysisStatus.Completed : RaceAnalysisStatus.Incomplete;
            race.AnalysisReason = results.FirstOrDefault(p => p.Status != LegPerformanceStatus.Completed)?.Reason;
        }
        var existing = await db.RaceLegPerformances.Where(p => p.RaceId == raceId).ToListAsync(ct);
        // Reuse matching rows to avoid transient unique-key conflicts during replacement.
        foreach (var result in results)
        {
            var old = existing.FirstOrDefault(p => p.LegIndex == result.LegIndex);
            if (old is null) db.RaceLegPerformances.Add(result);
            else { result.Id = old.Id; db.Entry(old).CurrentValues.SetValues(result); existing.Remove(old); }
        }
        db.RaceLegPerformances.RemoveRange(existing);
        race.AnalysisRevision = CurrentRevision;
        await db.SaveChangesAsync(ct); // One transaction for all derived rows and race status.
    }

    public async Task ReanalyzeRacesByCourseAsync(Guid courseId, CancellationToken ct = default)
    {
        var ids = await db.Races.Where(r => r.CourseId == courseId).Select(r => r.Id).ToListAsync(ct);
        foreach (var id in ids) await AnalyzeRaceAsync(id, ct);
    }

    public async Task ReanalyzeRacesByMarkAsync(Guid markId, CancellationToken ct = default)
    {
        var ids = await db.CourseLegs.Where(l => l.MarkId == markId || l.GateMarkId == markId).Select(l => l.CourseId).Distinct().ToListAsync(ct);
        foreach (var id in ids) await ReanalyzeRacesByCourseAsync(id, ct);
    }
}

/// <summary>Rebuild derived results after a calculation revision, before serving requests.</summary>
public class RaceAnalysisBackfill(IServiceScopeFactory scopes, ILogger<RaceAnalysisBackfill> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var ids = await db.Races.Where(r => r.AnalysisRevision != RaceLegAnalysisService.CurrentRevision).Select(r => r.Id).ToListAsync(ct);
        foreach (var id in ids)
        {
            using var raceScope = scopes.CreateScope();
            try { await raceScope.ServiceProvider.GetRequiredService<RaceLegAnalysisService>().AnalyzeRaceAsync(id, ct); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Could not rebuild analysis for race {RaceId}; will retry at next startup", id);
                using var failureScope = scopes.CreateScope();
                var failureDb = failureScope.ServiceProvider.GetRequiredService<AppDbContext>();
                var race = await failureDb.Races.FindAsync([id], ct);
                if (race is not null)
                {
                    race.AnalysisStatus = RaceAnalysisStatus.Error;
                    race.AnalysisReason = "Analysis could not be rebuilt.";
                    await failureDb.SaveChangesAsync(ct);
                }
            }
        }
    }
    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;
}
