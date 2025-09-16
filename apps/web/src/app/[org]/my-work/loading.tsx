import { Skeleton } from '@/components/ui/primitives';

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 sm:px-6 lg:px-10">
      <Skeleton className="h-7 w-36" />
      <Skeleton className="mt-2 h-4 w-64" />
      <Skeleton className="mt-6 h-8 w-80" />
      <div className="mt-4 overflow-hidden rounded-lg border border-line">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="m-2 h-7" />
        ))}
      </div>
    </div>
  );
}
