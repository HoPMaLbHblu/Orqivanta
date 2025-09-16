import { Skeleton } from '@/components/ui/primitives';

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-10" aria-busy="true">
      <Skeleton className="h-4 w-56" />
      <Skeleton className="mt-3 h-6 w-72 max-w-full" />
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Skeleton className="h-[50vh] w-full rounded-lg" />
        <div className="flex flex-col gap-5">
          <Skeleton className="h-44 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
