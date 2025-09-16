import { Skeleton } from '@/components/ui/primitives';

export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="overflow-hidden rounded-lg border border-line">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-none border-b border-line" />
        ))}
      </div>
    </div>
  );
}
