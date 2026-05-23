using System.Collections.Concurrent;
using System.Threading.Channels;

namespace SailSight.Api.Services;

/// <summary>
/// Singleton bus for pushing server-sent notification updates to connected clients.
/// </summary>
public sealed class NotificationBus
{
    private readonly ConcurrentDictionary<Guid, Channel<byte>> _channels = new();

    /// <summary>Subscribes a user to the bus and returns a reader they can await.</summary>
    public ChannelReader<byte> Subscribe(Guid userId)
    {
        var channel = Channel.CreateUnbounded<byte>(new UnboundedChannelOptions { SingleReader = true });
        _channels[userId] = channel;
        return channel.Reader;
    }

    /// <summary>Unsubscribes a user and completes their channel.</summary>
    public void Unsubscribe(Guid userId)
    {
        if (_channels.TryRemove(userId, out var channel))
            channel.Writer.TryComplete();
    }

    /// <summary>Pushes a notification update to a specific user if they are connected.</summary>
    public void Notify(Guid userId)
    {
        if (_channels.TryGetValue(userId, out var channel))
            channel.Writer.TryWrite(0);
    }

    /// <summary>Pushes a notification update to all currently connected users.</summary>
    public void NotifyAll()
    {
        foreach (var channel in _channels.Values)
            channel.Writer.TryWrite(0);
    }
}
