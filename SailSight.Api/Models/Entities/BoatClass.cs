namespace SailSight.Api.Models.Entities;

public class BoatClass
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public string Name { get; set; } = string.Empty;
    public double? Length { get; set; }
    public double? Width { get; set; }
    public double? Weight { get; set; }
}
