using SailSight.Api.Helpers;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SailSight.Api.Auth;
using SailSight.Api.Data;
using SailSight.Api.Models.Entities;
using SailSight.Shared.Dtos.BoatClasses;

using SailSight.Api.Services;

namespace SailSight.Api.Controllers;

[ApiVersion("1.0")]
[ApiController]
[Authorize(Roles = AuthConstants.AdminRole)]
[Route("api/v{version:apiVersion}/admin/boat-class-requests")]
public class AdminBoatClassRequestsController(AppDbContext db, ICurrentUser currentUser, NotificationBus notificationBus) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<BoatClassRequestDto>>> GetPending(CancellationToken ct)
    {
        var requests = await db.BoatClassRequests
            .Where(r => r.Status == BoatClassRequestStatus.Pending)
            .OrderBy(r => r.CreatedAt).ThenBy(r => r.Id)
            .Select(r => new BoatClassRequestDto(
                r.Id, r.RequestedByUserId, r.RequestedByUser.Email!,
                r.Name, r.Length, r.Width, r.Weight, r.Notes,
                r.Status.ToString(), r.CreatedAt, r.ReviewedAt))
            .PageAsync(HttpContext, ct);
        return Ok(requests);
    }

    [HttpPost("{id:guid}/approve")]
    public async Task<ActionResult<BoatClassDto>> Approve(Guid id, CancellationToken ct)
    {
        var adminId = currentUser.UserId;
        var request = await db.BoatClassRequests.FindAsync([id], ct);
        if (request is null) return NotFound();
        if (request.Status != BoatClassRequestStatus.Pending)
            return BadRequest(new { error = "request_already_reviewed" });

        var boatClass = new BoatClass
        {
            Name = request.Name,
            Length = request.Length,
            Width = request.Width,
            Weight = request.Weight,
        };
        db.BoatClasses.Add(boatClass);

        request.Status = BoatClassRequestStatus.Approved;
        request.ReviewedByUserId = adminId;
        request.ReviewedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        notificationBus.Notify(request.RequestedByUserId);
        notificationBus.NotifyAll();

        return Ok(new BoatClassDto(boatClass.Id, boatClass.Name, boatClass.Length, boatClass.Width, boatClass.Weight));
    }

    [HttpPost("{id:guid}/reject")]
    public async Task<IActionResult> Reject(Guid id, CancellationToken ct)
    {
        var adminId = currentUser.UserId;
        var request = await db.BoatClassRequests.FindAsync([id], ct);
        if (request is null) return NotFound();
        if (request.Status != BoatClassRequestStatus.Pending)
            return BadRequest(new { error = "request_already_reviewed" });

        request.Status = BoatClassRequestStatus.Rejected;
        request.ReviewedByUserId = adminId;
        request.ReviewedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        notificationBus.Notify(request.RequestedByUserId);
        notificationBus.NotifyAll();
        return NoContent();
    }
}
