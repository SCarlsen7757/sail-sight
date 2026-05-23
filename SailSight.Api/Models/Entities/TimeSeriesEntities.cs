namespace SailSight.Api.Models.Entities;

public class PositionReading
{
    public DateTimeOffset Time { get; set; }
    public Guid SessionId { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public float SpeedOverGround { get; set; }
    public float CourseOverGround { get; set; }
    public float Altitude { get; set; }
    public float QuaternionW { get; set; }
    public float QuaternionX { get; set; }
    public float QuaternionY { get; set; }
    public float QuaternionZ { get; set; }

    public Session Session { get; set; } = null!;
}

public class WindReading
{
    public DateTimeOffset Time { get; set; }
    public Guid SessionId { get; set; }
    public float WindDirection { get; set; }
    public float WindSpeed { get; set; }

    public Session Session { get; set; } = null!;
}

public class SpeedThroughWaterReading
{
    public DateTimeOffset Time { get; set; }
    public Guid SessionId { get; set; }
    public float ForwardSpeed { get; set; }
    public float HorizontalSpeed { get; set; }

    public Session Session { get; set; } = null!;
}

public class DepthReading
{
    public DateTimeOffset Time { get; set; }
    public Guid SessionId { get; set; }
    public float Depth { get; set; }

    public Session Session { get; set; } = null!;
}

public class TemperatureReading
{
    public DateTimeOffset Time { get; set; }
    public Guid SessionId { get; set; }
    public float Temperature { get; set; }

    public Session Session { get; set; } = null!;
}

public class LoadReading
{
    public DateTimeOffset Time { get; set; }
    public Guid SessionId { get; set; }
    public required string SensorName { get; set; }
    public float Load { get; set; }

    public Session Session { get; set; } = null!;
}

public class DeclinationReading
{
    public DateTimeOffset Time { get; set; }
    public Guid SessionId { get; set; }
    public float DeclinationOffset { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }

    public Session Session { get; set; } = null!;
}

public class RaceTimerEvent
{
    public DateTimeOffset Time { get; set; }
    public Guid SessionId { get; set; }
    public short EventType { get; set; }
    public int TimerValue { get; set; }

    public Session Session { get; set; } = null!;
}

public class LinePositionReading
{
    public DateTimeOffset Time { get; set; }
    public Guid SessionId { get; set; }
    public short LineEnd { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }

    public Session Session { get; set; } = null!;
}

public class ShiftAngleReading
{
    public DateTimeOffset Time { get; set; }
    public Guid SessionId { get; set; }
    public bool IsPort { get; set; }
    public bool IsManual { get; set; }
    public float TrueHeading { get; set; }
    public float SpeedOverGround { get; set; }

    public Session Session { get; set; } = null!;
}
