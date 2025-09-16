import { Skeleton } from '@/components/ui/primitives';

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-10" aria-busy>
      <Skeleton className="h-7 w-40" />
      <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      <Skeleton className="mt-5 h-12" />
      <Skeleton className="mt-5 h-28" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    </div>
  );
}
