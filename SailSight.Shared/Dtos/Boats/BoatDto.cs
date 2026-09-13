using SailSight.Shared.Dtos.BoatClasses;

namespace SailSight.Shared.Dtos.Boats;

public record BoatDto(Guid Id,
                      string Name,
                      string? SailNumber,
                      BoatClassSummaryDto BoatClass,
                      string? Description,
                      bool IsPublic,
                      DateTimeOffset CreatedAt);
