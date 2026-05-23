namespace SailSight.Api.Models.Entities;

public class RaceSummaryReport
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid SessionId { get; set; }
    public int RaceNumber { get; set; }
    public Guid RaceId { get; set; }
    public string Content { get; set; } = "";
    public string Model { get; set; } = "";
    public string ContextHash { get; set; } = "";
    public DateTimeOffset GeneratedAt { get; set; }

    public Session? Session { get; set; }
    public Race? Race { get; set; }
}
