using SailSight.Shared.Dtos.Races;

namespace SailSight.Api.Services;

public record RaceSummaryContext(
    string BoatName,
    string? BoatClass,
    string? CourseName,
    int RaceNumber,
    DateTimeOffset StartedAt,
    double DurationSeconds,
    double SailedDistanceMeters,
    float MaxSpeedOverGroundMs,
    float AvgSpeedOverGroundMs,
    float? AvgWindSpeedMs,
    float? AvgWindDirectionDeg,
    StartAnalysisDto? StartAnalysis,
    double? StartLineLengthMeters);
