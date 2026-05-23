namespace SailSight.Api.Models.Entities;

public class Mark
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid OwnerUserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateOnly ActiveFrom { get; set; }
    public DateOnly? ActiveUntil { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string? Description { get; set; }

    public ICollection<CourseLeg> CourseLegs { get; set; } = [];
}
