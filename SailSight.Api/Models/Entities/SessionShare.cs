namespace SailSight.Api.Models.Entities;

public class SessionShare
{
    public Guid SessionId { get; set; }
    public Guid TeamId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Session Session { get; set; } = null!;
    public Team Team { get; set; } = null!;
}
