namespace SailSight.Shared.Dtos.Telemetry;

public record WindDto(DateTimeOffset Time, float WindDirection, float WindSpeed);
