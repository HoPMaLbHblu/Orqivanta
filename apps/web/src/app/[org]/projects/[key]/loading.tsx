import { Skeleton } from '@/components/ui/primitives';

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] px-4 pt-6 sm:px-6 lg:px-10">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-7 w-72" />
      <Skeleton className="mt-3 h-6 w-48" />
      <Skeleton className="mt-5 h-9 w-full" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-56" />
          <Skeleton className="h-40" />
        </div>
        <div className="flex flex-col gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-32" />
        </div>
      </div>
    </div>
  );
}
