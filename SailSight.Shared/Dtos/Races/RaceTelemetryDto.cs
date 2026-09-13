using SailSight.Shared.Dtos.Telemetry;

namespace SailSight.Shared.Dtos.Races;

public record RaceTelemetryDto(
    List<PositionDto> Positions,
    List<WindDto> Wind,
    List<SpeedThroughWaterDto> SpeedThroughWater,
    List<DepthDto> Depth,
    List<TemperatureDto> Temperature,
    List<LoadDto> Load,
    List<ShiftAngleDto> ShiftAngles);
