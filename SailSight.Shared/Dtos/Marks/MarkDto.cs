namespace SailSight.Shared.Dtos.Marks;

public record MarkDto(Guid Id, string Name, DateOnly ActiveFrom, DateOnly? ActiveUntil, double Latitude, double Longitude, string? Description);
