using System.Buffers.Binary;

namespace SailSight.Api.Services;

/// <summary>Bounded structural and value validation before the unchanged parser allocates records.</summary>
public static class VkxIngestionValidator
{
    private static readonly Dictionary<int, int> Sizes = new()
    {
        [1]=32, [2]=44, [3]=20, [4]=13, [5]=17, [6]=18, [7]=12, [8]=13,
        [10]=16, [11]=16, [12]=12, [14]=16, [15]=16, [16]=12, [32]=13, [33]=52, [254]=2, [255]=7
    };
    public static void Validate(Stream stream, IngestionLimits limits, CancellationToken ct)
    {
        stream.Position = 0;
        Span<byte> payload = stackalloc byte[52];
        var keys = new HashSet<(int, ulong)>();
        var lastTime = new Dictionary<int, ulong>();
        var count = 0; var positions = 0; var configs = 0; var raceStarts = 0;
        int? version = null;
        while (stream.Position < stream.Length)
        {
            ct.ThrowIfCancellationRequested();
            if (++count > limits.Records) throw new BadHttpRequestException("Record budget exceeded.", 413);
            var key = stream.ReadByte();
            if (!Sizes.TryGetValue(key, out var size) || size > stream.Length - stream.Position)
                throw new FormatException("Unknown or truncated VKX record.");
            stream.ReadExactly(payload[..size]);
            if (count == 1 && key != 255) throw new FormatException("Missing page header.");
            if (key == 255)
            {
                if (version.HasValue && version != payload[0]) throw new FormatException("Inconsistent format version.");
                version = payload[0];
            }
            if (key == 8)
            {
                if (payload[12] == 0) throw new FormatException("Invalid telemetry rate.");
                configs++;
            }
            if (key is 2 or 3 or 4 or 5 or 6 or 10 or 11 or 12 or 15 or 16)
            {
                var time = BinaryPrimitives.ReadUInt64LittleEndian(payload);
                if (time > 253402300799999UL) throw new FormatException("Timestamp out of range.");
                if (!keys.Add((key, time))) throw new FormatException("Duplicate telemetry sample key.");
                if (lastTime.TryGetValue(key, out var previous) && time < previous) throw new FormatException("Unordered timestamps.");
                lastTime[key] = time;
            }
            switch (key)
            {
                case 2:
                    positions++;
                    Coordinates(BinaryPrimitives.ReadInt32LittleEndian(payload[8..]) * 1e-7,
                        BinaryPrimitives.ReadInt32LittleEndian(payload[12..]) * 1e-7);
                    for (var i=16; i<44; i+=4) Finite(payload[i..]);
                    break;
                case 3:
                    Finite(payload[8..]);
                    Coordinates(BinaryPrimitives.ReadInt32LittleEndian(payload[12..]) * 1e-7,
                        BinaryPrimitives.ReadInt32LittleEndian(payload[16..]) * 1e-7);
                    break;
                case 4:
                    if (payload[8] > 4) throw new FormatException("Invalid timer event.");
                    if (payload[8] == 3 && ++raceStarts > limits.Races) throw new BadHttpRequestException("Race budget exceeded.", 413);
                    break;
                case 5:
                    if (payload[8] > 1) throw new FormatException("Invalid line end.");
                    Coordinates(Finite(payload[9..]), Finite(payload[13..]));
                    break;
                case 6:
                    if (payload[8] > 1 || payload[9] > 1) throw new FormatException("Invalid shift flags.");
                    Finite(payload[10..]); Finite(payload[14..]); break;
                case 10: case 11: Finite(payload[8..]); Finite(payload[12..]); break;
                case 12: case 16: Finite(payload[8..]); break;
                case 15: Finite(payload[12..]); break;
            }
        }
        if (positions == 0 || configs == 0) throw new FormatException("Positions and device configuration are required.");
        stream.Position = 0;
    }
    private static float Finite(ReadOnlySpan<byte> bytes)
    {
        var value = BinaryPrimitives.ReadSingleLittleEndian(bytes);
        if (!float.IsFinite(value)) throw new FormatException("Non-finite telemetry value.");
        return value;
    }
    private static void Coordinates(double latitude, double longitude)
    {
        if (!double.IsFinite(latitude) || !double.IsFinite(longitude) || Math.Abs(latitude)>90 || Math.Abs(longitude)>180)
            throw new FormatException("Invalid coordinates.");
    }
}
