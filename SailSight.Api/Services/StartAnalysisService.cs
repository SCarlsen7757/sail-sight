using Microsoft.EntityFrameworkCore;
using SailSight.Api.Data;
using SailSight.Api.Helpers;
using SailSight.Api.Models.Entities;
using SailSight.Shared.Dtos.Races;


namespace SailSight.Api.Services;

public class StartAnalysisService(AppDbContext db)
{
    /// <summary>
    /// Small buffer added after StartedAt to catch boats that cross just after the gun.
    /// </summary>
    private static readonly TimeSpan PostStartBuffer = TimeSpan.FromSeconds(30);

    /// <summary>
    /// Computes the start-line crossing analysis for a race.
    /// Returns null when no valid crossing is found (missing data or boat never crossed).
    /// A valid crossing requires the boat to cross with the committee boat (boat end)
    /// on starboard (right) and the pin end on port (left).
    /// <c>LineFraction</c> is 0 at the committee boat (boat end) and 1 at the pin end.
    /// <para>
    /// All valid crossings in the window are collected and the <b>last</b> one is returned.
    /// This handles the case where a boat crosses early (OCS), returns behind the line,
    /// and crosses again — the final crossing is always the one that counts.
    /// </para>
    /// <para>
    /// OCS detection uses a side-of-line check (not just segment intersection) so
    /// a boat that returns via either end of the line — not just through the segment —
    /// is correctly recognised as having cleared the OCS.
    /// <list type="bullet">
    ///   <item><see cref="StartAnalysisDto.IsOcs"/> is true if the boat crossed to the
    ///   course side before the start gun (regardless of subsequent clearing).</item>
    ///   <item><see cref="StartAnalysisDto.IsOcsCleared"/> is true when the boat was OCS
    ///   but returned to the pre-start side before the gun.</item>
    /// </list>
    /// </para>
    /// </summary>
    public async Task<StartAnalysisDto?> ComputeAsync(
        Race race, Guid sessionId,
        LinePositionDto? pinEnd, LinePositionDto? boatEnd,
        CancellationToken ct)
    {
        if (pinEnd is null || boatEnd is null)
            return null;

        var windowStart = race.CountdownStartedAt ?? race.StartedAt.AddMinutes(-5);
        var windowEnd = race.StartedAt + PostStartBuffer;

        var positions = await db.Positions
            .Where(p => p.SessionId == sessionId && p.Time >= windowStart && p.Time <= windowEnd)
            .OrderBy(p => p.Time)
            .ToListAsync(ct);

        if (positions.Count < 2)
            return null;

        // Line endpoints (pin = C, boat = D).
        double cx = pinEnd.Latitude, cy = pinEnd.Longitude;
        double dx = boatEnd.Latitude, dy = boatEnd.Longitude;

        // ── OCS detection ────────────────────────────────────────────────────
        // For each position up to the start gun, determine which side of the
        // infinite start line the boat is on:
        //   sideSign > 0  → course side  (OCS territory before the gun)
        //   sideSign ≤ 0  → pre-start side
        //
        // Using the infinite line (not just the segment) means that a boat
        // returning around either end — not only through the line — is also
        // correctly recognised as having returned to the pre-start side.
        var everOnPreStartSide = false;
        var isOcs = false;
        var isOnCourseSide = false;

        foreach (var pos in positions.Where(p => p.Time <= race.StartedAt))
        {
            var sideSign = (dx - cx) * (pos.Longitude - cy) - (dy - cy) * (pos.Latitude - cx);
            if (sideSign <= 0)
            {
                everOnPreStartSide = true;
                isOnCourseSide = false;
            }
            else if (everOnPreStartSide)
            {
                isOcs = true;
                isOnCourseSide = true;
            }
        }

        // isOcsCleared: the boat was OCS at some point but had returned to the
        // pre-start side by the time the gun fired.
        var isOcsCleared = isOcs && !isOnCourseSide;
        // ─────────────────────────────────────────────────────────────────────

        // Collect all valid crossings — there may be more than one when the boat
        // crosses early, returns behind the line, and crosses again.
        StartAnalysisDto? lastCrossing = null;
        double? lastPreGunTimeBias = null; // time bias of the last crossing before the gun

        for (var i = 0; i < positions.Count - 1; i++)
        {
            var a = positions[i];
            var b = positions[i + 1];

            var t = GeoHelper.SegmentIntersection(
                a.Latitude, a.Longitude, b.Latitude, b.Longitude,
                cx, cy, dx, dy);

            if (t is null) continue;

            // Direction check: the boat must cross with the boat end (committee boat)
            // on the right (starboard) and pin end on the left (port).
            // The cross product of the boat's movement vector (A→B) with the line
            // vector (PinEnd→BoatEnd) must be positive for a correct crossing.
            var moveDx = b.Latitude - a.Latitude;
            var moveDy = b.Longitude - a.Longitude;
            var lineDx = dx - cx;
            var lineDy = dy - cy;
            var cross = moveDx * lineDy - moveDy * lineDx;

            if (cross <= 0)
                continue; // wrong side — boat end is on the left, not valid

            var tVal = t.Value;
            var interval = (b.Time - a.Time).TotalSeconds;
            var crossedAt = a.Time.AddSeconds(interval * tVal);
            var timeBias = (crossedAt - race.StartedAt).TotalSeconds;
            var speed = Lerp(a.SpeedOverGround, b.SpeedOverGround, tVal);
            var course = LerpAngle(
                (float)(a.CourseOverGround * (180.0 / Math.PI)),
                (float)(b.CourseOverGround * (180.0 / Math.PI)),
                tVal);
            var u = ComputeLineFraction(
                a.Latitude, a.Longitude, b.Latitude, b.Longitude,
                cx, cy, dx, dy);

            lastCrossing = new StartAnalysisDto(crossedAt, timeBias, speed, course, u, isOcs, isOcsCleared, null);

            if (crossedAt < race.StartedAt)
                lastPreGunTimeBias = timeBias;
        }

        if (lastCrossing is null)
            return null;

        // TimeBiasSeconds: only set when the last crossing was at or after the gun.
        // OcsTimeBiasSeconds: time of the last pre-gun crossing, only when IsOcs.
        var correctTimeBias = lastCrossing.TimeBiasSeconds >= 0 ? lastCrossing.TimeBiasSeconds : null;
        var ocsTimeBias = isOcs ? lastPreGunTimeBias : null;

        return lastCrossing with { TimeBiasSeconds = correctTimeBias, OcsTimeBiasSeconds = ocsTimeBias };
    }

    /// <summary>
    /// Computes the length of the start line in metres using the Haversine formula.
    /// Returns null when either line end position is missing.
    /// </summary>
    public static StartLineLengthDto? ComputeLineLength(LinePositionDto? pinEnd, LinePositionDto? boatEnd)
    {
        if (pinEnd is null || boatEnd is null)
            return null;

        var lengthMeters = GeoHelper.HaversineMeters(
            pinEnd.Latitude, pinEnd.Longitude,
            boatEnd.Latitude, boatEnd.Longitude);

        return new StartLineLengthDto(lengthMeters);
    }

    private static float Lerp(float a, float b, double t) => (float)(a + (b - a) * t);

    private static float LerpAngle(float a, float b, double t)
    {
        var diff = ((b - a + 540) % 360) - 180;
        var result = a + diff * (float)t;
        return ((result % 360) + 360) % 360;
    }

    private static double ComputeLineFraction(
        double ax, double ay, double bx, double by,
        double cx, double cy, double dx, double dy)
    {
        var dxCD = dx - cx;
        var dyCD = dy - cy;
        var dxAB = bx - ax;
        var dyAB = by - ay;
        var denom = dxAB * dyCD - dyAB * dxCD;
        if (Math.Abs(denom) < 1e-15) return 0.5;
        return 1.0 - ((cx - ax) * dyAB - (cy - ay) * dxAB) / denom;
    }
}
