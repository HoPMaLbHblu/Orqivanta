import { Skeleton } from '@/components/ui/primitives';

export default function Loading() {
  return (
    <div className="mx-auto max-w-[880px] px-4 py-8 sm:px-6 lg:px-10" aria-busy>
      <Skeleton className="h-7 w-32" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      <div className="mt-6 flex gap-2">
        <Skeleton className="h-8 w-56" />
      </div>
      <Skeleton className="mt-8 h-3 w-20" />
      <div className="mt-2 space-y-px overflow-hidden rounded-lg border border-line">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-none" />
        ))}
      </div>
    </div>
  );
}
