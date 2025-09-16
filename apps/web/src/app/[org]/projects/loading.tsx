import { Skeleton } from '@/components/ui/primitives';

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-10">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="mt-2 h-4 w-72" />
      <Skeleton className="mt-6 h-8 w-full max-w-xl" />
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    </div>
  );
}
