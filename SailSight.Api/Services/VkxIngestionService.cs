using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using SailSight.Api.Data;
using SailSight.Api.Helpers;
using SailSight.Api.Models.Entities;
using Vakaros.Vkx.Parser;
using Vakaros.Vkx.Parser.Models;

namespace SailSight.Api.Services;

/// <summary>
/// Orchestrates parsing a VKX file, persisting all records into the database,
/// and extracting races via <see cref="RaceDetectionService"/>.
/// </summary>
public class VkxIngestionService(AppDbContext db, RaceDetectionService raceDetection, IngestionLimits limits)
{
    /// <summary>
    /// Computes the SHA-256 hash of raw file bytes and returns it as a lowercase hex string.
    /// </summary>
    public static string ComputeHash(byte[] fileBytes)
    {
        var hashBytes = SHA256.HashData(fileBytes);
        return Convert.ToHexStringLower(hashBytes);
    }

    /// <summary>
    /// Checks whether a session with the given content hash already exists for the given owner.
    /// </summary>
    public async Task<bool> IsDuplicateAsync(Guid ownerUserId, string contentHash, CancellationToken ct = default)
    {
        return await db.Sessions.AnyAsync(s => s.OwnerUserId == ownerUserId && s.ContentHash == contentHash, ct);
    }

    /// <summary>
    /// Parses the VKX data and persists all records, returning the created session entity.
    /// </summary>
    public async Task<Session> IngestAsync(Guid ownerUserId, Stream fileStream, string fileName, string contentHash, CancellationToken ct = default)
    {
        VkxIngestionValidator.Validate(fileStream, limits, ct);
        var vkxSession = VkxParser.Parse(new CancellableReadStream(fileStream, ct));
        await using var tx = await db.Database.BeginTransactionAsync(ct);

        // Extract session-level metadata.
        var deviceConfig = vkxSession.DeviceConfigurationRecords.FirstOrDefault();
        var firstPosition = vkxSession.PositionRecords.FirstOrDefault();
        var lastPosition = vkxSession.PositionRecords.LastOrDefault();

        // The ingestion validator requires ordered positions and device configuration.

        var session = new Session
        {
            OwnerUserId = ownerUserId,
            FileName = fileName,
            ContentHash = contentHash,
            FormatVersion = vkxSession.FormatVersion,
            TelemetryRateHz = deviceConfig!.TelemetryLoggingRate, //HACK : Assume telemetry rate is constant and use value from device config record.
            IsFixedToBodyFrame = deviceConfig!.IsFixedToBodyFrame, //HACK : Assume fixed-to-body-frame is constant and use value from device config record.
            StartedAt = firstPosition!.Timestamp, //HACK : Assume session start time is timestamp of first position record.
            EndedAt = lastPosition!.Timestamp, //HACK : Assume session end time is timestamp of last position record.
        };

        db.Sessions.Add(session);
        await db.SaveChangesAsync(ct);

        // Detect and insert races.
        var races = raceDetection.DetectRaces(vkxSession, session.Id);
        if (races.Any(r => r.StartedAt < session.StartedAt || r.StartedAt > session.EndedAt ||
            (r.EndedAt.HasValue && (r.EndedAt < r.StartedAt || r.EndedAt > session.EndedAt))))
            throw new FormatException("Race timestamps must be within the session.");
        if (races.Count > limits.Races) throw new BadHttpRequestException("Race budget exceeded.", 413);
        if (races.Count > 0)
        {
            EnrichRaceMetrics(races, vkxSession.PositionRecords);
            db.Races.AddRange(races);
            await db.SaveChangesAsync(ct);
            session.Races = races;
        }

        // Insert time-series data.
        await InsertTimeSeriesDataAsync(vkxSession, session.Id, ct);

        await tx.CommitAsync(ct);
        return session;
    }

    /// <summary>
    /// Computes sailed distance (Haversine sum) and max speed over ground for each race
    /// using the in-memory position records so we avoid a round-trip to the database.
    /// </summary>
    private static void EnrichRaceMetrics(List<Race> races, IEnumerable<PositionRecord> allPositions)
    {
        var positions = allPositions.OrderBy(p => p.Timestamp).ToArray();
        var cursor = 0;
        foreach (var race in races.OrderBy(r => r.StartedAt))
        {
            if (race.EndedAt is null) continue;
            while (cursor < positions.Length && positions[cursor].Timestamp < race.StartedAt) cursor++;
            PositionRecord? previous = null;
            for (var i = cursor; i < positions.Length && positions[i].Timestamp <= race.EndedAt; i++)
            {
                var p = positions[i];
                if (previous != null) race.SailedDistanceMeters += GeoHelper.HaversineMeters(previous.Latitude, previous.Longitude, p.Latitude, p.Longitude);
                race.MaxSpeedOverGround = Math.Max(race.MaxSpeedOverGround, p.SpeedOverGround);
                previous = p;
                cursor = i;
            }
        }
    }

    private async Task InsertBatchesAsync<T>(IEnumerable<T> records, CancellationToken ct) where T : class
    {
        foreach (var batch in records.Chunk(2_000))
        {
            ct.ThrowIfCancellationRequested();
            db.Set<T>().AddRange(batch);
            await db.SaveChangesAsync(ct);
            foreach (var row in batch) db.Entry(row).State = EntityState.Detached;
        }
    }

    private async Task InsertTimeSeriesDataAsync(VkxSession vkxSession, Guid sessionId, CancellationToken ct)
    {
        // Positions (highest frequency — bulk insert)
        var positions = vkxSession.PositionRecords.Select(p => new PositionReading
        {
            Time = p.Timestamp,
            SessionId = sessionId,
            Latitude = p.Latitude,
            Longitude = p.Longitude,
            SpeedOverGround = p.SpeedOverGround,
            CourseOverGround = p.CourseOverGround,
            Altitude = p.Altitude,
            QuaternionW = p.QuaternionW,
            QuaternionX = p.QuaternionX,
            QuaternionY = p.QuaternionY,
            QuaternionZ = p.QuaternionZ,
        });
        await InsertBatchesAsync(positions, ct);

        // Wind readings
        var windReadings = vkxSession.WindRecords.Select(w => new WindReading
        {
            Time = w.Timestamp,
            SessionId = sessionId,
            WindDirection = w.WindDirection,
            WindSpeed = w.WindSpeed,
        });
        await InsertBatchesAsync(windReadings, ct);

        // Speed through water
        var speedReadings = vkxSession.SpeedThroughWaterRecords.Select(s => new SpeedThroughWaterReading
        {
            Time = s.Timestamp,
            SessionId = sessionId,
            ForwardSpeed = s.ForwardSpeed,
            HorizontalSpeed = s.HorizontalSpeed,
        });
        await InsertBatchesAsync(speedReadings, ct);

        // Depth
        var depthReadings = vkxSession.DepthRecords.Select(d => new DepthReading
        {
            Time = d.Timestamp,
            SessionId = sessionId,
            Depth = d.Depth,
        });
        await InsertBatchesAsync(depthReadings, ct);

        // Temperature
        var tempReadings = vkxSession.TemperatureRecords.Select(t => new TemperatureReading
        {
            Time = t.Timestamp,
            SessionId = sessionId,
            Temperature = t.Temperature,
        });
        await InsertBatchesAsync(tempReadings, ct);

        // Load
        var loadReadings = vkxSession.LoadRecords.Select(l => new LoadReading
        {
            Time = l.Timestamp,
            SessionId = sessionId,
            SensorName = l.SensorName,
            Load = l.Load,
        });
        await InsertBatchesAsync(loadReadings, ct);

        // Declinations
        var declinations = vkxSession.DeclinationRecords.Select(d => new DeclinationReading
        {
            Time = d.Timestamp,
            SessionId = sessionId,
            DeclinationOffset = d.DeclinationOffset,
            Latitude = d.Latitude,
            Longitude = d.Longitude,
        });
        await InsertBatchesAsync(declinations, ct);

        // Race timer events
        var timerEvents = vkxSession.RaceTimerEventRecords.Select(e => new RaceTimerEvent
        {
            Time = e.Timestamp,
            SessionId = sessionId,
            EventType = (short)e.EventType,
            TimerValue = e.TimerValue,
        });
        await InsertBatchesAsync(timerEvents, ct);

        // Line positions
        var linePositions = vkxSession.LinePositionRecords.Select(l => new LinePositionReading
        {
            Time = l.Timestamp,
            SessionId = sessionId,
            LineEnd = (short)l.LineEnd,
            Latitude = l.Latitude,
            Longitude = l.Longitude,
        });
        await InsertBatchesAsync(linePositions, ct);

        // Shift angles
        var shiftAngles = vkxSession.ShiftAngleRecords.Select(s => new ShiftAngleReading
        {
            Time = s.Timestamp,
            SessionId = sessionId,
            IsPort = s.IsPort,
            IsManual = s.IsManual,
            TrueHeading = s.TrueHeading,
            SpeedOverGround = s.SpeedOverGround,
        });
        await InsertBatchesAsync(shiftAngles, ct);

        await db.SaveChangesAsync(ct);
    }
}
