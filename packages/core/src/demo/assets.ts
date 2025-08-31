import sharp from 'sharp';

/**
 * Generated placeholder artwork for the sample workspace. Everything here is drawn at seed
 * time, so the demo ships no third-party images and nothing pretends to be real client work.
 */
export async function conceptImage(opts: { title: string; subtitle: string; bg: string; ink: string; accent: string; variant: number }) {
  const { title, subtitle, bg, ink, accent, variant } = opts;
  const blocks =
    variant === 1
      ? `<rect x="120" y="360" width="560" height="300" rx="6" fill="${accent}" opacity="0.85"/>
         <rect x="740" y="360" width="340" height="140" rx="6" fill="${ink}" opacity="0.08"/>
         <rect x="740" y="520" width="340" height="140" rx="6" fill="${ink}" opacity="0.08"/>`
      : `<circle cx="900" cy="470" r="190" fill="${accent}" opacity="0.85"/>
         <rect x="120" y="560" width="520" height="16" rx="8" fill="${ink}" opacity="0.15"/>
         <rect x="120" y="600" width="420" height="16" rx="8" fill="${ink}" opacity="0.15"/>
         <rect x="120" y="660" width="180" height="52" rx="26" fill="${ink}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <rect width="1200" height="800" fill="${bg}"/>
    <rect x="0" y="0" width="1200" height="72" fill="${ink}" opacity="0.06"/>
    <circle cx="70" cy="36" r="14" fill="${accent}"/>
    <rect x="980" y="26" width="160" height="20" rx="10" fill="${ink}" opacity="0.18"/>
    <text x="120" y="200" font-family="Georgia, serif" font-size="72" fill="${ink}">${escapeXml(title)}</text>
    <text x="120" y="270" font-family="Helvetica, Arial, sans-serif" font-size="28" fill="${ink}" opacity="0.65">${escapeXml(subtitle)}</text>
    ${blocks}
    <text x="1080" y="770" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="18" fill="${ink}" opacity="0.4">Sample data · generated placeholder</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

export async function logoSheet(opts: { name: string; colors: string[] }) {
  const marks = opts.colors
    .map(
      (c, i) => `<g transform="translate(${100 + i * 340}, 200)">
        <rect width="300" height="300" rx="24" fill="#FAF8F5" stroke="#1C1A17" stroke-opacity="0.1"/>
        <circle cx="150" cy="130" r="${60 + i * 10}" fill="${c}"/>
        <text x="150" y="260" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="#1C1A17">${escapeXml(opts.name)}</text>
      </g>`,
    )
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700">
    <rect width="1200" height="700" fill="#F2EFEA"/>
    <text x="100" y="120" font-family="Helvetica, Arial, sans-serif" font-size="32" fill="#1C1A17">Logo directions</text>
    ${marks}
    <text x="1100" y="660" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="18" fill="#1C1A17" opacity="0.4">Sample data · generated placeholder</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

/** A minimal, valid one-page PDF with a few lines of text. */
export function simplePdf(title: string, lines: string[]) {
  const esc = (s: string) => s.replace(/[\\()]/g, (m) => `\\${m}`).replace(/[^\x20-\x7e]/g, '-');
  const text = [`BT /F1 22 Tf 72 740 Td (${esc(title)}) Tj ET`, ...lines.map((l, i) => `BT /F1 12 Tf 72 ${700 - i * 20} Td (${esc(l)}) Tj ET`), 'BT /F1 9 Tf 72 60 Td (Sample data - generated placeholder) Tj ET'].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);
}
