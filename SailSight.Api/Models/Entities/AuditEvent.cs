namespace SailSight.Api.Models.Entities;

public class AuditEvent
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid? UserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string? EntityType { get; set; }
    public string? EntityId { get; set; }
    public DateTimeOffset At { get; set; } = DateTimeOffset.UtcNow;
    public string? IpAddress { get; set; }
    public string? Details { get; set; }
}
