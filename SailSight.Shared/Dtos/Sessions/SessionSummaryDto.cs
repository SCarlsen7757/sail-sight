namespace SailSight.Shared.Dtos.Sessions;

public record SessionSummaryDto(
    Guid Id,
    Guid? BoatId,
    string? BoatName,
    Guid? CourseId,
    string? CourseName,
    string FileName,
    string? DisplayName,
    short FormatVersion,
    short TelemetryRateHz,
    bool IsFixedToBodyFrame,
    DateTimeOffset StartedAt,
    DateTimeOffset EndedAt,
    DateTimeOffset UploadedAt,
    string? Notes,
    int RaceCount,
    bool IsOwned,
    bool IsPublic,
    IReadOnlyList<string> SharedViaTeams);
