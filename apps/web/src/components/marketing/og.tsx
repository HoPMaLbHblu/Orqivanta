import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

/** Instrument Serif, the headline face, loaded from the repo so images need no network. */
async function serif(): Promise<ArrayBuffer | null> {
  try {
    const buf = await readFile(path.join(process.cwd(), 'src/app/_og/InstrumentSerif-Regular.ttf'));
    return Uint8Array.from(buf).buffer;
  } catch {
    return null;
  }
}

/**
 * The shared social preview: paper background, the mark, a serif headline and one line of
 * context. No screenshots and no invented numbers.
 */
export async function renderOgImage({ title, subtitle, eyebrow = 'Orqivanta' }: { title: string; subtitle: string; eyebrow?: string }) {
  const font = await serif();
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#faf8f5',
          color: '#1c1a17',
          padding: '72px 80px',
          fontFamily: font ? 'Instrument Serif' : 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <svg width="52" height="52" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="15" fill="#0f6e64" />
            <path d="M9.5 19.5a7.5 7.5 0 1 1 13 .2" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
            <circle cx="16" cy="16" r="2.6" fill="#ffffff" />
          </svg>
          <span style={{ fontSize: 34, letterSpacing: '-0.01em' }}>{eyebrow}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 76, lineHeight: 1.05, letterSpacing: '-0.02em', maxWidth: 940 }}>{title}</div>
          <div style={{ marginTop: 28, fontSize: 28, lineHeight: 1.4, color: '#4a453e', maxWidth: 880, fontFamily: 'sans-serif' }}>{subtitle}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 64, height: 3, background: '#0f6e64' }} />
          <span style={{ fontSize: 22, color: '#6f685d', fontFamily: 'sans-serif' }}>A calm workspace for agencies and their clients</span>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: font ? [{ name: 'Instrument Serif', data: font, style: 'normal', weight: 400 }] : undefined,
    },
  );
}
