using SailSight.Api.Models.Entities;
using Vakaros.Vkx.Parser;
using Vakaros.Vkx.Parser.Models;

namespace SailSight.Api.Services;

/// <summary>
/// Extracts numbered races from a parsed VKX session by pairing
/// RaceStart (event 3) and RaceEnd (event 4) timer events.
/// </summary>
public class RaceDetectionService
{
    /// <summary>
    /// Detects races from the race timer events in a parsed VKX session.
    /// </summary>
    /// <param name="session">The parsed VKX session.</param>
    /// <param name="sessionId">The database session ID to associate races with.</param>
    /// <returns>A list of detected <see cref="Race"/> entities numbered chronologically.</returns>
    public List<Race> DetectRaces(VkxSession session, Guid sessionId)
    {
        var races = new List<Race>();
        var events = session.RaceTimerEventRecords
            .OrderBy(e => e.Timestamp)
            .ToList();

        var state = RaceState.Idle;
        var raceNumber = 0;
        Race? currentRace = null;

        // Track the most recent countdown trigger (Start or Sync) so we can
        // record when the pre-race countdown procedure began.
        DateTimeOffset? countdownStart = null;
        int? countdownDuration = null;

        foreach (var evt in events)
        {
            switch (evt.EventType)
            {
                case TimerEventType.Start:
                case TimerEventType.Sync:
                    // Remember the latest countdown trigger; a Sync after a Start
                    // supersedes the earlier value (timer was re-synced).
                    countdownStart = evt.Timestamp;
                    countdownDuration = evt.TimerValue;
                    break;

                case TimerEventType.Reset:
                    // Timer was reset — discard any pending countdown info.
                    countdownStart = null;
                    countdownDuration = null;
                    break;

                case TimerEventType.RaceStart when state == RaceState.Idle:
                    state = RaceState.Racing;
                    raceNumber++;
                    currentRace = new Race
                    {
                        SessionId = sessionId,
                        RaceNumber = raceNumber,
                        CountdownStartedAt = countdownStart,
                        CountdownDurationSeconds = countdownDuration,
                        StartedAt = evt.Timestamp
                    };
                    races.Add(currentRace);

                    // Reset countdown state for the next race.
                    countdownStart = null;
                    countdownDuration = null;
                    break;

                case TimerEventType.RaceEnd when state == RaceState.Racing:
                    state = RaceState.Idle;
                    currentRace!.EndedAt = evt.Timestamp;
                    currentRace = null;
                    break;
            }
        }

        // If still racing at EOF, EndedAt remains null.
        return races;
    }

    private enum RaceState
    {
        Idle,
        Racing
    }
}
