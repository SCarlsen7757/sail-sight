namespace SailSight.Api.Models.Entities;

public class Session
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid OwnerUserId { get; set; }
    public Guid? BoatId { get; set; }
    public Guid? CourseId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string ContentHash { get; set; } = string.Empty;
    public short FormatVersion { get; set; }
    public short TelemetryRateHz { get; set; }
    public bool IsFixedToBodyFrame { get; set; }
    public bool IsPublic { get; set; } = false;
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset EndedAt { get; set; }
    public DateTimeOffset UploadedAt { get; set; } = DateTimeOffset.UtcNow;
    public string? Notes { get; set; }

    public Boat? Boat { get; set; }
    public Course? Course { get; set; }
    public ICollection<Race> Races { get; set; } = [];
    public ICollection<SessionShare> Shares { get; set; } = [];
}
