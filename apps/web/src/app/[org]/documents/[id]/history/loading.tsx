import { Skeleton } from '@/components/ui/primitives';

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-10" aria-busy="true">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-3 h-7 w-56" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
        <div className="rounded-lg border border-line bg-surface p-8">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="mt-6 h-4 w-full" />
          <Skeleton className="mt-3 h-4 w-5/6" />
          <Skeleton className="mt-3 h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}
