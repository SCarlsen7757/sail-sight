namespace SailSight.Shared.Dtos.BoatClasses;

/// <summary>
/// Boat class. All measurements are in SI units: length and width in metres, weight in kg.
/// </summary>
public record BoatClassDto(
    Guid Id,
    string Name,
    double? Length,
    double? Width,
    double? Weight,
    int BoatCount = 0);
