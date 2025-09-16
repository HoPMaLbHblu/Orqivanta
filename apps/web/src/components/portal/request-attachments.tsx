'use client';

import { useTranslations } from 'next-intl';
import { FileUploader } from '@/components/files/uploader';

/** Clients can attach files to their own request; the server checks access to the request. */
export function RequestAttachments({ org, requestId }: { org: string; requestId: string }) {
  const t = useTranslations('portal.requests');
  return <FileUploader compact endpoint={`/api/orgs/${org}/files`} meta={{ requestId }} label={t('attach')} />;
}
