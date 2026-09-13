namespace SailSight.Shared.Dtos.Races;

public record RaceDto(
    Guid Id,
    int RaceNumber,
    Guid? CourseId,
    string? CourseName,
    DateTimeOffset? CountdownStartedAt,
    int? CountdownDurationSeconds,
    DateTimeOffset StartedAt,
    DateTimeOffset? EndedAt,
    double? DurationSeconds,
    double SailedDistanceMeters,
    float MaxSpeedOverGround,
    string? Notes);
