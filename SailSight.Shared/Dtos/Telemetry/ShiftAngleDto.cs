namespace SailSight.Shared.Dtos.Telemetry;

public record ShiftAngleDto(DateTimeOffset Time, bool IsPort, bool IsManual, float TrueHeading, float SpeedOverGround);
