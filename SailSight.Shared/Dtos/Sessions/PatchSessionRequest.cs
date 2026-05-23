namespace SailSight.Shared.Dtos.Sessions;

public record PatchSessionRequest(Guid? BoatId, Guid? CourseId, string? Notes, bool? IsPublic, string? DisplayName);
