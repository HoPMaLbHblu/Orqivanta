'use client';

import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { demoSignInAction } from '@/actions/auth';
import { Avatar } from '@/components/domain/avatar';
import { Spinner } from '@/components/ui/spinner';
import { useAction } from '@/lib/use-action';

export function DemoPersonaButton({ personaKey, name, title, description, color }: { personaKey: string; name: string; title: string; description: string; color: string }) {
  const router = useRouter();
  const { call, pending } = useAction();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        const res = await call(() => demoSignInAction(personaKey), { refresh: false });
        if (res.ok) {
          router.push(res.data.to);
          router.refresh();
        }
      }}
      className="group flex w-full items-center gap-4 rounded-lg border border-line bg-surface p-4 text-left transition-colors hover:border-accent/50 hover:bg-accent-soft/40 disabled:opacity-60"
    >
      <Avatar name={name} color={color} size="lg" title="" />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium text-ink">
          {title} <span className="font-normal text-ink-3">· {name}</span>
        </span>
        <span className="mt-0.5 block text-[13px] text-ink-2">{description}</span>
      </span>
      {pending ? <Spinner /> : <ArrowRight className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />}
    </button>
  );
}
