namespace SailSight.Shared.Dtos.Stats;

/// <summary>
/// Top-level summary statistics across the entire dataset.
/// Distances are in metres; speeds are in metres per second; durations are in seconds.
/// </summary>
public record GlobalStatsDto(
    int TotalBoats,
    int TotalSessions,
    int TotalRaces,
    double TotalSessionDurationSeconds,
    double TotalRaceDurationSeconds,
    double TotalSailedDistanceMeters,
    float TopSpeedOverGround,
    DateTimeOffset? EarliestSessionAt,
    DateTimeOffset? LatestSessionAt);
