namespace SailSight.Api.Models.Entities;

public class Invitation
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public string Token { get; set; } = string.Empty;
    public string Role { get; set; } = "User";
    public int? MaxUses { get; set; }
    public int UsedCount { get; set; }
    public DateTimeOffset? ExpiresAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public Guid CreatedByUserId { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public string? Note { get; set; }
}
