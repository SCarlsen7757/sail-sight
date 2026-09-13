namespace SailSight.Shared.Dtos.Courses;

public record CourseLegDto(
    Guid Id,
    Guid MarkId,
    string MarkName,
    Guid? GateMarkId,
    string? GateMarkName,
    int SortOrder,
    string? LegName,
    double? OverrideRoundingRadiusMeters,
    string LegType,
    string PassingSide,
    double Latitude,
    double Longitude,
    double? GateLatitude,
    double? GateLongitude,
    double MarkDefaultRoundingRadiusMeters);
