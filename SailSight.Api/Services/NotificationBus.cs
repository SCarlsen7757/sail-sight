using System.Collections.Concurrent;
using System.Threading.Channels;

namespace SailSight.Api.Services;

/// <summary>
/// Singleton bus for pushing server-sent notification updates to connected clients.
/// </summary>
public sealed class NotificationBus
{
    private readonly ConcurrentDictionary<(Guid UserId, ChannelReader<byte> Reader), Channel<byte>> _channels = new();

    /// <summary>Subscribes a user to the bus and returns a reader they can await.</summary>
    public ChannelReader<byte> Subscribe(Guid userId)
    {
        var channel = Channel.CreateBounded<byte>(new BoundedChannelOptions(1) { SingleReader = true, FullMode = BoundedChannelFullMode.DropOldest });
        _channels[(userId, channel.Reader)] = channel;
        return channel.Reader;
    }

    /// <summary>Unsubscribes a user and completes their channel.</summary>
    public void Unsubscribe(Guid userId, ChannelReader<byte> reader)
    {
        if (_channels.TryRemove((userId, reader), out var channel))
            channel.Writer.TryComplete();
    }

    /// <summary>Pushes a notification update to a specific user if they are connected.</summary>
    public void Notify(Guid userId)
    {
        foreach (var entry in _channels)
            if (entry.Key.UserId == userId) entry.Value.Writer.TryWrite(0);
    }

    /// <summary>Pushes a notification update to all currently connected users.</summary>
    public void NotifyAll()
    {
        foreach (var channel in _channels.Values)
            channel.Writer.TryWrite(0);
    }
}
