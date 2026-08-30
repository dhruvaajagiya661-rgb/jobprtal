import React, { useId, useState } from 'react';

export interface Point {
  label: string;
  value: number;
}

interface AreaChartProps {
  data: Point[];
  height?: number;
  /** Stroke/fill colour pair. */
  from?: string;
  to?: string;
  /** Suffix shown in the hover readout, e.g. " applications". */
  unit?: string;
}

/**
 * Dependency-free SVG area chart with a gradient fill and a hover readout.
 *
 * Drawn in a fixed 0-100 user-space box and stretched with
 * preserveAspectRatio="none", so it fills any container width without needing a
 * resize observer. Stroke width is compensated via vector-effect so the line
 * doesn't smear when the box stretches.
 */
const AreaChart: React.FC<AreaChartProps> = ({
  data,
  height = 180,
  from = '#6366f1',
  to = '#d946ef',
  unit = '',
}) => {
  const gid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center text-sm text-surface-400" style={{ height }}>
        No activity yet
      </div>
    );
  }

  const W = 100;
  const H = 100;
  const max = Math.max(...data.map(d => d.value), 1);
  // A single point has no span to divide by; pin it to the middle.
  const stepX = data.length > 1 ? W / (data.length - 1) : 0;
  const xs = data.map((_, i) => (data.length > 1 ? i * stepX : W / 2));
  const ys = data.map(d => H - (d.value / max) * (H - 12) - 4);

  // Smooth the line with mid-point quadratic segments — no control-point
  // overshoot, so the curve never dips below zero on a spiky series.
  let line = `M ${xs[0]} ${ys[0]}`;
  for (let i = 1; i < xs.length; i++) {
    const mx = (xs[i - 1] + xs[i]) / 2;
    line += ` Q ${mx} ${ys[i - 1]} ${mx} ${(ys[i - 1] + ys[i]) / 2}`;
    line += ` Q ${mx} ${ys[i]} ${xs[i]} ${ys[i]}`;
  }
  const area = `${line} L ${xs[xs.length - 1]} ${H} L ${xs[0]} ${H} Z`;

  const active = hover !== null ? data[hover] : null;

  return (
    <div className="relative">
      <div className="relative" style={{ height }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="w-full h-full overflow-visible"
          role="img"
          aria-label={`Activity chart: ${data.map(d => `${d.label} ${d.value}`).join(', ')}`}
        >
          <defs>
            <linearGradient id={`fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={from} stopOpacity="0.35" />
              <stop offset="100%" stopColor={from} stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`stroke-${gid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={from} />
              <stop offset="100%" stopColor={to} />
            </linearGradient>
          </defs>

          {/* Horizontal guides */}
          {[0.25, 0.5, 0.75].map(f => (
            <line
              key={f}
              x1="0" x2={W} y1={H * f} y2={H * f}
              stroke="currentColor"
              className="text-surface-200"
              strokeWidth="0.4"
              vectorEffect="non-scaling-stroke"
              strokeDasharray="2 3"
            />
          ))}

          <path d={area} fill={`url(#fill-${gid})`} />
          <path
            d={line}
            fill="none"
            stroke={`url(#stroke-${gid})`}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {xs.map((x, i) => (
            <circle
              key={i}
              cx={x}
              cy={ys[i]}
              r={hover === i ? 3 : 0}
              fill="#fff"
              stroke={from}
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
              style={{ transition: 'r 0.15s ease' }}
            />
          ))}
        </svg>

        {/* Hover targets sit above the SVG so thin bars stay easy to hit. */}
        <div className="absolute inset-0 flex">
          {data.map((d, i) => (
            <button
              key={d.label + i}
              type="button"
              tabIndex={-1}
              aria-label={`${d.label}: ${d.value}${unit}`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onBlur={() => setHover(null)}
              className="flex-1 h-full cursor-default"
            />
          ))}
        </div>

        {active && (
          <div className="pointer-events-none absolute top-0 right-0 px-3 py-1.5 rounded-xl bg-surface-900 text-white text-xs font-semibold shadow-lg animate-fade-in">
            {active.label}: <span className="tabular-nums">{active.value}</span>{unit}
          </div>
        )}
      </div>

      <div className="flex mt-2">
        {data.map((d, i) => (
          <span
            key={d.label + i}
            className={`flex-1 text-center text-[10px] font-semibold tabular-nums transition-colors ${
              hover === i ? 'text-primary-600' : 'text-surface-400'
            }`}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
};

export default AreaChart;
