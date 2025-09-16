import { Skeleton } from '@/components/ui/primitives';

export default function PortalLoading() {
  return (
    <div className="mx-auto max-w-[1120px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14" aria-busy>
      <Skeleton className="h-10 w-72" />
      <Skeleton className="mt-4 h-5 w-96" />
      <Skeleton className="mt-10 h-24 w-full rounded-xl" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}
