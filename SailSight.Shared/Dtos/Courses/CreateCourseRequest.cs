namespace SailSight.Shared.Dtos.Courses;

public record CreateCourseRequest(
    string Name,
    int Year,
    string? Description,
    string? StartLineSource,
    Guid? StartMark1Id,
    Guid? StartMark2Id,
    string? FinishLineSource,
    Guid? FinishMark1Id,
    Guid? FinishMark2Id,
    List<CourseLegRequest> Legs);
