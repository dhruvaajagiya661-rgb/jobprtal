import React from 'react';

interface MatchRingProps {
  score: number;
  size?: number;
  /** Adds a "match" caption under the figure. */
  labelled?: boolean;
}

/** Green is a strong fit, indigo is workable, amber is a stretch. */
export function matchColor(score: number): string {
  if (score >= 70) return '#10b981';
  if (score >= 40) return '#6366f1';
  return '#f59e0b';
}

/**
 * Compact circular match indicator, shown to signed-in students wherever a
 * `match_score` comes back from the API.
 */
const MatchRing: React.FC<MatchRingProps> = ({ score, size = 48, labelled = false }) => {
  const pct = Math.min(Math.max(score, 0), 100);
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center shrink-0">
      <div
        className="relative"
        style={{ width: size, height: size }}
        title="Match score based on the skills on your profile"
      >
        <svg viewBox="0 0 44 44" className="w-full h-full -rotate-90">
          <circle cx="22" cy="22" r={r} fill="none" stroke="#eef2f7" strokeWidth="5" />
          <circle
            cx="22" cy="22" r={r} fill="none"
            stroke={matchColor(pct)} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * c} ${c}`}
            style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.22,1,0.36,1)' }}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center font-extrabold text-surface-700 tabular-nums"
          style={{ fontSize: Math.max(10, size * 0.23) }}
        >
          {Math.round(pct)}%
        </span>
      </div>
      {labelled && (
        <span className="text-[10px] uppercase tracking-[0.12em] font-bold text-surface-400 mt-1">match</span>
      )}
    </div>
  );
};

export default MatchRing;
