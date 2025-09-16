'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export interface Datum {
  key: string;
  label: string;
  value: number;
  /** Formatted value for labels and tooltips. */
  display: string;
  /** CSS colour (a token var); defaults to the accent. */
  color?: string;
}

function useWidth(initial: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setWidth(Math.max(240, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

/** "Nice" axis maximum and ticks for counts and durations. */
function niceTicks(max: number, count = 4) {
  if (max <= 0) return { top: 1, ticks: [0, 1] };
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return { top, ticks };
}

function Tip({ x, y, children, width }: { x: number; y: number; children: ReactNode; width: number }) {
  const left = Math.min(Math.max(x, 70), width - 70);
  return (
    <div role="presentation" className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-ink px-2 py-1 text-[12px] leading-snug whitespace-nowrap text-paper shadow-pop" style={{ left, top: y - 6 }}>
      {children}
    </div>
  );
}

/**
 * Vertical columns, e.g. tasks completed per week. Each column is focusable and announces
 * its label and value; the same numbers are always available in the table below the chart.
 */
export function ColumnChart({ data, title, xLabel, yLabel, height = 240 }: { data: Datum[]; title: string; xLabel: string; yLabel: string; height?: number }) {
  const { ref, width } = useWidth(720);
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();
  const m = { top: 16, right: 8, bottom: 44, left: 44 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;
  const { top, ticks } = niceTicks(Math.max(...data.map((d) => d.value), 0));
  const band = data.length ? w / data.length : w;
  const barW = Math.max(3, Math.min(36, band * 0.62));
  const y = (v: number) => m.top + h - (v / top) * h;
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.floor(w / 64)));
  const a = active !== null ? data[active] : null;

  return (
    <div ref={ref} className="relative w-full">
      <svg width={width} height={height} role="group" aria-labelledby={titleId} className="block overflow-visible">
        <title id={titleId}>{title}</title>
        {ticks.map((t) => (
          <g key={t} aria-hidden>
            <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t === 0 ? undefined : '2 3'} />
            <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fill="var(--ink-3)" fontSize={11} className="tabular-nums">
              {t}
            </text>
          </g>
        ))}
        <g role="list">
          {data.map((d, i) => {
            const cx = m.left + band * i + band / 2;
            const bh = Math.max(d.value > 0 ? 2 : 0, (d.value / top) * h);
            return (
              <g
                key={d.key}
                role="listitem"
                tabIndex={0}
                aria-label={`${d.label}: ${d.display}`}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="outline-none [&:focus-visible>rect.hit]:stroke-[var(--focus)]"
              >
                <rect className="hit" x={cx - band / 2 + 1} y={m.top} width={band - 2} height={h} fill={active === i ? 'var(--surface-2)' : 'transparent'} strokeWidth={2} rx={4} />
                <path d={roundedTop(cx - barW / 2, y(0) - bh, barW, bh, Math.min(4, barW / 2, bh))} fill={d.color ?? 'var(--accent)'} />
                {i % labelEvery === 0 ? (
                  <text x={cx} y={m.top + h + 16} textAnchor="middle" fill="var(--ink-3)" fontSize={11} aria-hidden>
                    {d.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
        <text x={m.left + w / 2} y={height - 6} textAnchor="middle" fill="var(--ink-3)" fontSize={11} aria-hidden>
          {xLabel}
        </text>
        <text transform={`translate(12 ${m.top + h / 2}) rotate(-90)`} textAnchor="middle" fill="var(--ink-3)" fontSize={11} aria-hidden>
          {yLabel}
        </text>
      </svg>
      {a ? (
        <Tip x={m.left + band * active! + band / 2} y={y(a.value)} width={width}>
          <span className="font-medium">{a.display}</span> · {a.label}
        </Tip>
      ) : null}
    </div>
  );
}

/** Horizontal bars with the value written at the end of each bar. */
export function BarChart({ data, title, xLabel, max: fixedMax, rowHeight = 30 }: { data: Datum[]; title: string; xLabel: string; max?: number; rowHeight?: number }) {
  const { ref, width } = useWidth(720);
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();
  const labelW = Math.min(180, Math.round(width * 0.36));
  const m = { top: 4, right: 56, bottom: 30, left: labelW + 12 };
  const w = Math.max(40, width - m.left - m.right);
  const height = m.top + data.length * rowHeight + m.bottom;
  const { top, ticks } = fixedMax ? { top: fixedMax, ticks: [0, fixedMax / 4, fixedMax / 2, (fixedMax * 3) / 4, fixedMax] } : niceTicks(Math.max(...data.map((d) => d.value), 0));
  const x = (v: number) => m.left + (v / top) * w;
  const barH = Math.min(16, rowHeight - 12);
  const maxChars = Math.floor(labelW / 6.4);

  return (
    <div ref={ref} className="relative w-full">
      <svg width={width} height={height} role="group" aria-labelledby={titleId} className="block overflow-visible">
        <title id={titleId}>{title}</title>
        {ticks.map((t) => (
          <g key={t} aria-hidden>
            <line x1={x(t)} x2={x(t)} y1={m.top} y2={height - m.bottom} stroke="var(--line)" strokeDasharray={t === 0 ? undefined : '2 3'} />
            <text x={x(t)} y={height - m.bottom + 14} textAnchor="middle" fill="var(--ink-3)" fontSize={11} className="tabular-nums">
              {Number.isInteger(t) ? t : t.toFixed(1)}
            </text>
          </g>
        ))}
        <g role="list">
          {data.map((d, i) => {
            const cy = m.top + i * rowHeight + rowHeight / 2;
            const bw = Math.max(d.value > 0 ? 2 : 0, (d.value / top) * w);
            const label = d.label.length > maxChars ? `${d.label.slice(0, maxChars - 1)}…` : d.label;
            return (
              <g key={d.key} role="listitem" tabIndex={0} aria-label={`${d.label}: ${d.display}`} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} className="outline-none [&:focus-visible>rect.hit]:stroke-[var(--focus)]">
                <rect className="hit" x={0} y={cy - rowHeight / 2 + 1} width={width} height={rowHeight - 2} rx={4} fill={active === i ? 'var(--surface-2)' : 'transparent'} strokeWidth={2} />
                <text x={labelW} y={cy} dy="0.32em" textAnchor="end" fill="var(--ink-2)" fontSize={12} aria-hidden>
                  {label}
                </text>
                <path d={roundedRight(m.left, cy - barH / 2, bw, barH, Math.min(4, bw / 2, barH / 2))} fill={d.color ?? 'var(--accent)'} />
                <text x={m.left + bw + 6} y={cy} dy="0.32em" fill="var(--ink)" fontSize={12} className="tabular-nums" aria-hidden>
                  {d.display}
                </text>
              </g>
            );
          })}
        </g>
        <text x={m.left + w / 2} y={height - 2} textAnchor="middle" fill="var(--ink-3)" fontSize={11} aria-hidden>
          {xLabel}
        </text>
      </svg>
    </div>
  );
}

function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  if (h <= 0) return '';
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

function roundedRight(x: number, y: number, w: number, h: number, r: number) {
  if (w <= 0) return '';
  return `M${x},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x} Z`;
}
