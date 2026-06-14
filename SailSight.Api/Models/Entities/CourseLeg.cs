namespace SailSight.Api.Models.Entities;

public class CourseLeg
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid CourseId { get; set; }
    public Guid MarkId { get; set; }
    public Guid? GateMarkId { get; set; }
    public int SortOrder { get; set; }
    public string? LegName { get; set; }
    public double? OverrideRoundingRadiusMeters { get; set; }
    public LegType LegType { get; set; } = LegType.Mark;
    public PassingSide PassingSide { get; set; } = PassingSide.Port;

    public Course Course { get; set; } = null!;
    public Mark Mark { get; set; } = null!;
    public Mark? GateMark { get; set; }
}
