namespace SailSight.Shared.Dtos.Courses;

public record CourseDto(
    Guid Id,
    string Name,
    int Year,
    string? Description,
    DateTimeOffset CreatedAt,
    double TotalLengthMeters,
    string StartLineSource,
    Guid? StartMark1Id,
    Guid? StartMark2Id,
    string FinishLineSource,
    Guid? FinishMark1Id,
    Guid? FinishMark2Id,
    List<CourseLegDto> Legs);
