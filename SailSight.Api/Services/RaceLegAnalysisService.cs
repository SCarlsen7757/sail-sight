using Microsoft.EntityFrameworkCore;
using SailSight.Api.Data;
using SailSight.Api.Helpers;
using SailSight.Api.Models.Entities;

namespace SailSight.Api.Services;

public record PositionAnalysisData(
    DateTimeOffset Time,
    double Latitude,
    double Longitude,
    float SpeedOverGround,
    float CourseOverGround
);

public class RaceLegAnalysisService(AppDbContext db)
{
    public async Task AnalyzeRaceAsync(Guid raceId, CancellationToken ct = default)
    {
        var race = await db.Races
            .Include(r => r.Course)
                .ThenInclude(c => c!.Legs.OrderBy(l => l.SortOrder))
                    .ThenInclude(l => l.Mark)
            .FirstOrDefaultAsync(r => r.Id == raceId, ct);

        if (race?.Course == null || race.EndedAt == null)
        {
            if (race != null)
            {
                race.AnalysisStatus = RaceAnalysisStatus.Incomplete;
                await db.SaveChangesAsync(ct);
            }
            return;
        }

        // Clear existing performances
        var existing = await db.RaceLegPerformances.Where(p => p.RaceId == raceId).ToListAsync(ct);
        db.RaceLegPerformances.RemoveRange(existing);

        var positions = await db.Positions
            .AsNoTracking()
            .Where(p => p.SessionId == race.SessionId && p.Time >= race.StartedAt && p.Time <= race.EndedAt)
            .OrderBy(p => p.Time)
            .Select(p => new PositionAnalysisData(
                p.Time,
                p.Latitude,
                p.Longitude,
                p.SpeedOverGround,
                p.CourseOverGround
            ))
            .ToListAsync(ct);

        if (positions.Count < 2)
        {
            race.AnalysisStatus = RaceAnalysisStatus.Error;
            await db.SaveChangesAsync(ct);
            return;
        }

        var legs = race.Course.Legs.OrderBy(l => l.SortOrder).ToList();
        var performances = new List<RaceLegPerformance>();

        DateTimeOffset currentLegStartTime = race.StartedAt;
        int positionIndex = 0;

        for (int i = 0; i < legs.Count; i++)
        {
            var leg = legs[i];
            var mark = leg.Mark;
            double radius = leg.OverrideRoundingRadiusMeters ?? mark.DefaultRoundingRadiusMeters;

            double markLatRad = GeoHelper.ToRadians(mark.Latitude);
            double markLonRad = GeoHelper.ToRadians(mark.Longitude);
            double cosMarkLat = Math.Cos(markLatRad);
            double sinMarkLat = Math.Sin(markLatRad);

            // Find entry into the mark's rounding radius
            DateTimeOffset? enteredAt = null;
            int entryIndex = -1;

            for (int j = positionIndex; j < positions.Count; j++)
            {
                var pos = positions[j];
                var posLatRad = GeoHelper.ToRadians(pos.Latitude);
                var posLonRad = GeoHelper.ToRadians(pos.Longitude);
                var dist = GeoHelper.HaversineMetersOptimized(posLatRad, posLonRad, markLatRad, cosMarkLat, markLonRad);
                if (dist <= radius)
                {
                    enteredAt = pos.Time;
                    entryIndex = j;
                    break;
                }
            }

            if (enteredAt == null)
            {
                performances.Add(new RaceLegPerformance
                {
                    RaceId = raceId,
                    CourseLegId = leg.Id,
                    LegIndex = i + 1,
                    Status = LegPerformanceStatus.Missed,
                    ExitedPreviousMarkAt = currentLegStartTime,
                    EnteredCurrentMarkAt = race.EndedAt.Value
                });
                continue;
            }

            // Calculate metrics for the segment [positionIndex, entryIndex]
            if (entryIndex > positionIndex)
            {
                var perf = CalculatePerformance(
                    raceId,
                    leg.Id,
                    i + 1,
                    currentLegStartTime,
                    enteredAt.Value,
                    positions,
                    positionIndex,
                    entryIndex,
                    mark,
                    markLatRad,
                    sinMarkLat,
                    cosMarkLat,
                    markLonRad);
                performances.Add(perf);
            }

            // Find exit from the radius to start next leg
            DateTimeOffset? exitedAt = null;
            for (int j = entryIndex; j < positions.Count; j++)
            {
                var pos = positions[j];
                var posLatRad = GeoHelper.ToRadians(pos.Latitude);
                var posLonRad = GeoHelper.ToRadians(pos.Longitude);
                var dist = GeoHelper.HaversineMetersOptimized(posLatRad, posLonRad, markLatRad, cosMarkLat, markLonRad);
                if (dist > radius)
                {
                    exitedAt = pos.Time;
                    positionIndex = j;
                    break;
                }
            }

            if (exitedAt == null)
            {
                // Finished race inside the mark radius
                currentLegStartTime = enteredAt.Value;
                positionIndex = positions.Count - 1;
            }
            else
            {
                currentLegStartTime = exitedAt.Value;
            }
        }

        db.RaceLegPerformances.AddRange(performances);
        race.AnalysisStatus = RaceAnalysisStatus.Completed;
        await db.SaveChangesAsync(ct);
    }

    private static RaceLegPerformance CalculatePerformance(
        Guid raceId, Guid legId, int index,
        DateTimeOffset start, DateTimeOffset end,
        List<PositionAnalysisData> positions, int fromIndex, int toIndex,
        Mark targetMark,
        double targetLatRad, double sinTargetLat, double cosTargetLat, double targetLonRad)
    {
        double distance = 0;
        double totalSpeed = 0;
        double totalVmg = 0;
        double maxSpeed = 0;

        for (int i = fromIndex + 1; i <= toIndex; i++)
        {
            var p1 = positions[i - 1];
            var p2 = positions[i];

            var d = GeoHelper.HaversineMeters(p1.Latitude, p1.Longitude, p2.Latitude, p2.Longitude);
            distance += d;

            double sog = p2.SpeedOverGround;
            totalSpeed += sog;
            if (sog > maxSpeed) maxSpeed = sog;

            // VMG = SOG * cos(bearing_to_mark − COG)
            // COG is stored in radians; bearing is returned in degrees by GeoHelper
            var p2LatRad = GeoHelper.ToRadians(p2.Latitude);
            var p2LonRad = GeoHelper.ToRadians(p2.Longitude);
            var bearingToMark = GeoHelper.BearingOptimized(p2LatRad, p2LonRad, targetLatRad, sinTargetLat, cosTargetLat, targetLonRad);
            var cogDegrees = p2.CourseOverGround * (180.0 / Math.PI);
            var angleDiffRad = (bearingToMark - cogDegrees) * (Math.PI / 180.0);
            totalVmg += sog * Math.Cos(angleDiffRad);
        }

        int count = toIndex - fromIndex;
        return new RaceLegPerformance
        {
            RaceId = raceId,
            CourseLegId = legId,
            LegIndex = index,
            Status = LegPerformanceStatus.Completed,
            ExitedPreviousMarkAt = start,
            EnteredCurrentMarkAt = end,
            SailedDistanceMeters = distance,
            AverageSpeedOverGround = count > 0 ? (float)(totalSpeed / count) : 0f,
            AverageVelocityMadeGood = count > 0 ? (float)(totalVmg / count) : 0f,
            MaxSpeedOverGround = (float)maxSpeed
        };
    }

    public async Task ReanalyzeRacesByCourseAsync(Guid courseId, CancellationToken ct = default)
    {
        var raceIds = await db.Races
            .Where(r => r.CourseId == courseId)
            .Select(r => r.Id)
            .ToListAsync(ct);

        foreach (var id in raceIds)
        {
            await AnalyzeRaceAsync(id, ct);
        }
    }

    public async Task ReanalyzeRacesByMarkAsync(Guid markId, CancellationToken ct = default)
    {
        var courseIds = await db.CourseLegs
            .Where(cl => cl.MarkId == markId || cl.GateMarkId == markId)
            .Select(cl => cl.CourseId)
            .Distinct()
            .ToListAsync(ct);

        foreach (var cid in courseIds)
        {
            await ReanalyzeRacesByCourseAsync(cid, ct);
        }
    }
}
