namespace SailSight.Api.Models.Entities;

public enum BoatClassRequestStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2,
}

public class BoatClassRequest
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid RequestedByUserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public double? Length { get; set; }
    public double? Width { get; set; }
    public double? Weight { get; set; }
    public string? Notes { get; set; }
    public BoatClassRequestStatus Status { get; set; } = BoatClassRequestStatus.Pending;
    public Guid? ReviewedByUserId { get; set; }
    public DateTimeOffset? ReviewedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public AppUser RequestedByUser { get; set; } = null!;
}
