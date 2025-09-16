export const ONBOARDING_STEPS = ['organization', 'template', 'teammates', 'project'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** Checklist keys stored on the organization (core's ONBOARDING_STEPS plus the org itself). */
export const STEP_FLAG: Record<OnboardingStep, string | null> = {
  organization: null,
  template: 'template',
  teammates: 'invite',
  project: 'project',
};

export function suggestKey(name: string) {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  const key = words.length > 1 ? words.map((w) => w[0]).join('') : (words[0] ?? 'PRJ');
  return (key.length >= 2 ? key : (words[0] ?? 'PRJ')).slice(0, 4).padEnd(2, 'X');
}
