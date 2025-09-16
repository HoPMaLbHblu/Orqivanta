'use client';

import { useEffect } from 'react';

/**
 * Last-resort boundary: it replaces the root layout, so there is no theme, no fonts and
 * no translations here. Everything is inline and in English on purpose — this page has to
 * work when nothing else does.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[global error]', error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <title>Something broke · Orqivanta</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          background: '#faf8f5',
          color: '#1c1a17',
          fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          fontSize: 16,
          lineHeight: 1.6,
        }}
      >
        <main style={{ width: '100%', maxWidth: 640, margin: '0 auto', padding: '48px 16px' }}>
          <p style={{ margin: 0, fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6f685d' }}>Error 500</p>
          <h1 style={{ margin: '16px 0 0', fontSize: 40, lineHeight: 1.1, fontWeight: 400, fontFamily: "'Iowan Old Style', Georgia, serif" }}>Something broke on our side.</h1>
          <p style={{ margin: '20px 0 0', color: '#4a453e' }}>The problem has been logged. Try again — if it keeps happening, let us know what you were doing.</p>
          <div style={{ marginTop: 32, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <button
              type="button"
              onClick={reset}
              style={{ height: 44, padding: '0 20px', borderRadius: 10, border: '1px solid transparent', background: '#0f6e64', color: '#fff', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{ display: 'inline-flex', alignItems: 'center', height: 44, padding: '0 20px', borderRadius: 10, border: '1px solid #d3ccc1', background: '#fffdfa', color: '#1c1a17', fontSize: 15, fontWeight: 500, textDecoration: 'none' }}
            >
              Back to the home page
            </a>
          </div>
          {error.digest ? <p style={{ marginTop: 32, fontSize: 12, color: '#6f685d', fontFamily: 'ui-monospace, Menlo, monospace' }}>Reference {error.digest}</p> : null}
        </main>
      </body>
    </html>
  );
}
