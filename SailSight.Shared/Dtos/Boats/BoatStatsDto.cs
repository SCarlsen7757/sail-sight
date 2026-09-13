using SailSight.Shared.Dtos.BoatClasses;

namespace SailSight.Shared.Dtos.Boats;

/// <summary>
/// Aggregate statistics for a single boat across all linked sessions and races.
/// Distances are in metres; speeds are in metres per second; durations are in seconds.
/// </summary>
public record BoatStatsDto(
    Guid BoatId,
    string BoatName,
    string? SailNumber,
    BoatClassSummaryDto BoatClass,
    int SessionCount,
    int RaceCount,
    double TotalSessionDurationSeconds,
    double TotalRaceDurationSeconds,
    double TotalSailedDistanceMeters,
    float TopSpeedOverGround);
