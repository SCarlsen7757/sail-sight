namespace SailSight.Shared.Dtos.Telemetry;

public record SpeedThroughWaterDto(DateTimeOffset Time, float ForwardSpeed, float HorizontalSpeed);
