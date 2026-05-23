namespace SailSight.Shared.Dtos.Courses;

/// <summary>
/// Coordinate-only course geometry for anonymous viewers of public sessions.
/// Contains no IDs or names — only the shape of the course on the map.
/// </summary>
public record PublicCourseLayoutDto(
    string StartLineSource,
    double? StartLat1, double? StartLng1,
    double? StartLat2, double? StartLng2,
    string FinishLineSource,
    double? FinishLat1, double? FinishLng1,
    double? FinishLat2, double? FinishLng2,
    IReadOnlyList<PublicCourseLegDto> Legs);

public record PublicCourseLegDto(
    int SortOrder,
    string LegType,
    string PassingSide,
    double Lat1,
    double Lng1,
    double? Lat2,
    double? Lng2);
