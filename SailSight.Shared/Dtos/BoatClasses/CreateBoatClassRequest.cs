namespace SailSight.Shared.Dtos.BoatClasses;

public record CreateBoatClassRequest(
    string Name,
    double? Length,
    double? Width,
    double? Weight);
