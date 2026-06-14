namespace SailSight.Shared.Dtos.Races;

public record RaceLegPerformanceDto(
    Guid Id,
    Guid RaceId,
    Guid CourseLegId,
    string LegName,
    int LegIndex,
    string Status,
    DateTimeOffset ExitedPreviousMarkAt,
    DateTimeOffset EnteredCurrentMarkAt,
    double SailedDistanceMeters,
    float AverageSpeedOverGround,
    float AverageVelocityMadeGood,
    float MaxSpeedOverGround);
