using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SailSight.Api.Auth;
using SailSight.Api.Controllers;
using SailSight.Api.Data;
using SailSight.Api.Middleware;
using SailSight.Api.Models.Entities;
using SailSight.Api.Services;
using SailSight.Shared.Dtos.Sessions;

namespace SailSight.Api.Tests;

public class SecurityTests
{
    private sealed record User(Guid UserId, bool IsAuthenticated = true) : ICurrentUser { public string? Email => null; }

    [Theory]
    [InlineData("Owner", true)] [InlineData("admin", true)] [InlineData("Member", true)]
    [InlineData("2", false)] [InlineData("999", false)] [InlineData("Owner, Admin", false)] [InlineData("", false)]
    public void TeamRolesMustBeDefinedNames(string value, bool valid) => Assert.Equal(valid, SecurityTransactions.TryTeamRole(value, out _));

    [Fact]
    public void AdministratorsCannotAppointOrManagePrivilegedMembers()
    {
        Assert.True(SecurityTransactions.CanManage(TeamRole.Admin, TeamRole.Member, TeamRole.Member));
        Assert.False(SecurityTransactions.CanManage(TeamRole.Admin, TeamRole.Member, TeamRole.Owner));
        Assert.False(SecurityTransactions.CanManage(TeamRole.Admin, TeamRole.Admin, TeamRole.Member));
        Assert.False(SecurityTransactions.CanManage(TeamRole.Admin, TeamRole.Owner, TeamRole.Member));
        Assert.True(SecurityTransactions.CanManage(TeamRole.Owner, TeamRole.Member, TeamRole.Owner));
    }

    [Theory]
    [InlineData("owner", false, true, true)] [InlineData("team", false, true, false)]
    [InlineData("other", false, false, false)] [InlineData("anonymous", false, false, false)]
    [InlineData("removed", false, false, false)] [InlineData("admin", false, false, false)]
    [InlineData("other", true, true, false)] [InlineData("anonymous", true, true, false)]
    public async Task ActivityPermissionMatrix(string viewer, bool published, bool canRead, bool canWrite)
    {
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var owner = Guid.NewGuid(); var teammate = Guid.NewGuid(); var team = Guid.NewGuid();
        var session = new Session { OwnerUserId = owner, IsPublic = published, FileName = "private-name.vkx", ContentHash = "secret-hash", Notes = "secret-note", StartedAt = DateTimeOffset.Parse("2026-09-01T10:00:00Z") };
        session.Races.Add(new Race { SessionId = session.Id, Notes = "secret-race-note" });
        session.Shares.Add(new SessionShare { SessionId = session.Id, TeamId = team });
        db.Sessions.Add(session); db.Teams.Add(new Team { Id = team, Name = "Crew" });
        db.TeamMembers.Add(new TeamMember { TeamId = team, UserId = teammate }); await db.SaveChangesAsync();
        var user = new User(viewer == "owner" ? owner : viewer == "team" ? teammate : Guid.NewGuid(), viewer != "anonymous");
        var auth = new SessionAuthorizer(db, user, new AuthOptions());
        Assert.Equal(canRead, await auth.CanReadAsync(session.Id)); Assert.Equal(canWrite, await auth.CanWriteAsync(session.Id));
        if (!canRead) return;
        var controller = new SessionsController(db, new VkxIngestionService(db, new RaceDetectionService(), new IngestionLimits()), user, auth, null!);
        var result = await controller.GetById(session.Id, default);
        var dto = Assert.IsType<SessionDetailDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        if (viewer is "owner" or "team") { Assert.Equal("private-name.vkx", dto.FileName); Assert.Equal("secret-race-note", dto.Races.First().Notes); }
        else { Assert.Empty(dto.FileName); Assert.Empty(dto.ContentHash); Assert.Null(dto.Notes); Assert.Null(dto.Races.First().Notes); }
        Assert.Equal("Session 2026-09-01", dto.DisplayName);
    }

    [Theory]
    [InlineData(null, 403)] [InlineData("wrong", 403)] [InlineData("known", 200)]
    public async Task CookieAloneDoesNotSatisfyCsrf(string? header, int status)
    {
        var ctx = new DefaultHttpContext(); ctx.Request.Method = "POST";
        ctx.Request.Headers.Cookie = "sailsight.csrf=known";
        if (header != null) ctx.Request.Headers["X-CSRF-Token"] = header;
        ctx.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString())], "cookie"));
        await new CsrfMiddleware(_ => Task.CompletedTask).InvokeAsync(ctx);
        Assert.Equal(status, ctx.Response.StatusCode);
    }

    [Theory]
    [InlineData(null, 403)] [InlineData("https://hostile.test", 403)] [InlineData("https://sail.test", 200)]
    public async Task AnonymousLoginAlsoRequiresApplicationOrigin(string? origin, int status)
    {
        var ctx = new DefaultHttpContext(); ctx.Request.Method = "POST";
        if (origin != null) ctx.Request.Headers.Origin = origin;
        await new RequestOriginMiddleware(_ => Task.CompletedTask, Options.Create(new WebOptions { PublicBaseUrl = "https://sail.test" })).InvokeAsync(ctx);
        Assert.Equal(status, ctx.Response.StatusCode);
    }

    [Fact]
    public void AdmissionIsAtomicAndReleased()
    {
        var gate = new IngestionGate(new()); var a = Guid.NewGuid();
        var first = gate.TryEnter(a); Assert.NotNull(first); Assert.Null(gate.TryEnter(a));
        using var second = gate.TryEnter(Guid.NewGuid()); Assert.NotNull(second); Assert.Null(gate.TryEnter(Guid.NewGuid()));
        first.Dispose(); using var again = gate.TryEnter(a); Assert.NotNull(again);
    }

    private static MemoryStream File(bool duplicate = false, float speed = 1, int latitude = 550000000)
    {
        var stream = new MemoryStream(); var writer = new BinaryWriter(stream);
        writer.Write((byte)255); writer.Write((byte)1); writer.Write(new byte[6]);
        writer.Write((byte)8); writer.Write(new byte[12]); writer.Write((byte)10);
        for (var i = 0; i < (duplicate ? 2 : 1); i++)
        {
            writer.Write((byte)2); writer.Write(1_700_000_000_000UL); writer.Write(latitude); writer.Write(120000000);
            writer.Write(speed); for (var f = 0; f < 6; f++) writer.Write(0f);
        }
        stream.Position = 0; return stream;
    }

    [Fact] public void ValidFilePasses() { using var file = File(); VkxIngestionValidator.Validate(file, new(), default); Assert.Equal(0, file.Position); }
    [Fact] public void DuplicateSamplesFail() { using var file = File(duplicate: true); Assert.Throws<FormatException>(() => VkxIngestionValidator.Validate(file, new(), default)); }
    [Fact] public void NonFiniteFails() { using var file = File(speed: float.NaN); Assert.Throws<FormatException>(() => VkxIngestionValidator.Validate(file, new(), default)); }
    [Fact] public void CoordinatesFail() { using var file = File(latitude: 910000000); Assert.Throws<FormatException>(() => VkxIngestionValidator.Validate(file, new(), default)); }
    [Fact] public void TruncationFails() { using var file = File(); file.SetLength(file.Length-1); Assert.Throws<FormatException>(() => VkxIngestionValidator.Validate(file, new(), default)); }
    [Fact] public void RecordBudgetFails() { using var file = File(); Assert.Equal(413, Assert.Throws<BadHttpRequestException>(() => VkxIngestionValidator.Validate(file, new() { Records=2 }, default)).StatusCode); }
    [Fact] public void CancellationStopsValidation() { using var file = File(); Assert.Throws<OperationCanceledException>(() => VkxIngestionValidator.Validate(file, new(), new CancellationToken(true))); }
}
