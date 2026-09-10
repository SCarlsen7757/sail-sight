using SailSight.Api.Helpers;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SailSight.Api.Auth;
using SailSight.Api.Data;
using SailSight.Api.Models.Entities;
using SailSight.Shared.Dtos.BoatClasses;

namespace SailSight.Api.Controllers;

[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/boat-classes")]
public class BoatClassesController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<List<BoatClassDto>>> GetAll(CancellationToken ct)
    {
        var classes = await db.BoatClasses
            .OrderBy(bc => bc.Name).ThenBy(bc => bc.Id)
            .Select(bc => new BoatClassDto(bc.Id, bc.Name, bc.Length, bc.Width, bc.Weight,
                db.Boats.Count(b => b.BoatClassId == bc.Id && b.IsPublic)))
            .PageAsync(HttpContext, ct);
        return Ok(classes);
    }

    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    public async Task<ActionResult<BoatClassDto>> GetById(Guid id, CancellationToken ct)
    {
        var boatClass = await db.BoatClasses
            .Where(bc => bc.Id == id)
            .Select(bc => new BoatClassDto(bc.Id, bc.Name, bc.Length, bc.Width, bc.Weight))
            .FirstOrDefaultAsync(ct);
        if (boatClass is null) return NotFound();
        return Ok(boatClass);
    }

    [HttpPost]
    [Authorize(Roles = AuthConstants.AdminRole)]
    public async Task<ActionResult<BoatClassDto>> Create(CreateBoatClassRequest request, CancellationToken ct)
    {
        var boatClass = new BoatClass
        {
            Name = request.Name,
            Length = request.Length,
            Width = request.Width,
            Weight = request.Weight,
        };
        db.BoatClasses.Add(boatClass);
        await db.SaveChangesAsync(ct);
        var dto = new BoatClassDto(boatClass.Id, boatClass.Name, boatClass.Length, boatClass.Width, boatClass.Weight);
        return CreatedAtAction(nameof(GetById), new { id = boatClass.Id }, dto);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = AuthConstants.AdminRole)]
    public async Task<ActionResult<BoatClassDto>> Update(Guid id, UpdateBoatClassRequest request, CancellationToken ct)
    {
        var boatClass = await db.BoatClasses.FindAsync([id], ct);
        if (boatClass is null) return NotFound();
        boatClass.Name = request.Name;
        boatClass.Length = request.Length;
        boatClass.Width = request.Width;
        boatClass.Weight = request.Weight;
        await db.SaveChangesAsync(ct);
        return Ok(new BoatClassDto(boatClass.Id, boatClass.Name, boatClass.Length, boatClass.Width, boatClass.Weight));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = AuthConstants.AdminRole)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var boatClass = await db.BoatClasses.FindAsync([id], ct);
        if (boatClass is null) return NotFound();
        var isReferenced = await db.Boats.AnyAsync(b => b.BoatClassId == id, ct);
        if (isReferenced)
            return Conflict(new { message = "Cannot delete boat class; it is referenced by one or more boats." });
        db.BoatClasses.Remove(boatClass);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
