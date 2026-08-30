import React, { useId } from 'react';

interface ProgressRingProps {
  /** 0-100. Values outside the range are clamped. */
  percent: number;
  size?: number;
  thickness?: number;
  from?: string;
  to?: string;
  /** Centre content. Defaults to the percentage. */
  children?: React.ReactNode;
  /** Soft coloured bloom behind the ring. */
  glow?: string;
}

/** Gradient-stroked progress ring used for completion and match scores. */
const ProgressRing: React.FC<ProgressRingProps> = ({
  percent,
  size = 140,
  thickness = 12,
  from = '#6366f1',
  to = '#34d399',
  children,
  glow,
}) => {
  const gid = useId().replace(/:/g, '');
  const pct = Math.min(Math.max(percent, 0), 100);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {glow && (
        <div
          className="absolute inset-2 rounded-full blur-2xl opacity-30"
          style={{ backgroundColor: glow }}
        ></div>
      )}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="relative -rotate-90">
        <defs>
          <linearGradient id={`ring-${gid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="currentColor" className="text-surface-200/60"
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={`url(#ring-${gid})`}
          strokeWidth={thickness} strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children ?? (
          <span className="text-2xl font-extrabold text-surface-900 tabular-nums tracking-tight">
            {Math.round(pct)}
            <span className="text-base text-surface-400">%</span>
          </span>
        )}
      </div>
    </div>
  );
};

export default ProgressRing;
