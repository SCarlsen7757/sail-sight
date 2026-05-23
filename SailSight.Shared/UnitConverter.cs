namespace SailSight.Shared;

public enum SpeedUnit { Knots, KmPerHour }

public enum WindSpeedUnit { MetersPerSecond, Knots }

public enum DistanceUnit { Meters, Kilometers, NauticalMiles }

public static class UnitConverter
{
    // Speed: source is knots

    public static double ConvertSpeed(double knots, SpeedUnit unit) => unit switch
    {
        SpeedUnit.KmPerHour => knots * 1.852,
        _ => knots
    };

    public static string SpeedLabel(SpeedUnit unit) => unit switch
    {
        SpeedUnit.KmPerHour => "km/h",
        _ => "kn"
    };

    // Wind speed: source is m/s

    public static double ConvertWindSpeed(double metersPerSecond, WindSpeedUnit unit) => unit switch
    {
        WindSpeedUnit.Knots => metersPerSecond * 1.94384,
        _ => metersPerSecond
    };

    public static string WindSpeedLabel(WindSpeedUnit unit) => unit switch
    {
        WindSpeedUnit.Knots => "kn",
        _ => "m/s"
    };

    // Distance: source is meters

    public static double ConvertDistance(double meters, DistanceUnit unit) => unit switch
    {
        DistanceUnit.Kilometers => meters / 1000.0,
        DistanceUnit.NauticalMiles => meters / 1852.0,
        _ => meters
    };

    public static string DistanceLabel(DistanceUnit unit) => unit switch
    {
        DistanceUnit.Kilometers => "km",
        DistanceUnit.NauticalMiles => "NM",
        _ => "m"
    };
}
