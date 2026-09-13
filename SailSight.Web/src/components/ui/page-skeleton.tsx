export function PageSkeleton() {
  return (
    <div className="shimmer-container flex flex-col gap-4 pt-2">
      <div className="shimmer h-4 w-1/4 rounded" />
      <div className="shimmer h-4 w-3/4 rounded" />
      <div className="shimmer h-4 w-1/2 rounded" />
      <div className="shimmer h-4 w-5/6 rounded" />
      <div className="shimmer h-4 w-2/3 rounded" />
    </div>
  );
}
