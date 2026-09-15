namespace SailSight.Api.Models.Entities;

/// <summary>
/// One signed-in browser. The auth cookie carries its id, so signing out can revoke this login without
/// affecting the user's other devices.
/// </summary>
public class LoginSession
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid UserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset ExpiresAt { get; set; }
}
