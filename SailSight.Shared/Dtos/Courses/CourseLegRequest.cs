namespace SailSight.Shared.Dtos.Courses;

public record CourseLegRequest(
    Guid MarkId,
    Guid? GateMarkId,
    string? LegName,
    double? OverrideRoundingRadiusMeters,
    string LegType,
    string PassingSide);
