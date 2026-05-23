namespace SailSight.Shared.Dtos.BoatClasses;

/// <summary>
/// Slim summary of a boat class for embedding in boat responses.
/// All measurements are in SI units: length and width in metres, weight in kg.
/// </summary>
public record BoatClassSummaryDto(
    Guid Id,
    string Name,
    double? Length,
    double? Width,
    double? Weight);
