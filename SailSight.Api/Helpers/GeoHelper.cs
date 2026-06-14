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
    /// Returns the initial bearing from point 1 to point 2 in degrees (0-360).
    /// </summary>
    public static double Bearing(double lat1, double lon1, double lat2, double lon2)
    {
        var phi1 = ToRadians(lat1);
        var phi2 = ToRadians(lat2);
        var deltaLambda = ToRadians(lon2 - lon1);

        var y = Math.Sin(deltaLambda) * Math.Cos(phi2);
        var x = Math.Cos(phi1) * Math.Sin(phi2) -
                Math.Sin(phi1) * Math.Cos(phi2) * Math.Cos(deltaLambda);

        var theta = Math.Atan2(y, x);
        return (ToDegrees(theta) + 360) % 360;
    }

    /// <summary>
    /// Returns the great-circle distance in metres between two coordinates using pre-calculated radian and cosine values of point 2.
    /// This is highly optimized for loops where point 2 (such as a mark) remains constant.
    /// </summary>
    public static double HaversineMetersOptimized(
        double lat1Rad, double lon1Rad,
        double lat2Rad, double cosLat2, double lon2Rad)
    {
        var dLat = lat2Rad - lat1Rad;
        var dLon = lon2Rad - lon1Rad;

        var halfDLatSin = Math.Sin(dLat / 2);
        var halfDLonSin = Math.Sin(dLon / 2);

        var a = halfDLatSin * halfDLatSin
              + Math.Cos(lat1Rad) * cosLat2
              * halfDLonSin * halfDLonSin;

        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return EarthRadiusMeters * c;
    }

    /// <summary>
    /// Returns the initial bearing from point 1 to point 2 in degrees (0-360) using pre-calculated radian, sine, and cosine values of point 2.
    /// This is highly optimized for loops where point 2 (such as a mark) remains constant.
    /// </summary>
    public static double BearingOptimized(
        double lat1Rad, double lon1Rad,
        double lat2Rad, double sinLat2, double cosLat2, double lon2Rad)
    {
        var deltaLambda = lon2Rad - lon1Rad;

        var y = Math.Sin(deltaLambda) * cosLat2;
        var x = Math.Cos(lat1Rad) * sinLat2 -
                Math.Sin(lat1Rad) * cosLat2 * Math.Cos(deltaLambda);

        var theta = Math.Atan2(y, x);
        return (theta * (180.0 / Math.PI) + 360) % 360;
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

    public static double ToRadians(double degrees) => degrees * Math.PI / 180.0;
    public static double ToDegrees(double radians) => radians * 180.0 / Math.PI;
}
