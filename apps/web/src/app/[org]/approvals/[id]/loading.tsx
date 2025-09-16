import { Card, Skeleton } from '@/components/ui/primitives';

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:px-10">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-7 w-1/2" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="h-80" />
        <div className="flex flex-col gap-4">
          <Card className="h-40" />
          <Card className="h-32" />
        </div>
      </div>
    </div>
  );
}
