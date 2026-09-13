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
[Authorize]
[Route("api/v{version:apiVersion}/boat-classes/requests")]
public class BoatClassRequestsController(AppDbContext db, ICurrentUser currentUser, NotificationBus notificationBus) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<BoatClassRequestDto>> Create([FromBody] CreateBoatClassRequestRequest req, CancellationToken ct)
    {
        var userId = currentUser.UserId;
        var request = new BoatClassRequest
        {
            RequestedByUserId = userId,
            Name = req.Name,
            Length = req.Length,
            Width = req.Width,
            Weight = req.Weight,
            Notes = req.Notes,
        };
        db.BoatClassRequests.Add(request);
        await db.SaveChangesAsync(ct);
        notificationBus.NotifyAll();

        var email = await db.Users.Where(u => u.Id == userId).Select(u => u.Email!).FirstOrDefaultAsync(ct) ?? "";
        return CreatedAtAction(nameof(GetMine), null,
            new BoatClassRequestDto(request.Id, userId, email, request.Name,
                request.Length, request.Width, request.Weight, request.Notes,
                request.Status.ToString(), request.CreatedAt, request.ReviewedAt));
    }

    [HttpGet]
    public async Task<ActionResult<List<BoatClassRequestDto>>> GetMine(CancellationToken ct)
    {
        var userId = currentUser.UserId;
        var requests = await db.BoatClassRequests
            .Where(r => r.RequestedByUserId == userId)
            .OrderByDescending(r => r.CreatedAt).ThenBy(r => r.Id)
            .Select(r => new BoatClassRequestDto(
                r.Id, r.RequestedByUserId, r.RequestedByUser.Email!,
                r.Name, r.Length, r.Width, r.Weight, r.Notes,
                r.Status.ToString(), r.CreatedAt, r.ReviewedAt))
            .PageAsync(HttpContext, ct);
        return Ok(requests);
    }
}
