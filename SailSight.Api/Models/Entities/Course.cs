namespace SailSight.Api.Models.Entities;

public class Course
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid OwnerUserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Year { get; set; }
    public string? Description { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public LineSource StartLineSource { get; set; } = LineSource.Device;
    public Guid? StartMark1Id { get; set; }
    public Guid? StartMark2Id { get; set; }

    public LineSource FinishLineSource { get; set; } = LineSource.Device;
    public Guid? FinishMark1Id { get; set; }
    public Guid? FinishMark2Id { get; set; }

    public Mark? StartMark1 { get; set; }
    public Mark? StartMark2 { get; set; }
    public Mark? FinishMark1 { get; set; }
    public Mark? FinishMark2 { get; set; }

    public ICollection<CourseLeg> Legs { get; set; } = [];
    public ICollection<Session> Sessions { get; set; } = [];
    public ICollection<Race> Races { get; set; } = [];
}
