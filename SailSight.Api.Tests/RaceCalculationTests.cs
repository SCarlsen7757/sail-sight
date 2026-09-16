using Microsoft.EntityFrameworkCore;
using SailSight.Api.Data;
using SailSight.Api.Helpers;
using SailSight.Api.Models.Entities;
using SailSight.Api.Services;
using Vakaros.Vkx.Parser.NET.Models;

namespace SailSight.Api.Tests;

public class RaceCalculationTests
{
    private static readonly DateTimeOffset Start = DateTimeOffset.Parse("2026-09-01T10:00:00Z");
    private const double Degree = 180 / (Math.PI * 6_371_000);
    internal static PositionAnalysisData P(double x, double y, double time, float speed = 2, double cog = 0) =>
        new(Start.AddSeconds(time), y * Degree, x * Degree, speed, (float)cog);
    internal static CourseLeg MarkLeg(PassingSide side = PassingSide.Port) => new() { Mark = new Mark { Latitude = 0, Longitude = 0 }, PassingSide = side };
    internal static CourseLeg GateLeg() => new() { LegType = LegType.Gate, Mark = new Mark { Latitude = -10 * Degree, Longitude = 0 }, GateMark = new Mark { Latitude = 10 * Degree, Longitude = 0 } };
    internal static List<PositionAnalysisData> PortTrack() => [P(30, 0, 0), P(10, 0, 10), P(7, 7, 15), P(0, 10, 20), P(0, 30, 30)];
    private static List<RaceLegPerformance> Analyze(List<PositionAnalysisData> p, params CourseLeg[] legs) => RaceLegCalculator.Calculate(Guid.NewGuid(), p[0].Time, p[^1].Time, p, legs);

    [Theory]
    [InlineData(PassingSide.Port, LegPerformanceStatus.Completed)]
    [InlineData(PassingSide.Starboard, LegPerformanceStatus.WrongSide)]
    public void PortVisitChecksSideAndInterpolatesBoundaries(PassingSide required, LegPerformanceStatus status)
    {
        var result = Assert.Single(Analyze(PortTrack(), MarkLeg(required)));
        Assert.Equal(status, result.Status);
        Assert.InRange((result.EnteredCurrentMarkAt!.Value - Start).TotalSeconds, 4.99, 5.01);
        Assert.InRange((result.ExitedCurrentMarkAt!.Value - Start).TotalSeconds, 24.99, 25.01);
        if (status == LegPerformanceStatus.Completed) Assert.InRange(result.SailedDistanceMeters!.Value, 9.99, 10.01);
        else Assert.Null(result.AverageVelocityMadeGood);
    }

    [Fact] public void StarboardVisitAndRepeatedMarks()
    {
        var p = PortTrack().Select(p => p with { Longitude = -p.Longitude }).ToList();
        Assert.Equal(LegPerformanceStatus.Completed, Assert.Single(Analyze(p, MarkLeg(PassingSide.Starboard))).Status);
        var repeat = Analyze(PortTrack(), MarkLeg(), MarkLeg());
        Assert.Equal(LegPerformanceStatus.Completed, repeat[0].Status);
        Assert.Equal(LegPerformanceStatus.Unreached, repeat[1].Status);
    }

    [Theory]
    [InlineData(0, LegPerformanceStatus.Uncertain)]
    [InlineData(20, LegPerformanceStatus.Unreached)]
    [InlineData(30, LegPerformanceStatus.Unreached)]
    public void ThroughMarkTangentAndMissedDoNotAdvance(double y, LegPerformanceStatus expected)
    {
        var result = Analyze([P(-30, y, 0), P(30, y, 30)], MarkLeg(), MarkLeg());
        Assert.Equal(expected, result[0].Status);
        Assert.Equal(LegPerformanceStatus.Unresolved, result[1].Status);
        Assert.Null(result[1].ExitedPreviousMarkAt);
        Assert.Null(result[0].AverageSpeedOverGround);
    }

    [Fact] public void PartialVisitIsUncertain()
    {
        Assert.Equal(LegPerformanceStatus.Uncertain, Assert.Single(Analyze([P(30, 0, 0), P(10, 0, 10)], MarkLeg())).Status);
        Assert.Equal(LegPerformanceStatus.Uncertain, Assert.Single(Analyze([P(10, 0, 0), P(0, 30, 10)], MarkLeg())).Status);
    }

    [Fact] public void ReversingAroundMarkIsUncertain()
    {
        var p = PortTrack(); p.Insert(3, P(10, 0, 17));
        Assert.Equal(LegPerformanceStatus.Uncertain, Assert.Single(Analyze(p, MarkLeg())).Status);
    }

    [Theory] [InlineData(1)] [InlineData(-1)]
    public void GatesCrossInEitherDirectionAndUseMidpoint(int direction)
    {
        var result = Assert.Single(Analyze([P(-20 * direction, 0, 0), P(20 * direction, 0, 10)], GateLeg()));
        Assert.Equal(LegPerformanceStatus.Completed, result.Status);
        Assert.Equal(Start.AddSeconds(5), result.EnteredCurrentMarkAt);
        Assert.Equal(result.EnteredCurrentMarkAt, result.ExitedCurrentMarkAt);
        Assert.Equal(0, result.TargetLatitude); Assert.Equal(0, result.TargetLongitude);
    }

    [Fact] public void GateTouchDoesNotCountButSampleOnCrossingDoes()
    {
        Assert.Equal(LegPerformanceStatus.Unreached, Assert.Single(Analyze([P(-20, 0, 0), P(0, 0, 5), P(-20, 0, 10)], GateLeg())).Status);
        Assert.Equal(Start.AddSeconds(5), Assert.Single(Analyze([P(-20, 0, 0), P(0, 0, 5), P(20, 0, 10)], GateLeg())).EnteredCurrentMarkAt);
        Assert.Equal(LegPerformanceStatus.Unreached, Assert.Single(Analyze([P(-20, 20, 0), P(20, 20, 10)], GateLeg())).Status);
        var gate = GateLeg(); gate.GateMark = gate.Mark;
        Assert.Equal(LegPerformanceStatus.Uncertain, Assert.Single(Analyze([P(-20, 0, 0), P(20, 0, 10)], gate)).Status);
    }

    [Theory] [InlineData(0, 2)] [InlineData(90, 0)] [InlineData(180, -2)]
    public void VmgUsesCogInRadians(double degrees, double expected) =>
        Assert.Equal(expected, RaceLegCalculator.Vmg(P(0, -100, 0, 2, GeoHelper.ToRadians(degrees)), 0, 0), 5);

    [Fact] public void InterpolationTakesShortestDirectionAcrossNorth()
    {
        var point = RaceLegCalculator.Interpolate(P(0, 0, 0, 2, GeoHelper.ToRadians(359)), P(0, 10, 10, 4, GeoHelper.ToRadians(1)), .5);
        Assert.InRange(Math.Abs(point.CourseOverGround), 0, .00001);
        Assert.Equal(3, point.SpeedOverGround);
    }

    [Fact] public void AveragesAreTimeWeightedAndTimerBoundariesInterpolated()
    {
        var result = Assert.Single(Analyze([P(-20, 0, 0, 2, Math.PI / 2), P(-15, 0, 1, 4, Math.PI / 2), P(0, 0, 10, 4, Math.PI / 2), P(10, 0, 15, 4, Math.PI / 2)], GateLeg()));
        Assert.Equal(3.9f, result.AverageSpeedOverGround!.Value, 4);
        Assert.Equal(3.9f, result.AverageVelocityMadeGood!.Value, 4);
        Assert.InRange(result.SailedDistanceMeters!.Value, 19.99, 20.01);
        var p = PortTrack();
        var clipped = RaceLegCalculator.Calculate(Guid.NewGuid(), Start.AddSeconds(2), Start.AddSeconds(29), p, [MarkLeg()]);
        Assert.Equal(Start.AddSeconds(2), clipped[0].ExitedPreviousMarkAt);
    }

    [Fact] public void InvalidOrIncompleteCoverageHasNoMetrics()
    {
        var p = PortTrack(); p[1] = p[1] with { CourseOverGround = float.NaN };
        Assert.Equal(LegPerformanceStatus.Unresolved, Assert.Single(Analyze(p, MarkLeg())).Status);
        var result = RaceLegCalculator.Calculate(Guid.NewGuid(), Start.AddSeconds(-1), Start.AddSeconds(30), PortTrack(), [MarkLeg()]);
        Assert.Null(result[0].SailedDistanceMeters);
    }

    [Fact] public async Task ReanalysisReplacesResultsAndClearsRemovedCourse()
    {
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var leg = MarkLeg(); var course = new Course { Legs = [leg] };
        var session = new Session { StartedAt = Start, EndedAt = Start.AddSeconds(30) };
        var race = new Race { SessionId = session.Id, CourseId = course.Id, StartedAt = Start, EndedAt = session.EndedAt };
        db.Courses.Add(course); db.Sessions.Add(session); db.Races.Add(race);
        db.Positions.AddRange(PortTrack().Select(p => new PositionReading { SessionId = session.Id, Time = p.Time, Latitude = p.Latitude, Longitude = p.Longitude, SpeedOverGround = p.SpeedOverGround, CourseOverGround = p.CourseOverGround }));
        await db.SaveChangesAsync();
        var service = new RaceLegAnalysisService(db);
        await service.AnalyzeRaceAsync(race.Id); await service.AnalyzeRaceAsync(race.Id);
        Assert.Equal(RaceAnalysisStatus.Completed, race.AnalysisStatus);
        Assert.Single(await db.RaceLegPerformances.ToListAsync());
        leg.PassingSide = PassingSide.Starboard; await db.SaveChangesAsync();
        await service.ReanalyzeRacesByCourseAsync(course.Id);
        Assert.Equal(LegPerformanceStatus.WrongSide, (await db.RaceLegPerformances.SingleAsync()).Status);
        race.CourseId = null; await db.SaveChangesAsync(); await service.AnalyzeRaceAsync(race.Id);
        Assert.Empty(await db.RaceLegPerformances.ToListAsync());
        Assert.Equal(RaceAnalysisStatus.Incomplete, race.AnalysisStatus);
        Assert.Equal(RaceLegAnalysisService.CurrentRevision, race.AnalysisRevision);
    }

    private static RaceTimerEventRecord Timer(TimerEventType kind, int seconds, int value = 0) => new() { Timestamp = Start.AddSeconds(seconds), EventType = kind, TimerValue = value };
    [Fact] public void TimerEventsAreSortedAndDuplicateOrUnmatchedEventsIgnored()
    {
        var result = new RaceDetectionService().DetectRaces([
            Timer(TimerEventType.RaceEnd, 20), Timer(TimerEventType.RaceStart, 0), Timer(TimerEventType.RaceStart, 1),
            Timer(TimerEventType.RaceEnd, -20), Timer(TimerEventType.Start, -10, 10), Timer(TimerEventType.Sync, -5, 5),
            Timer(TimerEventType.Start, 5, 20), Timer(TimerEventType.RaceStart, 30)], Guid.NewGuid());
        Assert.Equal(2, result.Count); Assert.Equal(Start.AddSeconds(-5), result[0].CountdownStartedAt);
        Assert.Equal(5, result[0].CountdownDurationSeconds); Assert.Equal(Start.AddSeconds(20), result[0].EndedAt);
        Assert.Null(result[1].EndedAt); Assert.Null(result[1].CountdownStartedAt); Assert.Equal(2, result[1].RaceNumber);
    }
    [Fact] public void ResetClearsCountdownWithoutCreatingRace()
    {
        var result = new RaceDetectionService().DetectRaces([Timer(TimerEventType.Start, -10, 10), Timer(TimerEventType.Reset, -5), Timer(TimerEventType.RaceStart, 0)], Guid.NewGuid());
        Assert.Null(Assert.Single(result).CountdownStartedAt);
        Assert.Empty(new RaceDetectionService().DetectRaces(Array.Empty<RaceTimerEventRecord>(), Guid.NewGuid()));
    }
}
