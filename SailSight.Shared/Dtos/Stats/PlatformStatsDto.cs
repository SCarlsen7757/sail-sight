namespace SailSight.Shared.Dtos.Stats;

/// <summary>
/// Platform-wide aggregate statistics. All durations are in seconds; distances in metres.
/// Safe to expose publicly — only aggregate counts and totals, no individual records.
/// </summary>
public record PlatformStatsDto(
    int BoatClassCount,
    int BoatCount,
    int SessionCount,
    double TotalSessionDurationSeconds,
    int RaceCount,
    double TotalRaceDurationSeconds,
    double TotalRaceDistanceMeters);
