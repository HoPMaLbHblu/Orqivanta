'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from './button';
import { Dialog, DialogContent, DialogFooter } from './dialog';

/**
 * Destructive confirmation. The action runs inside the dialog so the button can show
 * progress, and the dialog only closes when the action succeeds.
 */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm, tone = 'danger', children }: { open: boolean; onOpenChange: (open: boolean) => void; title: ReactNode; description?: ReactNode; confirmLabel: string; onConfirm: () => Promise<boolean | void> | boolean | void; tone?: 'danger' | 'primary'; children?: ReactNode }) {
  const t = useTranslations('common');
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent title={title} description={description} size="sm">
        {children}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('cancel')}
          </Button>
          <Button
            variant={tone}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const ok = await onConfirm();
                if (ok !== false) onOpenChange(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
