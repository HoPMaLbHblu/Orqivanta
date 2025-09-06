import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { config } from '@orqivanta/core';
import { DEMO_PERSONAS, DEMO_SWITCHER } from '@orqivanta/core/demo';
import { AuthHeading } from '@/components/auth-forms';
import { DemoPersonaButton } from '@/components/demo-persona-button';
import { Notice } from '@/components/ui/primitives';
import { AlertTriangle } from 'lucide-react';

export async function generateMetadata() {
  const t = await getTranslations('auth.demo');
  return { title: t('title') };
}

export default async function DemoPage() {
  if (!config.demoMode) notFound();
  const t = await getTranslations('auth.demo');
  const people = DEMO_SWITCHER.map((s) => ({ ...s, person: DEMO_PERSONAS.find((p) => p.key === s.key)! }));
  return (
    <>
      <AuthHeading title={t('title')} subtitle={t('subtitle')} />
      <div className="flex flex-col gap-3">
        {people.map((p) => (
          <DemoPersonaButton key={p.key} personaKey={p.key} name={p.person.name} title={t(`roles.${p.key}.label`)} description={t(`roles.${p.key}.description`)} color={p.person.color} />
        ))}
      </div>
      <Notice tone="attention" icon={<AlertTriangle />} className="mt-6">
        {t('disclaimer')}
      </Notice>
    </>
  );
}
