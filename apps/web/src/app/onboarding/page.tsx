import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getOrganization, listMyOrgs, ORG_PURPOSES, PROJECT_TEMPLATES } from '@orqivanta/core';
import { Logo } from '@/components/brand';
import { PreferenceSwitcher } from '@/components/preference-switcher';
import { Checklist, Wizard } from '@/components/onboarding/wizard';
import { ONBOARDING_STEPS, type OnboardingStep } from '@/components/onboarding/steps';
import { getActor, requireUser } from '@/lib/session';

export async function generateMetadata() {
  const t = await getTranslations('onboarding');
  return { title: t('title') };
}

/**
 * Resumable setup. The organization's onboarding list says which steps are done, so the
 * wizard can be left and picked up later from any device.
 */
export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ org?: string; step?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const t = await getTranslations('onboarding');
  const orgs = await listMyOrgs(user.id);

  const slug = sp.org && orgs.some((o) => o.slug === sp.org && o.role !== 'client') ? sp.org : null;
  const actor = slug ? await getActor(slug) : null;
  if (slug && !actor) redirect('/onboarding');
  const organization = actor ? await getOrganization(actor) : null;
  const done = organization?.onboarding ?? [];

  let step = (ONBOARDING_STEPS as readonly string[]).includes(sp.step ?? '') ? (sp.step as OnboardingStep) : null;
  if (!actor) step = 'organization';
  else if (!step) step = !done.includes('template') ? 'template' : !done.includes('invite') ? 'teammates' : 'project';
  if (step === 'organization' && actor) step = 'template';
  if (actor && done.includes('project') && !sp.step) redirect(`/${actor.orgSlug}`);

  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[900px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo />
          <PreferenceSwitcher />
        </div>
      </header>
      <main id="main" className="mx-auto max-w-[900px] px-4 py-10 sm:px-6">
        <p className="text-[12px] tracking-[0.14em] text-ink-3 uppercase">{t('eyebrow')}</p>
        <h1 className="mt-1 font-serif text-[34px] leading-tight text-ink">{t('title')}</h1>
        <p className="mt-1 max-w-xl text-[14px] text-ink-2">{t('intro')}</p>
        <div className="mt-8 grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12">
          <Checklist step={step} done={done} />
          <Wizard
            step={step}
            org={actor?.orgSlug ?? null}
            orgName={organization?.name ?? null}
            done={done}
            purposes={ORG_PURPOSES.map((p) => ({ id: p.id, label: p.label }))}
            templates={PROJECT_TEMPLATES.map((tpl) => ({ id: tpl.id, name: tpl.name, description: tpl.description }))}
          />
        </div>
        {orgs.length ? (
          <p className="mt-10 text-[13px] text-ink-3">
            {t('alreadyHave')}{' '}
            <a href={`/${orgs[0]!.slug}`} className="font-medium text-accent hover:underline">
              {t('goToWorkspace', { name: orgs[0]!.name })}
            </a>
          </p>
        ) : null}
      </main>
    </div>
  );
}
