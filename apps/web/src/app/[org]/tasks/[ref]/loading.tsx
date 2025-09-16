import { Skeleton } from '@/components/ui/primitives';

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 lg:px-10">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-4 h-8 w-2/3" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-24" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
