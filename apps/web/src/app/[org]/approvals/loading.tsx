import { Card, Skeleton } from '@/components/ui/primitives';

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:px-10">
      <Skeleton className="h-7 w-44" />
      <Skeleton className="mt-2 h-4 w-80" />
      <Skeleton className="mt-6 h-8 w-72" />
      <Card className="mt-4 divide-y divide-line">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </Card>
    </div>
  );
}
