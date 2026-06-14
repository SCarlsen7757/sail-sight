namespace SailSight.Api.Models.Entities;

public enum LegPerformanceStatus
{
    Completed,
    Missed
}

public class RaceLegPerformance
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid RaceId { get; set; }
    public Guid CourseLegId { get; set; }
    public int LegIndex { get; set; }
    public LegPerformanceStatus Status { get; set; } = LegPerformanceStatus.Completed;

    public DateTimeOffset ExitedPreviousMarkAt { get; set; }
    public DateTimeOffset EnteredCurrentMarkAt { get; set; }

    public double SailedDistanceMeters { get; set; }
    public float AverageSpeedOverGround { get; set; }
    public float AverageVelocityMadeGood { get; set; }
    public float MaxSpeedOverGround { get; set; }

    public Race Race { get; set; } = null!;
    public CourseLeg CourseLeg { get; set; } = null!;
}
