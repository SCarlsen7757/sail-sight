namespace SailSight.Shared.Dtos.BoatClasses;

public record BoatClassRequestDto(
    Guid Id,
    Guid RequestedByUserId,
    string RequestedByEmail,
    string Name,
    double? Length,
    double? Width,
    double? Weight,
    string? Notes,
    string Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ReviewedAt);

public record CreateBoatClassRequestRequest(
    string Name,
    double? Length,
    double? Width,
    double? Weight,
    string? Notes);
