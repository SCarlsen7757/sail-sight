namespace SailSight.Shared.Dtos.Telemetry;

public record LoadDto(DateTimeOffset Time, string SensorName, float Load);
