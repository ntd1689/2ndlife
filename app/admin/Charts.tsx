"use client";

import { useRef, useState } from "react";

// Lightweight, dependency-free chart primitives for the admin analytics
// dashboard. Single-series magnitude only: sequential one-hue fills, thin marks,
// 4px rounded data-ends, recessive hairline axes, and a hover layer. Text uses
// ink tokens; the mark beside it carries the color.

const INK = "#1F2A24";
const MUTED = "#6b6b63";
const GRID = "#e6e0d2";

// Round a value up to a clean 1/2/5 × 10ⁿ ceiling for axis maxima.
function niceCeil(n: number): number {
  if (n <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  const f = n / pow;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * pow;
}

// ---- Horizontal ranked bar list (category / parish / top ads) ----
export function BarList({
  data,
  color = "var(--teal)",
  format = (n: number) => n.toLocaleString(),
  emptyLabel = "No data in this period.",
}: {
  data: { label: string; value: number; sub?: string }[];
  color?: string;
  format?: (n: number) => string;
  emptyLabel?: string;
}) {
  if (data.length === 0) return <p className="note">{emptyLabel}</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="barlist">
      {data.map((d, i) => (
        <div key={i} className="barlist-row" title={`${d.label}${d.sub ? ` (${d.sub})` : ""}: ${format(d.value)}`}>
          <div className="barlist-label">
            {d.label}
            {d.sub && <span className="note barlist-sub"> · {d.sub}</span>}
          </div>
          <div className="barlist-track">
            <div className="barlist-bar" style={{ width: `${Math.max((d.value / max) * 100, 1.5)}%`, background: color }} />
          </div>
          <div className="barlist-value mono">{format(d.value)}</div>
        </div>
      ))}
    </div>
  );
}

// ---- Revenue-over-time area + line with hover crosshair ----
export function AreaChart({
  data,
  color = "var(--teal)",
  formatX,
  formatY = (n: number) => `J$${n.toLocaleString()}`,
}: {
  data: { bucket: string; amountJmd: number }[];
  color?: string;
  formatX: (bucket: string) => string;
  formatY?: (n: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  if (data.length === 0) return <p className="note">No revenue in this period.</p>;

  const W = 720, H = 240;
  const padL = 56, padR = 16, padT = 16, padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = data.length;
  const maxY = niceCeil(Math.max(...data.map((d) => d.amountJmd), 1));

  const x = (i: number) => (n === 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW);
  const y = (v: number) => padT + plotH * (1 - v / maxY);

  const linePts = data.map((d, i) => `${x(i)},${y(d.amountJmd)}`).join(" ");
  const areaPts = `${padL},${padT + plotH} ${linePts} ${x(n - 1)},${padT + plotH}`;
  const ticks = [0, maxY / 2, maxY];

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = n === 1 ? 0 : Math.round(((px - padL) / plotW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }

  // Label positions: first, middle, last (avoid crowding the axis).
  const xLabelIdx = n <= 1 ? [0] : n === 2 ? [0, 1] : [0, Math.floor((n - 1) / 2), n - 1];

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img">
        {/* gridlines + y ticks */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill={MUTED} className="mono">
              {t >= 1000 ? `${Math.round(t / 1000)}k` : Math.round(t)}
            </text>
          </g>
        ))}
        {/* area wash + line */}
        <polygon points={areaPts} fill={color} fillOpacity={0.1} />
        <polyline points={linePts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {/* end dot */}
        <circle cx={x(n - 1)} cy={y(data[n - 1].amountJmd)} r={4} fill={color} stroke="var(--paper)" strokeWidth={2} />
        {/* x labels */}
        {xLabelIdx.map((i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize={11} fill={MUTED}>
            {formatX(data[i].bucket)}
          </text>
        ))}
        {/* hover crosshair */}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + plotH} stroke={INK} strokeOpacity={0.25} strokeWidth={1} />
            <circle cx={x(hover)} cy={y(data[hover].amountJmd)} r={4.5} fill={color} stroke="var(--paper)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div
          className="chart-tip"
          style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > n / 2 ? "-100%" : "0"})` }}
        >
          <div className="chart-tip-x">{formatX(data[hover].bucket)}</div>
          <div className="chart-tip-y mono">{formatY(data[hover].amountJmd)}</div>
        </div>
      )}
    </div>
  );
}
