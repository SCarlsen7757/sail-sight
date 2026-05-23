namespace SailSight.Shared.Dtos.Races;

public record RaceSummaryDto(
    string Content,
    string Model,
    DateTimeOffset GeneratedAt,
    bool IsStale);
