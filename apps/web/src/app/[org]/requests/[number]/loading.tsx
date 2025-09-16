import { Card, Skeleton } from '@/components/ui/primitives';

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-10">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-5 w-32" />
      <Skeleton className="mt-2 h-7 w-2/3" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="h-64" />
        <div className="flex flex-col gap-4">
          <Card className="h-32" />
          <Card className="h-48" />
        </div>
      </div>
      <Skeleton className="mt-6 h-4 w-40" />
    </div>
  );
}
