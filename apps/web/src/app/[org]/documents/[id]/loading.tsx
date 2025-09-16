import { Skeleton } from '@/components/ui/primitives';

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-10" aria-busy="true">
      <Skeleton className="h-4 w-64 max-w-full" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="rounded-lg border border-line bg-surface px-5 py-8 sm:px-10">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="mt-3 h-3 w-32" />
          <div className="mt-8 flex flex-col gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="mt-4 h-5 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
