namespace SailSight.Shared.Dtos.Telemetry;

public record PositionDto(DateTimeOffset Time, double Latitude, double Longitude, float SpeedOverGround, float CourseOverGround, float Altitude, float QuaternionW, float QuaternionX, float QuaternionY, float QuaternionZ);
