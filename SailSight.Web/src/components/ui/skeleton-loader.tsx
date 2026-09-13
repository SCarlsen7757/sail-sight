import { cn } from "@/lib/cn";

export function SkeletonLoader({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded", className)} />;
}
