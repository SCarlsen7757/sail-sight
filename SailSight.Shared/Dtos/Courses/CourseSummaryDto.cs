namespace SailSight.Shared.Dtos.Courses;

public record CourseSummaryDto(Guid Id, string Name, int Year, string? Description, DateTimeOffset CreatedAt, int LegCount);
