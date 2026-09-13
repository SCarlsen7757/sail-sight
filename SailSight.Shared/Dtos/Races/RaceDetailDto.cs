namespace SailSight.Shared.Dtos.Races;

public record RaceDetailDto(
    Guid Id,
    Guid SessionId,
    int RaceNumber,
    Guid? CourseId,
    DateTimeOffset? CountdownStartedAt,
    int? CountdownDurationSeconds,
    DateTimeOffset StartedAt,
    DateTimeOffset? EndedAt,
    double? DurationSeconds,
    double SailedDistanceMeters,
    float MaxSpeedOverGround,
    string? Notes,
    LinePositionDto? PinEnd,
    LinePositionDto? BoatEnd,
    StartAnalysisDto? StartAnalysis,
    int TelemetryRateHz,
    Guid? BoatId);
