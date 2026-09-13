namespace SailSight.Shared.Dtos.Races;

/// <summary>
/// Computed result of the race start line crossing analysis.
/// Null on RaceDetailDto when no start line data is available.
/// </summary>
/// <param name="CrossedAt">Time of the last start line crossing in the analysis window.</param>
/// <param name="TimeBiasSeconds">
/// Seconds relative to the start gun for the last valid crossing <b>at or after</b> the gun.
/// Null when no such crossing exists in the window (e.g. the boat was OCS and never restarted,
/// or the boat crossed early and returned but did not start again before the window closed).
/// </param>
/// <param name="SpeedAtCrossingMs">Speed over ground at the last crossing in m/s.</param>
/// <param name="ApproachCourseDegrees">Course over ground at the last crossing in degrees.</param>
/// <param name="LineFraction">Position along the line: 0 = committee boat end, 1 = pin end.</param>
/// <param name="IsOcs">
/// True if the boat crossed the start line in the valid direction before the start gun
/// (regardless of whether it subsequently cleared the OCS).
/// </param>
/// <param name="IsOcsCleared">
/// Only meaningful when <see cref="IsOcs"/> is true.
/// True if the boat returned to the pre-start side of the line before the start gun
/// (by any path — through the line or around either end), clearing the OCS.
/// </param>
/// <param name="OcsTimeBiasSeconds">
/// Only set when <see cref="IsOcs"/> is true.
/// Seconds relative to the start gun for the <b>last</b> valid crossing that occurred
/// before the gun (i.e. the OCS crossing time). Always negative.
/// </param>
public record StartAnalysisDto(
    DateTimeOffset CrossedAt,
    double? TimeBiasSeconds,
    float SpeedAtCrossingMs,
    float ApproachCourseDegrees,
    double LineFraction,
    bool IsOcs,
    bool IsOcsCleared,
    double? OcsTimeBiasSeconds);
