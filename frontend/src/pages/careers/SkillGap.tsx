import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { careersAPI } from '../../api/client';
import PageHero from '../../components/ui/PageHero';

interface Resource {
  title: string;
  url: string;
  resource_type: string;
  difficulty: string;
  is_free: boolean;
}

interface GapItem {
  skill_name: string;
  relevance: number;
  jobs_demanding: number;
  description: string;
  resources: Resource[];
  status: 'not_started' | 'in_progress' | 'learned';
}

interface CareerRec {
  name: string;
  match_percentage: number;
}

interface JobGap {
  job_id: number;
  job_title: string;
  company: string | null;
  location: string | null;
  match_percentage: number;
  missing_required: string[];
  missing_preferred: string[];
}

interface RoadmapItem {
  skill_name: string;
  demand_count: number;
  demand_percentage: number;
  career_path_count: number;
  priority_score: number;
  status: string;
  resources: Resource[];
}

interface Analysis {
  student_skills: string[];
  recommended_skills: GapItem[];
  career_recommendations: CareerRec[];
  job_breakdown: JobGap[];
}

const CHIP_CLASS: Record<string, string> = {
  not_started: 'chip chip-idle',
  in_progress: 'chip chip-progress',
  learned: 'chip chip-done',
};

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  learned: 'Learned',
};

const NEXT_STATUS: Record<string, string> = {
  not_started: 'in_progress',
  in_progress: 'learned',
  learned: 'not_started',
};

// Left accent stripe on each skill card, keyed to progress.
const ACCENT: Record<string, string> = {
  not_started: 'from-violet-500 to-fuchsia-500',
  in_progress: 'from-sky-500 to-cyan-400',
  learned: 'from-emerald-500 to-teal-400',
};

const FILL: Record<string, string> = {
  not_started: 'track-fill-violet',
  in_progress: 'track-fill-sky',
  learned: 'track-fill-emerald',
};

/**
 * Horizontal demand chart. `value` is already a percentage of a defined whole
 * (share of job listings), so bars are drawn on an absolute 0-100 scale.
 * Scaling to the largest value instead would draw a bar labelled "24%" as a
 * completely full track.
 */
const BarChart: React.FC<{ data: { label: string; value: number; fill: string; striped?: boolean }[] }> = ({ data }) => (
  <div className="space-y-4">
    {data.map((d, i) => (
      <div key={d.label} className="reveal" style={{ '--i': i } as React.CSSProperties}>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-sm text-surface-700 font-semibold">{d.label}</span>
          <span className="text-xs text-surface-400 font-mono tabular-nums">{d.value}%</span>
        </div>
        <div className="track">
          <div
            className={`track-fill ${d.fill} ${d.striped ? 'track-striped' : ''}`}
            style={{ width: `${Math.min(Math.max(d.value, 0), 100)}%` }}
          ></div>
        </div>
      </div>
    ))}
  </div>
);

/** Coverage ring — gradient stroke, soft outer bloom, animated sweep. */
const CoverageRing: React.FC<{ learned: number; total: number }> = ({ learned, total }) => {
  const pct = total ? Math.round((learned / total) * 100) : 0;
  const r = 62;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col sm:flex-row items-center gap-7">
      <div className="relative shrink-0">
        <div className="absolute inset-0 rounded-full bg-emerald-400/20 blur-2xl"></div>
        <svg width="164" height="164" viewBox="0 0 164 164" className="relative -rotate-90">
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="50%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>
          <circle cx="82" cy="82" r={r} fill="none" stroke="#eef2f7" strokeWidth="14" />
          <circle
            cx="82" cy="82" r={r} fill="none"
            stroke="url(#ringGrad)" strokeWidth="14" strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * c} ${c}`}
            style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.22,1,0.36,1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-extrabold text-surface-900 tabular-nums tracking-tight">
            {pct}<span className="text-xl text-surface-400">%</span>
          </span>
          <span className="text-[11px] uppercase tracking-[0.14em] text-surface-400 font-semibold mt-0.5">covered</span>
        </div>
      </div>
      <div className="text-center sm:text-left">
        <p className="text-2xl font-bold text-surface-900 tabular-nums">
          {learned}<span className="text-surface-300 font-semibold"> / {total}</span>
        </p>
        <p className="text-sm text-surface-500 mt-1">recommended skills marked learned</p>
        <div className="mt-4 h-px w-full bg-gradient-to-r from-surface-200 to-transparent"></div>
        <p className="mt-3 text-xs text-surface-400 leading-relaxed max-w-[15rem]">
          Advance a skill's status as you complete it — your coverage and profile skills update together.
        </p>
      </div>
    </div>
  );
};

const SkillGap: React.FC = () => {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'roadmap' | 'jobs'>('overview');
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [expandedJob, setExpandedJob] = useState<number | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const loadAll = () => {
    Promise.all([careersAPI.skillGap(), careersAPI.roadmap()])
      .then(([a, r]) => {
        setAnalysis(a.data);
        setRoadmap(r.data.roadmap || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleSkillClick = async (skillName: string) => {
    if (expandedSkill === skillName) {
      setExpandedSkill(null);
      return;
    }
    setExpandedSkill(skillName);
    try {
      const r = await careersAPI.learningPath(skillName);
      const learningPath = r.data;
      if (analysis) {
        setAnalysis(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            recommended_skills: prev.recommended_skills.map(gap =>
              gap.skill_name === skillName
                ? { ...gap, resources: (learningPath.resources || []).length ? learningPath.resources : gap.resources }
                : gap
            ),
          };
        });
      }
    } catch { /* ignore */ }
  };

  const handleStatusChange = async (skillName: string, current: string) => {
    const next = NEXT_STATUS[current] || 'not_started';
    setUpdating(skillName);
    try {
      await careersAPI.setSkillStatus(skillName, next);
      setAnalysis(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          recommended_skills: prev.recommended_skills.map(gap =>
            gap.skill_name === skillName ? { ...gap, status: next as GapItem['status'] } : gap
          ),
          // Learned skills move into the student's profile skills
          student_skills: next === 'learned'
            ? [...new Set([...prev.student_skills, skillName])]
            : prev.student_skills,
        };
      });
      setRoadmap(prev =>
        prev.map(item =>
          item.skill_name === skillName ? { ...item, status: next } : item
        )
      );
    } catch { /* ignore */ }
    setUpdating(null);
  };

  const nextLabel = (status: string) => {
    const n = NEXT_STATUS[status];
    return n === 'learned' ? 'Mark Learned' : n === 'in_progress' ? 'Start Learning' : 'Reset';
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
        <div className="spinner-gradient !w-11 !h-11 !border-[3px]"></div>
        <p className="text-sm text-surface-400 font-medium animate-pulse">Analysing your skills against the job market…</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="card-elevated max-w-md w-full p-10 text-center animate-scale-in">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-3L13.74 4a2 2 0 00-3.48 0L3.33 16a2 2 0 001.74 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-surface-900 mb-2">Analysis unavailable</h1>
          <p className="text-surface-500 text-sm mb-7">We couldn't load your skill gap analysis just now.</p>
          <button onClick={() => { setLoading(true); loadAll(); }} className="btn-primary">Try again</button>
        </div>
      </div>
    );
  }

  // Derive from local copies: a payload missing an optional list must render an
  // empty section, never crash the whole page into the error boundary.
  const gaps = analysis.recommended_skills ?? [];
  const jobs = analysis.job_breakdown ?? [];
  const learnedCount = gaps.filter(s => s.status === 'learned').length;
  const totalGaps = gaps.length;
  const inProgressCount = gaps.filter(s => s.status === 'in_progress').length;
  const coverage = totalGaps ? Math.round((learnedCount / totalGaps) * 100) : 0;
  const jobCount = jobs.length;
  const topMatch = jobCount ? Math.max(...jobs.map(j => j.match_percentage)) : 0;

  const chartData = gaps.slice(0, 8).map(s => ({
    label: s.skill_name,
    value: Math.round(s.relevance),
    // These must be real CSS class names — interpolating a raw hex here would
    // produce an invalid class and the bars would render with no fill at all.
    fill: FILL[s.status] || FILL.not_started,
    striped: s.status === 'in_progress',
  }));

  const TABS = [
    ['overview', 'Overview', ''],
    ['roadmap', 'Priority Roadmap', String(roadmap.length)],
    ['jobs', 'Job Breakdown', String(jobCount)],
  ] as const;

  return (
    <div className="pb-20">
      <PageHero
        eyebrow="Live market analysis"
        live
        crumbs={[{ label: 'Careers', to: '/careers/paths' }, { label: 'Skill Gap Analysis' }]}
        title="Close the gap to your"
        accent="next role"
        subtitle="Every skill below is ranked by real demand across live listings on PortAL — not a generic checklist. Track your progress and watch your coverage climb."
        aside={
          <div className="grid grid-cols-2 gap-3">
            <div className="kpi">
              <p className="kpi-value">{coverage}%</p>
              <p className="kpi-label">Coverage</p>
              <div className="track mt-3 !h-1.5 !bg-white/10">
                <div className="track-fill track-fill-emerald" style={{ width: `${coverage}%` }}></div>
              </div>
            </div>
            <div className="kpi">
              <p className="kpi-value">{totalGaps - learnedCount}</p>
              <p className="kpi-label">Skills to learn</p>
              <p className="mt-3 text-[11px] text-white/40 font-medium">{inProgressCount} in progress</p>
            </div>
            <div className="kpi">
              <p className="kpi-value">{analysis.student_skills?.length || 0}</p>
              <p className="kpi-label">Skills you have</p>
            </div>
            <div className="kpi">
              <p className="kpi-value">{topMatch}%</p>
              <p className="kpi-label">Best job match</p>
            </div>
          </div>
        }
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ===================== TABS ===================== */}
        <div className="-mt-2 mb-9 overflow-x-auto scrollbar-none">
          <div className="segmented" role="tablist">
            {TABS.map(([key, label, count]) => (
              <button
                key={key}
                role="tab"
                aria-selected={activeTab === key}
                data-active={activeTab === key}
                onClick={() => setActiveTab(key)}
                className="segmented-item"
              >
                {label}
                {count && (
                  <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums ${
                    activeTab === key ? 'bg-primary-100 text-primary-700' : 'bg-surface-200/80 text-surface-500'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ===================== OVERVIEW ===================== */}
        {activeTab === 'overview' && (
          <div className="space-y-7">
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="glow-card p-7 reveal" style={{ '--i': 0 } as React.CSSProperties}>
                <h2 className="text-xs uppercase tracking-[0.14em] font-bold text-surface-400 mb-6">Your progress</h2>
                <CoverageRing learned={learnedCount} total={totalGaps} />
              </div>

              <div className="glow-card p-7 reveal" style={{ '--i': 1 } as React.CSSProperties}>
                <h2 className="text-xs uppercase tracking-[0.14em] font-bold text-surface-400 mb-5">Your current skills</h2>
                {analysis.student_skills?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {analysis.student_skills.map((s, i) => (
                      <span
                        key={s}
                        style={{ '--i': i } as React.CSSProperties}
                        className="reveal shine px-3 py-1.5 rounded-xl text-sm font-semibold text-emerald-700 bg-gradient-to-br from-emerald-50 to-teal-50 ring-1 ring-emerald-200/70"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border-2 border-dashed border-surface-200 p-7 text-center">
                    <p className="text-sm text-surface-500 font-medium">No skills on your profile yet</p>
                    <p className="text-xs text-surface-400 mt-1.5 leading-relaxed">
                      Add them from your profile, or mark a skill learned below — it lands here automatically.
                    </p>
                    <Link to="/student/profile" className="btn-secondary !py-2 !px-4 !text-sm mt-5 inline-block">
                      Update profile
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {chartData.length > 0 && (
              <div className="glow-card p-7 reveal" style={{ '--i': 2 } as React.CSSProperties}>
                <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-surface-900">Top skill gaps by job demand</h2>
                    <p className="text-sm text-surface-400 mt-1">Share of live listings asking for each skill.</p>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] font-semibold text-surface-500">
                    <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"></i>Not started</span>
                    <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-sky-500 to-cyan-400"></i>In progress</span>
                    <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"></i>Learned</span>
                  </div>
                </div>
                <BarChart data={chartData} />
              </div>
            )}

            {analysis.career_recommendations?.length > 0 && (
              <div className="reveal" style={{ '--i': 3 } as React.CSSProperties}>
                <h2 className="text-lg font-bold text-surface-900 mb-1">Career paths that fit you</h2>
                <p className="text-sm text-surface-400 mb-5">Ranked by overlap with the skills you already hold.</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {analysis.career_recommendations.map((c, i) => (
                    <div
                      key={c.name}
                      style={{ '--i': i } as React.CSSProperties}
                      className="reveal glow-card shine p-6"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-bold text-surface-900 leading-snug">{c.name}</h3>
                        <span className="text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-br from-primary-600 to-accent-500 tabular-nums shrink-0">
                          {c.match_percentage}%
                        </span>
                      </div>
                      <div className="track mt-4 !h-2">
                        <div className="track-fill track-fill-indigo" style={{ width: `${c.match_percentage}%` }}></div>
                      </div>
                      <p className="text-[11px] text-surface-400 mt-2.5 font-medium">skills match</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ---- Skills to develop ---- */}
            <div className="reveal" style={{ '--i': 4 } as React.CSSProperties}>
              <h2 className="text-lg font-bold text-surface-900 mb-1">Skills to develop</h2>
              <p className="text-sm text-surface-400 mb-5">Expand any skill for curated learning resources.</p>

              {totalGaps === 0 ? (
                <div className="glow-card p-14 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/25">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-lg font-bold text-surface-900">No skill gaps found</p>
                  <p className="text-surface-500 text-sm mt-1.5">Your skills are well aligned with your career goals.</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {gaps.map((gap, i) => (
                    <div
                      key={gap.skill_name}
                      style={{ '--i': i } as React.CSSProperties}
                      className="reveal glow-card overflow-hidden"
                    >
                      {/* Header row. The expand toggle and the status action are
                          siblings, never nested: a <button> may not contain another
                          <button> -- it is invalid HTML and leaves the inner control
                          unreachable by keyboard and screen readers. */}
                      <div className="relative flex items-center justify-between gap-4 p-6 pl-7 transition-colors hover:bg-surface-50/70">
                        <span className={`absolute left-0 inset-y-0 w-1.5 bg-gradient-to-b ${ACCENT[gap.status] || ACCENT.not_started}`}></span>

                        <button
                          onClick={() => handleSkillClick(gap.skill_name)}
                          aria-expanded={expandedSkill === gap.skill_name}
                          className="flex-1 min-w-0 text-left"
                        >
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="font-bold text-surface-900 text-[15px]">{gap.skill_name}</h3>
                            <span className={CHIP_CLASS[gap.status] || CHIP_CLASS.not_started}>
                              {STATUS_LABELS[gap.status] || gap.status}
                            </span>
                          </div>
                          <p className="text-sm text-surface-500 mt-1.5 leading-relaxed">{gap.description}</p>
                          <div className="flex items-center gap-5 mt-3">
                            <div className="flex items-center gap-2">
                              <div className="track !h-1.5 w-24">
                                <div
                                  className={`track-fill ${FILL[gap.status] || FILL.not_started}`}
                                  style={{ width: `${Math.min(gap.relevance, 100)}%` }}
                                ></div>
                              </div>
                              <span className="text-[11px] font-bold text-surface-500 tabular-nums">{gap.relevance}%</span>
                            </div>
                            <span className="text-[11px] font-medium text-surface-400">
                              {gap.jobs_demanding} job{gap.jobs_demanding === 1 ? '' : 's'} demand it
                            </span>
                          </div>
                        </button>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleStatusChange(gap.skill_name, gap.status)}
                            disabled={updating === gap.skill_name}
                            className="text-xs font-bold px-3.5 py-2 rounded-xl border border-surface-200 text-surface-600 bg-white hover:border-primary-300 hover:text-primary-700 hover:shadow-md hover:shadow-primary-500/10 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-50 disabled:hover:translate-y-0"
                            title="Advance status"
                          >
                            {updating === gap.skill_name ? '…' : nextLabel(gap.status)}
                          </button>
                          <button
                            onClick={() => handleSkillClick(gap.skill_name)}
                            aria-expanded={expandedSkill === gap.skill_name}
                            aria-label={`${expandedSkill === gap.skill_name ? 'Hide' : 'Show'} learning resources for ${gap.skill_name}`}
                            className="p-2 rounded-xl text-surface-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                          >
                            <svg className={`w-5 h-5 transition-transform duration-300 ${expandedSkill === gap.skill_name ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {expandedSkill === gap.skill_name && gap.resources?.length > 0 && (
                        <div className="expand-in px-7 pb-6 pt-5 border-t border-surface-100 bg-gradient-to-b from-surface-50/60 to-transparent">
                          <h4 className="text-[11px] uppercase tracking-[0.14em] font-bold text-surface-400 mb-4">Learning resources</h4>
                          <div className="grid md:grid-cols-2 gap-3">
                            {gap.resources.map((r, ri) => (
                              <a
                                key={ri} href={r.url} target="_blank" rel="noopener noreferrer"
                                style={{ '--i': ri } as React.CSSProperties}
                                className="reveal group flex items-center gap-3 p-3.5 rounded-xl bg-white border border-surface-200/80 hover:border-primary-300 hover:shadow-md hover:shadow-primary-500/10 hover:-translate-y-0.5 transition-all duration-200"
                              >
                                <span className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shrink-0 shadow-sm">
                                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                  </svg>
                                </span>
                                <span className="flex-1 min-w-0">
                                  <span className="block text-sm font-semibold text-surface-900 truncate group-hover:text-primary-700 transition-colors">{r.title}</span>
                                  <span className="block text-[11px] text-surface-400 capitalize mt-0.5">{r.resource_type} • {r.difficulty}</span>
                                </span>
                                {r.is_free && <span className="badge-success !text-[10px] shrink-0">Free</span>}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== ROADMAP ===================== */}
        {activeTab === 'roadmap' && (
          <div className="glow-card p-7 md:p-9">
            <h2 className="text-lg font-bold text-surface-900">Your priority learning roadmap</h2>
            <p className="text-sm text-surface-400 mt-1.5 mb-8 max-w-2xl leading-relaxed">
              Ranked by impact: job demand (60%) + relevance to your recommended career paths (40%). Work top to bottom.
            </p>

            {roadmap.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-surface-900 font-bold">Nothing left to work on</p>
                <p className="text-sm text-surface-400 mt-1.5">You're on track — check back as new roles are posted.</p>
              </div>
            ) : (
              <ol className="rail space-y-4">
                {roadmap.map((item, idx) => (
                  <li
                    key={item.skill_name}
                    style={{ '--i': idx } as React.CSSProperties}
                    className="reveal relative rounded-2xl border border-surface-200/70 p-5 bg-white hover:border-primary-300 hover:shadow-lg hover:shadow-primary-500/5 transition-all duration-300"
                  >
                    <span className={`rail-node -ml-14 ${
                      idx < 3
                        ? 'bg-gradient-to-br from-primary-600 to-accent-500 text-white shadow-primary-500/30'
                        : 'bg-white text-surface-500 border border-surface-200 shadow-surface-300/20'
                    }`}>
                      {idx + 1}
                    </span>

                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-bold text-surface-900">{item.skill_name}</h3>
                      <span className={CHIP_CLASS[item.status] || CHIP_CLASS.not_started}>
                        {STATUS_LABELS[item.status] || item.status}
                      </span>
                      {idx < 3 && (
                        <span className="chip bg-gradient-to-r from-primary-600 to-accent-500 text-white">High impact</span>
                      )}
                    </div>

                    <div className="flex items-center gap-5 mt-3 text-[11px] font-medium text-surface-500 flex-wrap">
                      <span>Priority <span className="font-mono font-extrabold text-primary-600 tabular-nums">{item.priority_score}</span></span>
                      <span>{item.demand_count} jobs demand it</span>
                      <span>{item.career_path_count} career path{item.career_path_count === 1 ? '' : 's'} need it</span>
                    </div>

                    <div className="track mt-4">
                      <div
                        className={`track-fill ${FILL[item.status] || 'track-fill-indigo'} ${item.status === 'in_progress' ? 'track-striped' : ''}`}
                        style={{ width: `${Math.min(100, item.priority_score)}%` }}
                      ></div>
                    </div>

                    <button
                      onClick={() => handleStatusChange(item.skill_name, item.status)}
                      disabled={updating === item.skill_name}
                      className="mt-4 text-xs font-bold px-3.5 py-2 rounded-xl border border-surface-200 text-surface-600 bg-white hover:border-primary-300 hover:text-primary-700 hover:shadow-md hover:shadow-primary-500/10 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-50 disabled:hover:translate-y-0"
                    >
                      {updating === item.skill_name ? 'Updating…' : nextLabel(item.status)}
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {/* ===================== JOB BREAKDOWN ===================== */}
        {activeTab === 'jobs' && (
          <div className="glow-card p-7 md:p-9">
            <h2 className="text-lg font-bold text-surface-900">How close are you to each job?</h2>
            <p className="text-sm text-surface-400 mt-1.5 mb-8">Your top matched roles and the exact skills standing between you and them.</p>

            {jobCount === 0 ? (
              <div className="py-16 text-center">
                <p className="text-surface-900 font-bold">No breakdowns yet</p>
                <p className="text-sm text-surface-400 mt-1.5">Add skills to your profile to see per-job analysis.</p>
                <Link to="/student/profile" className="btn-secondary !py-2 !px-4 !text-sm mt-6 inline-block">Update profile</Link>
              </div>
            ) : (
              <div className="space-y-3.5">
                {jobs.map((job, i) => (
                  <div
                    key={job.job_id}
                    style={{ '--i': i } as React.CSSProperties}
                    className="reveal rounded-2xl border border-surface-200/70 overflow-hidden bg-white hover:border-primary-300 hover:shadow-lg hover:shadow-primary-500/5 transition-all duration-300"
                  >
                    <button
                      onClick={() => setExpandedJob(expandedJob === job.job_id ? null : job.job_id)}
                      aria-expanded={expandedJob === job.job_id}
                      className="w-full p-5 text-left flex items-center justify-between gap-4 hover:bg-surface-50/70 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-surface-900 truncate">{job.job_title}</h3>
                        <p className="text-sm text-surface-500 mt-0.5 truncate">
                          {job.company || 'Company'}{job.location ? ` • ${job.location}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        {/* Compact match ring */}
                        <div className="relative w-12 h-12">
                          <svg viewBox="0 0 44 44" className="w-12 h-12 -rotate-90">
                            <circle cx="22" cy="22" r="18" fill="none" stroke="#eef2f7" strokeWidth="5" />
                            <circle
                              cx="22" cy="22" r="18" fill="none"
                              stroke={job.match_percentage >= 70 ? '#10b981' : job.match_percentage >= 40 ? '#6366f1' : '#f59e0b'}
                              strokeWidth="5" strokeLinecap="round"
                              strokeDasharray={`${(job.match_percentage / 100) * 2 * Math.PI * 18} ${2 * Math.PI * 18}`}
                            />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-extrabold text-surface-700 tabular-nums">
                            {job.match_percentage}%
                          </span>
                        </div>
                        <svg className={`w-5 h-5 text-surface-400 transition-transform duration-300 ${expandedJob === job.job_id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {expandedJob === job.job_id && (
                      <div className="expand-in px-5 pb-6 pt-5 border-t border-surface-100 bg-gradient-to-b from-surface-50/60 to-transparent">
                        <div className="grid md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="text-[11px] uppercase tracking-[0.14em] font-bold text-red-500 mb-3">
                              Missing required · {job.missing_required.length}
                            </h4>
                            {job.missing_required.length === 0 ? (
                              <p className="text-sm text-emerald-600 font-semibold">✓ You have every required skill</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {job.missing_required.map(s => (
                                  <span key={s} className="px-2.5 py-1 rounded-lg text-xs font-bold text-red-600 bg-red-50 ring-1 ring-red-200/70">{s}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div>
                            <h4 className="text-[11px] uppercase tracking-[0.14em] font-bold text-amber-500 mb-3">
                              Missing preferred · {job.missing_preferred.length}
                            </h4>
                            {job.missing_preferred.length === 0 ? (
                              <p className="text-sm text-surface-400">None — nice.</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {job.missing_preferred.map(s => (
                                  <span key={s} className="px-2.5 py-1 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 ring-1 ring-amber-200/70">{s}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <Link to={`/jobs/${job.job_id}`} className="btn-primary !py-2 !px-4 !text-sm mt-6 inline-block">
                          View this job
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SkillGap;
