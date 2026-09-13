namespace SailSight.Shared.Dtos.BoatClasses;

public record UpdateBoatClassRequest(
    string Name,
    double? Length,
    double? Width,
    double? Weight);
