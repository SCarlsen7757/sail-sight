using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SailSight.Api.Auth;
using SailSight.Api.Data;
using SailSight.Api.Helpers;
using SailSight.Api.Models.Entities;
using SailSight.Api.Services;
using SailSight.Shared.Dtos.Courses;

namespace SailSight.Api.Controllers;

[ApiVersion("1.0")]
[ApiController]
[Authorize]
[Route("api/v{version:apiVersion}/[controller]")]
public class CoursesController(AppDbContext db, ICurrentUser currentUser, RaceLegAnalysisService legAnalysis) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<CourseSummaryDto>>> GetAll([FromQuery] int? year, CancellationToken ct)
    {
        var userId = currentUser.UserId;
        var query = db.Courses.Where(c => c.OwnerUserId == userId);
        if (year.HasValue)
            query = query.Where(c => c.Year == year.Value);

        var courses = await query
            .OrderBy(c => c.Year).ThenBy(c => c.Name)
            .Select(c => new CourseSummaryDto(c.Id, c.Name, c.Year, c.Description, c.CreatedAt, c.Legs.Count))
            .ToListAsync(ct);
        return Ok(courses);
    }

    [AllowAnonymous]
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CourseDto>> GetById(Guid id, CancellationToken ct)
    {
        var isAuthenticated = currentUser.IsAuthenticated;
        var userId = currentUser.UserId;
        var course = await db.Courses
            .Where(c => c.Id == id && (
                (isAuthenticated && c.OwnerUserId == userId) ||
                db.Races.Any(r => r.CourseId == c.Id && db.Sessions.Any(s => s.Id == r.SessionId && s.IsPublic))
            ))
            .Include(c => c.Legs.OrderBy(l => l.SortOrder))
                .ThenInclude(l => l.Mark)
            .Include(c => c.Legs)
                .ThenInclude(l => l.GateMark)
            .FirstOrDefaultAsync(ct);
        if (course is null) return NotFound();
        return Ok(MapToDto(course));
    }

    [HttpPost]
    public async Task<ActionResult<CourseDto>> Create(CreateCourseRequest request, CancellationToken ct)
    {
        var userId = currentUser.UserId;
        var (markIds, validationError) = CollectAndValidateMarkIds(request.Legs,
            request.StartMark1Id, request.StartMark2Id,
            request.FinishMark1Id, request.FinishMark2Id);
        if (validationError is not null) return BadRequest(new { message = validationError });

        var ownedMarks = await db.Marks.CountAsync(m => markIds.Contains(m.Id) && m.OwnerUserId == userId, ct);
        if (ownedMarks != markIds.Count) return BadRequest(new { message = "One or more marks are not owned by you." });

        var course = new Course
        {
            OwnerUserId = userId,
            Name = request.Name,
            Year = request.Year,
            Description = request.Description,
            StartLineSource = ParseLineSource(request.StartLineSource),
            StartMark1Id = request.StartMark1Id,
            StartMark2Id = request.StartMark2Id,
            FinishLineSource = ParseLineSource(request.FinishLineSource),
            FinishMark1Id = request.FinishMark1Id,
            FinishMark2Id = request.FinishMark2Id,
        };
        for (var i = 0; i < request.Legs.Count; i++)
        {
            var leg = request.Legs[i];
            course.Legs.Add(BuildLeg(leg, i + 1));
        }
        db.Courses.Add(course);
        await db.SaveChangesAsync(ct);

        var created = await db.Courses
            .Include(c => c.Legs.OrderBy(l => l.SortOrder))
                .ThenInclude(l => l.Mark)
            .Include(c => c.Legs)
                .ThenInclude(l => l.GateMark)
            .FirstAsync(c => c.Id == course.Id, ct);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, MapToDto(created));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<CourseDto>> Update(Guid id, UpdateCourseRequest request, CancellationToken ct)
    {
        var userId = currentUser.UserId;
        var course = await db.Courses
            .Where(c => c.Id == id && c.OwnerUserId == userId)
            .Include(c => c.Legs)
            .FirstOrDefaultAsync(ct);
        if (course is null) return NotFound();

        var (markIds, validationError) = CollectAndValidateMarkIds(request.Legs,
            request.StartMark1Id, request.StartMark2Id,
            request.FinishMark1Id, request.FinishMark2Id);
        if (validationError is not null) return BadRequest(new { message = validationError });

        var ownedMarks = await db.Marks.CountAsync(m => markIds.Contains(m.Id) && m.OwnerUserId == userId, ct);
        if (ownedMarks != markIds.Count) return BadRequest(new { message = "One or more marks are not owned by you." });

        course.Name = request.Name;
        course.Year = request.Year;
        course.Description = request.Description;
        course.StartLineSource = ParseLineSource(request.StartLineSource);
        course.StartMark1Id = request.StartMark1Id;
        course.StartMark2Id = request.StartMark2Id;
        course.FinishLineSource = ParseLineSource(request.FinishLineSource);
        course.FinishMark1Id = request.FinishMark1Id;
        course.FinishMark2Id = request.FinishMark2Id;
        db.CourseLegs.RemoveRange(course.Legs);
        course.Legs.Clear();
        for (var i = 0; i < request.Legs.Count; i++)
        {
            var leg = request.Legs[i];
            course.Legs.Add(BuildLeg(leg, i + 1));
        }
        await db.SaveChangesAsync(ct);

        await legAnalysis.ReanalyzeRacesByCourseAsync(course.Id, ct);

        var updated = await db.Courses
            .Include(c => c.Legs.OrderBy(l => l.SortOrder))
                .ThenInclude(l => l.Mark)
            .Include(c => c.Legs)
                .ThenInclude(l => l.GateMark)
            .FirstAsync(c => c.Id == course.Id, ct);
        return Ok(MapToDto(updated));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var userId = currentUser.UserId;
        var course = await db.Courses.FirstOrDefaultAsync(c => c.Id == id && c.OwnerUserId == userId, ct);
        if (course is null) return NotFound();
        db.Courses.Remove(course);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static (HashSet<Guid> Ids, string? Error) CollectAndValidateMarkIds(
        List<CourseLegRequest> legs,
        Guid? startMark1, Guid? startMark2,
        Guid? finishMark1, Guid? finishMark2)
    {
        var ids = new HashSet<Guid>();
        foreach (var leg in legs)
        {
            ids.Add(leg.MarkId);
            var legType = ParseLegType(leg.LegType);
            if (legType == LegType.Gate)
            {
                if (leg.GateMarkId is null) return (ids, "Gate legs require a second mark (GateMarkId).");
                ids.Add(leg.GateMarkId.Value);
            }
        }
        if (startMark1.HasValue) ids.Add(startMark1.Value);
        if (startMark2.HasValue) ids.Add(startMark2.Value);
        if (finishMark1.HasValue) ids.Add(finishMark1.Value);
        if (finishMark2.HasValue) ids.Add(finishMark2.Value);
        return (ids, null);
    }

    private static CourseLeg BuildLeg(CourseLegRequest leg, int sortOrder)
    {
        var legType = ParseLegType(leg.LegType);
        return new CourseLeg
        {
            MarkId = leg.MarkId,
            GateMarkId = legType == LegType.Gate ? leg.GateMarkId : null,
            SortOrder = sortOrder,
            LegName = leg.LegName,
            OverrideRoundingRadiusMeters = leg.OverrideRoundingRadiusMeters,
            LegType = legType,
            PassingSide = ParsePassingSide(leg.PassingSide),
        };
    }

    private static LegType ParseLegType(string? value) =>
        Enum.TryParse<LegType>(value, ignoreCase: true, out var t) ? t : LegType.Mark;

    private static PassingSide ParsePassingSide(string? value) =>
        Enum.TryParse<PassingSide>(value, ignoreCase: true, out var s) ? s : PassingSide.Port;

    private static LineSource ParseLineSource(string? value) =>
        Enum.TryParse<LineSource>(value, ignoreCase: true, out var s) ? s : LineSource.Device;

    private static CourseDto MapToDto(Course course)
    {
        var orderedLegs = course.Legs.OrderBy(l => l.SortOrder).ToList();
        var totalLengthMeters = 0.0;
        for (var i = 1; i < orderedLegs.Count; i++)
        {
            totalLengthMeters += GeoHelper.HaversineMeters(
                orderedLegs[i - 1].Mark.Latitude, orderedLegs[i - 1].Mark.Longitude,
                orderedLegs[i].Mark.Latitude, orderedLegs[i].Mark.Longitude);
        }
        return new CourseDto(
            course.Id, course.Name, course.Year, course.Description, course.CreatedAt, totalLengthMeters,
            course.StartLineSource.ToString(),
            course.StartMark1Id, course.StartMark2Id,
            course.FinishLineSource.ToString(),
            course.FinishMark1Id, course.FinishMark2Id,
            [.. orderedLegs.Select(l => new CourseLegDto(
                l.Id, l.MarkId, l.Mark.Name,
                l.GateMarkId, l.GateMark?.Name,
                l.SortOrder, l.LegName, l.OverrideRoundingRadiusMeters,
                l.LegType.ToString(), l.PassingSide.ToString(),
                l.Mark.Latitude, l.Mark.Longitude,
                l.GateMark?.Latitude, l.GateMark?.Longitude))]
        );
    }
}
