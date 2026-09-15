namespace SailSight.Shared.Dtos.Races;

public record RaceLegPerformanceDto(
    Guid Id, Guid RaceId, Guid CourseLegId, string LegName, int LegIndex,
    string Status, string? Reason,
    DateTimeOffset? ExitedPreviousMarkAt, DateTimeOffset? EnteredCurrentMarkAt, DateTimeOffset? ExitedCurrentMarkAt,
    double? SailedDistanceMeters, float? AverageSpeedOverGround, float? AverageVelocityMadeGood, float? MaxSpeedOverGround,
    string TargetType, double TargetLatitude, double TargetLongitude);
