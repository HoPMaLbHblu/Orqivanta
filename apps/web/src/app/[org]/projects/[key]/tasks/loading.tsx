import { Skeleton } from '@/components/ui/primitives';

export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-full max-w-2xl" />
      <div className="overflow-hidden rounded-lg border border-line">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="m-2 h-7" />
        ))}
      </div>
    </div>
  );
}
