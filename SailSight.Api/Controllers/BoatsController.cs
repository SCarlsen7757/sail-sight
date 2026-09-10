using SailSight.Api.Helpers;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SailSight.Api.Auth;
using SailSight.Api.Data;
using SailSight.Api.Models.Entities;
using SailSight.Shared.Dtos.BoatClasses;
using SailSight.Shared.Dtos.Boats;

namespace SailSight.Api.Controllers;

[ApiVersion("1.0")]
[ApiController]
[Authorize]
[Route("api/v{version:apiVersion}/[controller]")]
public class BoatsController(AppDbContext db, ICurrentUser currentUser) : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<List<BoatDto>>> GetAll(CancellationToken ct)
    {
        if (!currentUser.IsAuthenticated)
        {
            var publicBoats = await db.Boats
                .Where(b => b.IsPublic)
                .OrderBy(b => b.Name).ThenBy(b => b.Id)
                .Select(b => new BoatDto(
                    b.Id, b.Name, b.SailNumber,
                    new BoatClassSummaryDto(b.BoatClass.Id, b.BoatClass.Name, b.BoatClass.Length, b.BoatClass.Width, b.BoatClass.Weight),
                    b.Description, b.IsPublic, b.CreatedAt))
                .PageAsync(HttpContext, ct);
            return Ok(publicBoats);
        }

        var userId = currentUser.UserId;
        var boats = await db.Boats
            .Where(b => b.OwnerUserId == userId)
            .OrderBy(b => b.Name).ThenBy(b => b.Id)
            .Select(b => new BoatDto(
                b.Id, b.Name, b.SailNumber,
                new BoatClassSummaryDto(b.BoatClass.Id, b.BoatClass.Name, b.BoatClass.Length, b.BoatClass.Width, b.BoatClass.Weight),
                b.Description, b.IsPublic, b.CreatedAt))
            .PageAsync(HttpContext, ct);
        return Ok(boats);
    }

    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    public async Task<ActionResult<BoatDto>> GetById(Guid id, CancellationToken ct)
    {
        var userId = currentUser.IsAuthenticated ? currentUser.UserId : (Guid?)null;
        var dto = await db.Boats
            .Where(b => b.Id == id && (b.IsPublic || (userId.HasValue && b.OwnerUserId == userId.Value)))
            .Select(b => new BoatDto(
                b.Id, b.Name, b.SailNumber,
                new BoatClassSummaryDto(b.BoatClass.Id, b.BoatClass.Name, b.BoatClass.Length, b.BoatClass.Width, b.BoatClass.Weight),
                b.Description, b.IsPublic, b.CreatedAt))
            .FirstOrDefaultAsync(ct);
        if (dto is null) return NotFound();
        return Ok(dto);
    }

    [HttpPost]
    public async Task<ActionResult<BoatDto>> Create(CreateBoatRequest request, CancellationToken ct)
    {
        var userId = currentUser.UserId;
        // Ensure the boat class exists (now site-wide, not per-user).
        var classExists = await db.BoatClasses.AnyAsync(bc => bc.Id == request.BoatClassId, ct);
        if (!classExists) return BadRequest(new { message = "Unknown boat class." });

        var boat = new Boat
        {
            OwnerUserId = userId,
            Name = request.Name,
            SailNumber = request.SailNumber,
            BoatClassId = request.BoatClassId,
            Description = request.Description,
            IsPublic = request.IsPublic ?? false,
        };
        db.Boats.Add(boat);
        await db.SaveChangesAsync(ct);

        var dto = await db.Boats
            .Where(b => b.Id == boat.Id)
            .Select(b => new BoatDto(
                b.Id, b.Name, b.SailNumber,
                new BoatClassSummaryDto(b.BoatClass.Id, b.BoatClass.Name, b.BoatClass.Length, b.BoatClass.Width, b.BoatClass.Weight),
                b.Description, b.IsPublic, b.CreatedAt))
            .FirstAsync(ct);
        return CreatedAtAction(nameof(GetById), new { id = boat.Id }, dto);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<BoatDto>> Update(Guid id, UpdateBoatRequest request, CancellationToken ct)
    {
        var userId = currentUser.UserId;
        var boat = await db.Boats.FirstOrDefaultAsync(b => b.Id == id && b.OwnerUserId == userId, ct);
        if (boat is null) return NotFound();

        var classExists = await db.BoatClasses.AnyAsync(bc => bc.Id == request.BoatClassId, ct);
        if (!classExists) return BadRequest(new { message = "Unknown boat class." });

        boat.Name = request.Name;
        boat.SailNumber = request.SailNumber;
        boat.BoatClassId = request.BoatClassId;
        boat.Description = request.Description;
        if (request.IsPublic.HasValue) boat.IsPublic = request.IsPublic.Value;
        await db.SaveChangesAsync(ct);

        var dto = await db.Boats
            .Where(b => b.Id == id)
            .Select(b => new BoatDto(
                b.Id, b.Name, b.SailNumber,
                new BoatClassSummaryDto(b.BoatClass.Id, b.BoatClass.Name, b.BoatClass.Length, b.BoatClass.Width, b.BoatClass.Weight),
                b.Description, b.IsPublic, b.CreatedAt))
            .FirstAsync(ct);
        return Ok(dto);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var userId = currentUser.UserId;
        var boat = await db.Boats.FirstOrDefaultAsync(b => b.Id == id && b.OwnerUserId == userId, ct);
        if (boat is null) return NotFound();
        db.Boats.Remove(boat);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("{id:guid}/stats")]
    [AllowAnonymous]
    [EndpointSummary("Aggregate statistics for a boat across all its sessions and races.")]
    public async Task<ActionResult<BoatStatsDto>> GetStats(Guid id, CancellationToken ct)
    {
        var userId = currentUser.IsAuthenticated ? currentUser.UserId : (Guid?)null;
        var isOwner = userId.HasValue && await db.Boats.AnyAsync(b => b.Id == id && b.OwnerUserId == userId.Value, ct);

        var boat = await db.Boats
            .Include(b => b.BoatClass)
            .Where(b => b.Id == id && (b.IsPublic || (userId.HasValue && b.OwnerUserId == userId.Value)))
            .FirstOrDefaultAsync(ct);
        if (boat is null) return NotFound();

        var sessions = db.Sessions.Where(s => s.BoatId == id && (isOwner || s.IsPublic));
        var races = db.Races.Where(r => sessions.Select(s => s.Id).Contains(r.SessionId));
        var sessionCount = await sessions.CountAsync(ct);
        var raceCount = await races.CountAsync(ct);
        var dto = new BoatStatsDto(
            boat.Id, boat.Name, boat.SailNumber,
            new BoatClassSummaryDto(boat.BoatClass.Id, boat.BoatClass.Name, boat.BoatClass.Length, boat.BoatClass.Width, boat.BoatClass.Weight),
            sessionCount, raceCount,
            await sessions.SumAsync(s => (s.EndedAt - s.StartedAt).TotalSeconds, ct),
            await races.Where(r => r.EndedAt.HasValue).SumAsync(r => (r.EndedAt!.Value - r.StartedAt).TotalSeconds, ct),
            await races.Where(r => r.EndedAt.HasValue).SumAsync(r => r.SailedDistanceMeters, ct),
            raceCount > 0 ? await races.MaxAsync(r => r.MaxSpeedOverGround, ct) : 0f);
        return Ok(dto);
    }
}
