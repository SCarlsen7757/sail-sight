using SailSight.Api.Helpers;
using SailSight.Api.Models.Entities;

namespace SailSight.Api.Services;

public record PositionAnalysisData(DateTimeOffset Time, double Latitude, double Longitude,
    float SpeedOverGround, float CourseOverGround);

/// <summary>Deterministic post-race geometry. Never uses heading or inferred race boundaries.</summary>
public static class RaceLegCalculator
{
    public const double MinimumSweepDegrees = 15;
    public const double MaximumOpposingSweepDegrees = 15;
    public const double AmbiguousMarkDistanceMeters = 2;
    private const double EarthRadius = 6_371_000;

    private readonly record struct Point(double X, double Y)
    {
        public double Length => Math.Sqrt(X * X + Y * Y);
        public static Point operator -(Point a, Point b) => new(a.X - b.X, a.Y - b.Y);
        public static Point operator +(Point a, Point b) => new(a.X + b.X, a.Y + b.Y);
        public static Point operator *(Point a, double b) => new(a.X * b, a.Y * b);
    }
    private static double Dot(Point a, Point b) => a.X * b.X + a.Y * b.Y;
    private static double Cross(Point a, Point b) => a.X * b.Y - a.Y * b.X;
    private static double Wrap(double a) => Math.Atan2(Math.Sin(a), Math.Cos(a));
    private static Point Project(double lat, double lon, double originLat, double originLon) => new(
        EarthRadius * Wrap(GeoHelper.ToRadians(lon - originLon)) * Math.Cos(GeoHelper.ToRadians(originLat)),
        EarthRadius * GeoHelper.ToRadians(lat - originLat));

    public static PositionAnalysisData Interpolate(PositionAnalysisData a, PositionAnalysisData b, double f) => new(
        a.Time.AddTicks((long)((b.Time - a.Time).Ticks * f)),
        a.Latitude + (b.Latitude - a.Latitude) * f,
        GeoHelper.ToDegrees(Wrap(GeoHelper.ToRadians(a.Longitude) + Wrap(GeoHelper.ToRadians(b.Longitude - a.Longitude)) * f)),
        (float)(a.SpeedOverGround + (b.SpeedOverGround - a.SpeedOverGround) * f),
        (float)Wrap(a.CourseOverGround + Wrap(b.CourseOverGround - a.CourseOverGround) * f));

    private static PositionAnalysisData At(IReadOnlyList<PositionAnalysisData> p, double index)
    {
        var i = Math.Min((int)index, p.Count - 1);
        return i == p.Count - 1 ? p[i] : Interpolate(p[i], p[i + 1], index - i);
    }

    public static double Vmg(PositionAnalysisData p, double lat, double lon) =>
        p.SpeedOverGround * Math.Cos(GeoHelper.ToRadians(GeoHelper.Bearing(p.Latitude, p.Longitude, lat, lon)) - p.CourseOverGround);

    public static List<RaceLegPerformance> Calculate(Guid raceId, DateTimeOffset start, DateTimeOffset end,
        IReadOnlyList<PositionAnalysisData> readings, IReadOnlyList<CourseLeg> courseLegs)
    {
        var p = readings.OrderBy(p => p.Time).ToList();
        var valid = p.Count >= 2 && p.All(p => double.IsFinite(p.Latitude) && double.IsFinite(p.Longitude)
            && float.IsFinite(p.SpeedOverGround) && p.SpeedOverGround >= 0 && float.IsFinite(p.CourseOverGround))
            && p.Zip(p.Skip(1)).All(pair => pair.First.Time < pair.Second.Time)
            && p[0].Time <= start && p[^1].Time >= end && end > start;
        if (valid)
        {
            // Clip to timer boundaries, retaining interpolated endpoints.
            var first = p.FindLastIndex(p => p.Time <= start);
            var last = p.FindIndex(p => p.Time >= end);
            var a = p[first].Time == start ? p[first] : Interpolate(p[first], p[first + 1], (start - p[first].Time).TotalSeconds / (p[first + 1].Time - p[first].Time).TotalSeconds);
            var b = p[last].Time == end ? p[last] : Interpolate(p[last - 1], p[last], (end - p[last - 1].Time).TotalSeconds / (p[last].Time - p[last - 1].Time).TotalSeconds);
            p = [a, .. p.Where(p => p.Time > start && p.Time < end), b];
        }
        var results = new List<RaceLegPerformance>();
        double cursor = 0;
        bool blocked = !valid;
        foreach (var leg in courseLegs.OrderBy(l => l.SortOrder))
        {
            var latitude = leg.Mark.Latitude;
            var longitude = leg.Mark.Longitude;
            if (leg.LegType == LegType.Gate && leg.GateMark is { } gate)
            {
                latitude = (latitude + gate.Latitude) / 2;
                longitude = GeoHelper.ToDegrees(Wrap(GeoHelper.ToRadians(longitude) + Wrap(GeoHelper.ToRadians(gate.Longitude - longitude)) / 2));
            }
            var result = new RaceLegPerformance { RaceId = raceId, CourseLegId = leg.Id, LegIndex = results.Count + 1,
                TargetLatitude = latitude, TargetLongitude = longitude, TargetType = leg.LegType,
                Status = LegPerformanceStatus.Unresolved, Reason = valid ? "An earlier leg could not be verified." : "Recording does not provide valid coverage of the race." };
            results.Add(result);
            if (blocked) continue;
            result.ExitedPreviousMarkAt = At(p, cursor).Time;
            var visit = leg.LegType == LegType.Gate ? FindGate(p, cursor, leg) : FindMark(p, cursor, leg);
            result.Status = visit.Status;
            result.Reason = visit.Reason;
            result.EnteredCurrentMarkAt = visit.Entry is { } en ? At(p, en).Time : null;
            result.ExitedCurrentMarkAt = visit.Exit is { } ex ? At(p, ex).Time : null;
            if (visit.Status != LegPerformanceStatus.Completed)
            {
                blocked = true;
                continue;
            }
            CalculateMetrics(result, p, cursor, visit.Entry!.Value);
            cursor = visit.Exit!.Value;
        }
        return results;
    }

    private record Visit(double? Entry, double? Exit, LegPerformanceStatus Status, string? Reason);
    private static Visit FindGate(IReadOnlyList<PositionAnalysisData> p, double cursor, CourseLeg leg)
    {
        if (leg.GateMark is not { } gate || GeoHelper.HaversineMeters(leg.Mark.Latitude, leg.Mark.Longitude, gate.Latitude, gate.Longitude) < 0.01)
            return new(null, null, LegPerformanceStatus.Uncertain, "Gate endpoints must be distinct.");
        var g = Project(gate.Latitude, gate.Longitude, leg.Mark.Latitude, leg.Mark.Longitude);
        var initial = At(p, cursor);
        var a = Project(initial.Latitude, initial.Longitude, leg.Mark.Latitude, leg.Mark.Longitude);
        var previousIndex = cursor;
        double? contact = null;
        bool travelledAlongLine = false;
        for (int i = (int)Math.Floor(cursor) + 1; i < p.Count; i++)
        {
            var b = Project(p[i].Latitude, p[i].Longitude, leg.Mark.Latitude, leg.Mark.Longitude);
            var sideA = Cross(g, a); var sideB = Cross(g, b);
            if (Math.Abs(sideB) < 1e-7)
            {
                travelledAlongLine |= contact.HasValue;
                contact ??= i;
                continue;
            }
            if (sideA * sideB < 0 && !travelledAlongLine)
            {
                double? crossing = null;
                if (contact is { } c)
                {
                    var point = At(p, c);
                    var local = Project(point.Latitude, point.Longitude, leg.Mark.Latitude, leg.Mark.Longitude);
                    var along = Dot(local, g) / Dot(g, g);
                    if (along >= 0 && along <= 1) crossing = c;
                }
                else
                {
                    var f = GeoHelper.SegmentIntersection(a.X, a.Y, b.X, b.Y, 0, 0, g.X, g.Y);
                    if (f.HasValue) crossing = previousIndex + (i - previousIndex) * f.Value;
                }
                if (crossing.HasValue) return new(crossing, crossing, LegPerformanceStatus.Completed, null);
            }
            a = b; previousIndex = i; contact = null; travelledAlongLine = false;
        }
        return new(null, null, LegPerformanceStatus.Unreached, "No crossing between the gate marks was recorded.");
    }

    private static Visit FindMark(IReadOnlyList<PositionAnalysisData> p, double cursor, CourseLeg leg)
    {
        var radius = leg.OverrideRoundingRadiusMeters ?? leg.Mark.DefaultRoundingRadiusMeters;
        if (!double.IsFinite(radius) || radius <= AmbiguousMarkDistanceMeters)
            return new(null, null, LegPerformanceStatus.Uncertain, "Rounding radius is too small to verify passing side.");
        Point Local(PositionAnalysisData p) => Project(p.Latitude, p.Longitude, leg.Mark.Latitude, leg.Mark.Longitude);
        var cuts = new List<double> { cursor };
        for (int i = (int)Math.Floor(cursor); i < p.Count - 1; i++)
        {
            var a = Local(p[i]); var d = Local(p[i + 1]) - a;
            var aa = Dot(d, d); var bb = 2 * Dot(a, d); var cc = Dot(a, a) - radius * radius;
            var disc = bb * bb - 4 * aa * cc;
            if (aa <= 1e-12 || disc <= 1e-9) continue; // stationary or tangent
            foreach (var f in new[] { (-bb - Math.Sqrt(disc)) / (2 * aa), (-bb + Math.Sqrt(disc)) / (2 * aa) })
                if (f >= 0 && f <= 1 && i + f > cursor + 1e-9) cuts.Add(i + f);
        }
        cuts.Add(p.Count - 1);
        cuts = cuts.Distinct().Order().ToList();
        double? entry = null, exit = null;
        for (int i = 0; i < cuts.Count - 1; i++)
        {
            if (Local(At(p, (cuts[i] + cuts[i + 1]) / 2)).Length < radius)
                entry ??= cuts[i];
            else if (entry.HasValue) { exit = cuts[i]; break; }
        }
        if (entry.HasValue && !exit.HasValue && Local(p[^1]).Length >= radius - 1e-6) exit = p.Count - 1;
        if (!entry.HasValue) return new(null, null, LegPerformanceStatus.Unreached, "The mark rounding radius was not reached.");
        if (entry <= cursor + 1e-9 && Local(At(p, cursor)).Length < radius - 1e-6 || !exit.HasValue)
            return new(entry, exit, LegPerformanceStatus.Uncertain, "A complete entry and exit was not recorded.");
        var visitPoints = new List<Point> { Local(At(p, entry.Value)) };
        for (int i = (int)Math.Floor(entry.Value) + 1; i < exit; i++) visitPoints.Add(Local(p[i]));
        visitPoints.Add(Local(At(p, exit.Value)));
        double positive = 0, negative = 0;
        for (int i = 1; i < visitPoints.Count; i++)
        {
            var a = visitPoints[i - 1]; var b = visitPoints[i]; var d = b - a;
            var nearest = a + d * (Dot(d, d) > 0 ? Math.Clamp(-Dot(a, d) / Dot(d, d), 0, 1) : 0);
            if (nearest.Length <= AmbiguousMarkDistanceMeters)
                return new(entry, exit, LegPerformanceStatus.Uncertain, "Track passes too close to the mark to establish a side.");
            var angle = GeoHelper.ToDegrees(Math.Atan2(Cross(a, b), Dot(a, b)));
            positive += Math.Max(angle, 0); negative += Math.Max(-angle, 0);
        }
        var sweep = positive - negative;
        if (Math.Abs(sweep) < MinimumSweepDegrees || Math.Min(positive, negative) > MaximumOpposingSweepDegrees)
            return new(entry, exit, LegPerformanceStatus.Uncertain, "Recorded movement does not establish a consistent passing side.");
        var side = sweep > 0 ? PassingSide.Port : PassingSide.Starboard;
        return side == leg.PassingSide ? new(entry, exit, LegPerformanceStatus.Completed, null)
            : new(entry, exit, LegPerformanceStatus.WrongSide, $"Recorded passing side was {side}; course requires {leg.PassingSide}.");
    }

    private static void CalculateMetrics(RaceLegPerformance result, IReadOnlyList<PositionAnalysisData> p, double from, double to)
    {
        if (to <= from) return;
        var points = new List<PositionAnalysisData> { At(p, from) };
        for (int i = (int)Math.Floor(from) + 1; i < to; i++) points.Add(p[i]);
        points.Add(At(p, to));
        double distance = 0, speed = 0, vmg = 0;
        for (int i = 1; i < points.Count; i++)
        {
            var a = points[i - 1]; var b = points[i]; var dt = (b.Time - a.Time).TotalSeconds;
            distance += GeoHelper.HaversineMeters(a.Latitude, a.Longitude, b.Latitude, b.Longitude);
            speed += (a.SpeedOverGround + b.SpeedOverGround) * 0.5 * dt;
            vmg += (Vmg(a, result.TargetLatitude, result.TargetLongitude) + Vmg(b, result.TargetLatitude, result.TargetLongitude)) * 0.5 * dt;
        }
        var duration = (points[^1].Time - points[0].Time).TotalSeconds;
        result.SailedDistanceMeters = distance;
        result.AverageSpeedOverGround = (float)(speed / duration);
        result.AverageVelocityMadeGood = (float)(vmg / duration);
        result.MaxSpeedOverGround = points.Max(p => p.SpeedOverGround);
    }
}
