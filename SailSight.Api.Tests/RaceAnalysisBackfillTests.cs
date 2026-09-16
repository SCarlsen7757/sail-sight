using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using SailSight.Api.Data;
using SailSight.Api.Models.Entities;
using SailSight.Api.Services;

namespace SailSight.Api.Tests;

public class RaceAnalysisBackfillTests
{
    [Fact]
    public async Task BackfillRebuildsOutdatedResultsAndIsRepeatable()
    {
        var services = new ServiceCollection();
        var database = Guid.NewGuid().ToString();
        services.AddLogging();
        services.AddDbContext<AppDbContext>(o => o.UseInMemoryDatabase(database));
        services.AddScoped<RaceLegAnalysisService>();
        using var provider = services.BuildServiceProvider();
        Guid raceId;
        using (var scope = provider.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var track = RaceCalculationTests.PortTrack();
            var leg = RaceCalculationTests.MarkLeg();
            var course = new Course { Legs = [leg] };
            var session = new Session { StartedAt = track[0].Time, EndedAt = track[^1].Time };
            var race = new Race { SessionId = session.Id, CourseId = course.Id, StartedAt = session.StartedAt, EndedAt = session.EndedAt };
            raceId = race.Id;
            db.Courses.Add(course); db.Sessions.Add(session); db.Races.Add(race);
            db.Positions.AddRange(track.Select(p => new PositionReading { SessionId = session.Id, Time = p.Time, Latitude = p.Latitude, Longitude = p.Longitude, SpeedOverGround = p.SpeedOverGround, CourseOverGround = p.CourseOverGround }));
            await db.SaveChangesAsync();
            await scope.ServiceProvider.GetRequiredService<RaceLegAnalysisService>().AnalyzeRaceAsync(race.Id);
            // Simulate an older calculation revision requiring a rebuild at startup.
            race.AnalysisRevision = 0;
            leg.PassingSide = PassingSide.Starboard;
            await db.SaveChangesAsync();
        }
        var backfill = new RaceAnalysisBackfill(provider.GetRequiredService<IServiceScopeFactory>(), provider.GetRequiredService<ILogger<RaceAnalysisBackfill>>());
        await backfill.StartAsync(default);
        await backfill.StartAsync(default);
        using var verify = provider.CreateScope();
        var verifyDb = verify.ServiceProvider.GetRequiredService<AppDbContext>();
        var result = await verifyDb.Races.FindAsync(raceId);
        Assert.Equal(RaceLegAnalysisService.CurrentRevision, result!.AnalysisRevision);
        Assert.Equal(RaceAnalysisStatus.Incomplete, result.AnalysisStatus);
        Assert.Equal(LegPerformanceStatus.WrongSide, (await verifyDb.RaceLegPerformances.SingleAsync()).Status);
    }

    [Fact]
    public async Task EditingSecondGateEndpointReanalyzesItsRace()
    {
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var leg = RaceCalculationTests.GateLeg();
        var course = new Course { Legs = [leg] };
        var track = new[] { RaceCalculationTests.P(-20, 0, 0), RaceCalculationTests.P(20, 0, 10) };
        var session = new Session { StartedAt = track[0].Time, EndedAt = track[^1].Time };
        var race = new Race { SessionId = session.Id, CourseId = course.Id, StartedAt = session.StartedAt, EndedAt = session.EndedAt };
        db.Courses.Add(course); db.Sessions.Add(session); db.Races.Add(race);
        db.Positions.AddRange(track.Select(p => new PositionReading { SessionId = session.Id, Time = p.Time, Latitude = p.Latitude, Longitude = p.Longitude, SpeedOverGround = p.SpeedOverGround, CourseOverGround = p.CourseOverGround }));
        await db.SaveChangesAsync();
        var service = new RaceLegAnalysisService(db);
        await service.AnalyzeRaceAsync(race.Id);
        Assert.Equal(RaceAnalysisStatus.Completed, race.AnalysisStatus);
        leg.GateMark!.Latitude = leg.Mark.Latitude; // Gate no longer spans the track.
        leg.GateMark.Longitude = RaceCalculationTests.P(20, 0, 0).Longitude;
        await db.SaveChangesAsync();
        await service.ReanalyzeRacesByMarkAsync(leg.GateMark.Id);
        Assert.Equal(LegPerformanceStatus.Unreached, (await db.RaceLegPerformances.SingleAsync()).Status);
        Assert.Equal(RaceAnalysisStatus.Incomplete, race.AnalysisStatus);
    }
}
