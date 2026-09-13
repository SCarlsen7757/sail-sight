namespace SailSight.Shared.Dtos.Boats;

public record CreateBoatRequest(string Name,
                                string? SailNumber,
                                Guid BoatClassId,
                                string? Description,
                                bool? IsPublic);
