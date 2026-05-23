namespace SailSight.Api.Models.Entities;

public class Boat
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid OwnerUserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? SailNumber { get; set; }
    public Guid BoatClassId { get; set; }
    public string? Description { get; set; }
    public bool IsPublic { get; set; } = false;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public BoatClass BoatClass { get; set; } = null!;
    public ICollection<Session> Sessions { get; set; } = [];
}
