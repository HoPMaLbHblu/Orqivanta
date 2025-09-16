import { Skeleton } from '@/components/ui/primitives';

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-10" aria-busy="true">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      <div className="mt-6 flex gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-28" />
      </div>
      {[0, 1].map((g) => (
        <div key={g} className="mt-6 rounded-lg border border-line bg-surface">
          <div className="border-b border-line px-4 py-3">
            <Skeleton className="h-4 w-40" />
          </div>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="size-4" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
