'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { createProjectDocumentAction } from '@/actions/projects';
import { Button } from '@/components/ui/button';
import { useAction } from '@/lib/use-action';

/** Creates an empty document in this project and opens it for editing. */
export function NewDocumentButton({ org, projectId }: { org: string; projectId: string }) {
  const t = useTranslations('projects');
  const router = useRouter();
  const { call, pending } = useAction();
  return (
    <Button
      size="xs"
      loading={pending}
      onClick={async () => {
        const res = await call(() => createProjectDocumentAction(org, { projectId }), { refresh: false });
        if (res.ok) router.push(`/${org}/documents/${res.data.id}`);
      }}
    >
      <Plus /> {t('documents.new')}
    </Button>
  );
}
