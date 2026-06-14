namespace SailSight.Api.Models.Entities;

public enum RaceAnalysisStatus
{
    Pending,
    Incomplete,
    Error,
    Completed
}

public class Race
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid SessionId { get; set; }
    public Guid? CourseId { get; set; }
    public int RaceNumber { get; set; }
    public DateTimeOffset? CountdownStartedAt { get; set; }
    public int? CountdownDurationSeconds { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? EndedAt { get; set; }
    public double SailedDistanceMeters { get; set; }
    public float MaxSpeedOverGround { get; set; }
    public string? Notes { get; set; }
    public RaceAnalysisStatus AnalysisStatus { get; set; } = RaceAnalysisStatus.Pending;

    public Session? Session { get; set; } = null;
    public Course? Course { get; set; } = null;
    public ICollection<RaceLegPerformance> LegPerformances { get; set; } = [];
}
