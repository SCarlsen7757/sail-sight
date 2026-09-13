namespace SailSight.Api.Services;

public sealed class CancellableReadStream(Stream inner, CancellationToken token) : Stream
{
    public override bool CanRead => true;
    public override bool CanSeek => inner.CanSeek;
    public override bool CanWrite => false;
    public override long Length => inner.Length;
    public override long Position { get => inner.Position; set => inner.Position = value; }
    public override int Read(byte[] buffer, int offset, int count) { token.ThrowIfCancellationRequested(); return inner.Read(buffer, offset, count); }
    public override int Read(Span<byte> buffer) { token.ThrowIfCancellationRequested(); return inner.Read(buffer); }
    public override int ReadByte() { token.ThrowIfCancellationRequested(); return inner.ReadByte(); }
    public override long Seek(long offset, SeekOrigin origin) => inner.Seek(offset, origin);
    public override void Flush() => throw new NotSupportedException();
    public override void SetLength(long value) => throw new NotSupportedException();
    public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
}
