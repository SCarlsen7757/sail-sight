namespace SailSight.Api.Services;

public sealed class IngestionLimits
{
    public const long FileBytes = 200_000_000;
    public const long RequestBytes = FileBytes + 1_048_576;
    public int GlobalConcurrency { get; set; } = 2;
    public int Records { get; set; } = 5_000_000;
    public int Races { get; set; } = 10_000;
    public int UploadsPerHour { get; set; } = 20;
}

// Single API instance admission control. The lock makes user/global admission atomic.
public sealed class IngestionGate(IngestionLimits limits)
{
    private readonly HashSet<Guid> active = [];
    public IDisposable? TryEnter(Guid user)
    {
        lock (active)
        {
            if (active.Contains(user) || active.Count >= limits.GlobalConcurrency) return null;
            active.Add(user);
            return new Lease(() => { lock (active) active.Remove(user); });
        }
    }
    private sealed class Lease(Action release) : IDisposable
    {
        private Action? action = release;
        public void Dispose() => Interlocked.Exchange(ref action, null)?.Invoke();
    }
}
