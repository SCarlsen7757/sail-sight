namespace SailSight.Api.Helpers;

/// <summary>
/// Geodesic calculation helpers.
/// </summary>
public static class GeoHelper
{
    private const double EarthRadiusMeters = 6_371_000.0;

    /// <summary>
    /// Returns the great-circle distance in metres between two WGS-84 coordinates
    /// using the Haversine formula.
    /// </summary>
    public static double HaversineMeters(double lat1, double lon1, double lat2, double lon2)
    {
        var dLat = ToRadians(lat2 - lat1);
        var dLon = ToRadians(lon2 - lon1);

        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
              + Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2))
              * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);

        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return EarthRadiusMeters * c;
    }

    /// <summary>
    /// Returns the interpolation parameter t ∈ [0,1] at which segment AB intersects
    /// segment CD, or null if they do not intersect within both segments.
    /// Coordinates are treated as a flat 2D plane (valid for the small distances
    /// involved in a start line — typically &lt; 500 m).
    /// </summary>
    public static double? SegmentIntersection(
        double ax, double ay, double bx, double by,
        double cx, double cy, double dx, double dy)
    {
        var dxAB = bx - ax;
        var dyAB = by - ay;
        var dxCD = dx - cx;
        var dyCD = dy - cy;

        var denom = dxAB * dyCD - dyAB * dxCD;
        if (Math.Abs(denom) < 1e-15) return null; // parallel or degenerate

        var t = ((cx - ax) * dyCD - (cy - ay) * dxCD) / denom;
        var u = ((cx - ax) * dyAB - (cy - ay) * dxAB) / denom;

        if (t >= 0.0 && t <= 1.0 && u >= 0.0 && u <= 1.0)
            return t;

        return null;
    }

    private static double ToRadians(double degrees) => degrees * Math.PI / 180.0;
}
