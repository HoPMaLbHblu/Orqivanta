export const NAMED_COLORS = ['verdigris', 'amber', 'plum', 'ocean', 'moss', 'rose', 'slate', 'sand'] as const;
export type NamedColor = (typeof NAMED_COLORS)[number];

/** Background and text colour for a named palette entry; unknown names fall back to slate. */
export function toneStyle(color: string | null | undefined): React.CSSProperties {
  const c = NAMED_COLORS.includes(color as NamedColor) ? color : 'slate';
  return { background: `var(--c-${c})`, color: `var(--c-${c}-ink)` };
}

export function toneInk(color: string | null | undefined) {
  const c = NAMED_COLORS.includes(color as NamedColor) ? color : 'slate';
  return `var(--c-${c}-ink)`;
}
