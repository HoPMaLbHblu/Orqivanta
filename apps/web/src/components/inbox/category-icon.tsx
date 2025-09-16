import { AtSign, Bell, CalendarClock, CircleDot, Inbox, MessageSquare, Stamp, UserPlus, Users, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export const NOTIFICATION_CATEGORIES = ['assignment', 'mention', 'comment', 'status', 'approval', 'request', 'due', 'membership'] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

const ICONS: Record<NotificationCategory, LucideIcon> = {
  assignment: UserPlus,
  mention: AtSign,
  comment: MessageSquare,
  status: CircleDot,
  approval: Stamp,
  request: Inbox,
  due: CalendarClock,
  membership: Users,
};

export function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const Icon = ICONS[category as NotificationCategory] ?? Bell;
  return <Icon className={cn('size-4 shrink-0', className)} aria-hidden />;
}
