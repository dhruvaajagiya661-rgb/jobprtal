import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { recruiterAPI } from '../../api/client';
import { extractApiError } from '../../utils/errors';
import { completionFromCompany } from '../../utils/companyCompletion';
import PageHero from '../../components/ui/PageHero';
import AreaChart from '../../components/charts/AreaChart';
import ProgressRing from '../../components/charts/ProgressRing';
import useSeo from '../../hooks/useSeo';

interface CompanyInfo {
  id: number | null;
  name: string;
  logo: string | null;
  industry: string | null;
  location: string | null;
  size: string | null;
  website: string | null;
  description: string | null;
  followers_count?: number;
}

interface RoleRow {
  id: number;
  kind: 'job' | 'internship';
  title: string;
  location: string;
  type: string;
  is_active: boolean;
  openings: number;
  deadline: string | null;
  days_left: number | null;
  expired: boolean;
  applicants: number;
  new_applicants: number;
  shortlisted: number;
  accepted: number;
  created_at: string;
}

interface ReviewItem {
  id: number;
  student: string;
  student_email: string;
  position: string | null;
  kind: 'job' | 'internship';
  applied_at: string;
  days_waiting: number;
  resume: string | null;
}

interface FunnelStage {
  stage: string;
  count: number;
  percent: number;
  drop_off: number | null;
}

interface FillTime {
  role: string;
  kind: 'job' | 'internship';
  id: number;
  days: number;
}

interface TopListing {
  id: number;
  kind: 'job' | 'internship';
  title: string;
  location: string;
  is_active: boolean;
  applicants: number;
  shortlisted: number;
  accepted: number;
  created_at: string;
}

interface AnalyticsData {
  funnel: FunnelStage[];
  shortlist_rate: number;
  offer_rate: number;
  time_to_fill: {
    average_days: number | null;
    roles_filled: number;
    fastest: FillTime | null;
    slowest: FillTime | null;
  };
  top_listings: TopListing[];
  top_skills: { skill: string; count: number; percent: number }[];
  month_over_month: {
    this_month: number;
    last_month: number;
    change_percent: number;
    this_month_label: string;
    last_month_label: string;
  };
}

interface DashboardData {
  company: CompanyInfo | null;
  jobs_count: number;
  internships_count: number;
  active_roles: number;
  total_applicants: number;
  new_count: number;
  shortlisted_count: number;
  accepted_count: number;
  rejected_count: number;
  monthly_applicants: { month: string; count: number }[];
  needs_review: ReviewItem[];
  roles: RoleRow[];
}

/* The employer funnel, in the order a candidate actually moves through it.
   The student dashboard tracks the same statuses from the other side. */
const FUNNEL = [
  { key: 'new_count', label: 'Awaiting review', dot: 'bg-amber-400', bar: 'track-fill-amber' },
  { key: 'shortlisted_count', label: 'Shortlisted', dot: 'bg-indigo-400', bar: 'track-fill-indigo' },
  { key: 'accepted_count', label: 'Offers made', dot: 'bg-emerald-400', bar: 'track-fill-emerald' },
  { key: 'rejected_count', label: 'Rejected', dot: 'bg-red-400', bar: 'track-fill-violet' },
] as const;

const QUICK_ACTIONS = [
  {
    to: '/recruiter/post-job',
    label: 'Post a new role',
    hint: 'Job or internship',
    gradient: 'from-primary-500 to-primary-700',
    glow: 'shadow-primary-500/25',
    d: 'M12 4v16m8-8H4',
  },
  {
    to: '/recruiter/applicants',
    label: 'Review applicants',
    hint: 'Shortlist, accept, reject',
    gradient: 'from-emerald-500 to-teal-600',
    glow: 'shadow-emerald-500/25',
    d: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  },
  {
    to: '/recruiter/jobs',
    label: 'Manage jobs',
    hint: 'Edit, duplicate or close',
    gradient: 'from-accent-500 to-primary-600',
    glow: 'shadow-accent-500/25',
    d: 'M4 6h16M4 12h16M4 18h7',
  },
  {
    to: '/recruiter/internships',
    label: 'Manage internships',
    hint: 'Stipends, durations, deadlines',
    gradient: 'from-sky-500 to-indigo-600',
    glow: 'shadow-sky-500/25',
    d: 'M12 14l9-5-9-5-9 5 9 5zm0 0v7m-7-9v5a7 7 0 0014 0v-5',
  },
  {
    to: '/recruiter/post-internship',
    label: 'Post an internship',
    hint: 'Open a new intern role',
    gradient: 'from-teal-500 to-emerald-600',
    glow: 'shadow-teal-500/25',
    d: 'M12 4v16m8-8H4',
  },
  {
    to: '/recruiter/saved-candidates',
    label: 'Saved candidates',
    hint: 'Your talent pool',
    gradient: 'from-amber-500 to-orange-600',
    glow: 'shadow-amber-500/25',
    d: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z',
  },
];

/* The pipeline funnel is horizontal, so each stage needs its own fill.
   Keyed by the stage name the analytics endpoint returns. */
const FUNNEL_BAR: Record<string, string> = {
  Applied: 'from-primary-500 to-primary-600',
  Shortlisted: 'from-indigo-500 to-violet-600',
  Accepted: 'from-emerald-500 to-teal-600',
};

/** How many roles the performance table shows before deferring to Manage listings. */
const ROLE_LIMIT = 8;

const RecruiterDashboard: React.FC = () => {
  useSeo({ title: 'Recruiter dashboard', noIndex: true });
  const [data, setData] = useState<DashboardData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboard = () => {
    setLoading(true);
    setError('');
    recruiterAPI.dashboard()
      .then(r => setData(r.data))
      .catch(err => setError(extractApiError(err, 'Could not load your dashboard. Please try again.')))
      .finally(() => setLoading(false));
    // Analytics load alongside but never gate the page: a failure here hides
    // one section rather than replacing the whole dashboard with an error.
    recruiterAPI.analytics()
      .then(r => setAnalytics(r.data))
      .catch(() => setAnalytics(null));
  };

  useEffect(() => { fetchDashboard(); }, []);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
        <div className="spinner-gradient !w-11 !h-11 !border-[3px]"></div>
        <p className="text-sm text-surface-400 font-medium animate-pulse">Loading your hiring overview…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="card-elevated max-w-md w-full p-10 text-center animate-scale-in">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-surface-900 mb-2">Something went wrong</h2>
          <p className="text-surface-500 text-sm mb-6">{error}</p>
          <button onClick={fetchDashboard} className="btn-primary">Try again</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const company = data.company;
  const completion = completionFromCompany(company);
  const applicants = data.total_applicants || 0;
  const openRoles = data.jobs_count + data.internships_count;

  const inflow = (data.monthly_applicants ?? []).map(m => ({ label: m.month, value: m.count }));
  const inflowTotal = inflow.reduce((sum, p) => sum + p.value, 0);

  // Of everyone who has been triaged, how many moved forward rather than out.
  const decided = data.shortlisted_count + data.accepted_count + data.rejected_count;
  const shortlistRate = decided ? Math.round(((data.shortlisted_count + data.accepted_count) / decided) * 100) : 0;
  const offerRate = applicants ? Math.round((data.accepted_count / applicants) * 100) : 0;

  const roles = data.roles ?? [];
  // Live but past its closing date: still collecting applicants nobody expects.
  const expiredActive = roles.filter(r => r.expired && r.is_active);
  const closingSoon = roles.filter(r => r.is_active && !r.expired && r.days_left !== null && r.days_left <= 7);
  const topRoles = roles.slice(0, ROLE_LIMIT);

  const KPIS = [
    { value: data.active_roles, label: 'Live roles' },
    { value: applicants, label: 'Applicants' },
    { value: data.new_count, label: 'Awaiting review', urgent: data.new_count > 0 },
    { value: data.accepted_count, label: 'Offers made' },
  ];

  return (
    <div className="pb-20">
      <PageHero
        eyebrow={company?.industry || 'Hiring workspace'}
        live
        title="Hiring at"
        accent={company?.name || 'your company'}
        subtitle={
          openRoles > 0
            ? `${data.active_roles} live role${data.active_roles === 1 ? '' : 's'} and ${applicants} applicant${applicants === 1 ? '' : 's'}${data.new_count > 0 ? ` — ${data.new_count} still waiting on you.` : ' — all caught up.'}`
            : 'Post your first role and start building a pipeline of candidates.'
        }
        aside={
          <div className="grid grid-cols-2 gap-3">
            {KPIS.map(k => (
              <div key={k.label} className="kpi">
                <p className={`kpi-value ${k.urgent ? '!text-amber-300' : ''}`}>{k.value}</p>
                <p className="kpi-label">{k.label}</p>
              </div>
            ))}
          </div>
        }
      >
        {/* Company identity — this workspace belongs to the company, not to the
            individual recruiter, so the hero leads with the company's mark. */}
        <div className="flex items-center gap-3 mt-7">
          <span className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 backdrop-blur flex items-center justify-center overflow-hidden shrink-0">
            {company?.logo ? (
              <img src={company.logo} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg font-extrabold text-white/80">
                {(company?.name || '?').charAt(0).toUpperCase()}
              </span>
            )}
          </span>
          <span className="text-sm text-white/55 leading-snug">
            {[company?.location, company?.size].filter(Boolean).join(' · ') || 'Company details not set'}
            {company?.followers_count ? (
              <span className="block text-white/40 text-xs mt-0.5 tabular-nums">
                {company.followers_count} follower{company.followers_count === 1 ? '' : 's'}
              </span>
            ) : null}
          </span>
        </div>

        <div className="flex flex-wrap gap-3 mt-8">
          <Link to="/recruiter/post-job" className="btn-primary">Post a job</Link>
          <Link
            to="/recruiter/post-internship"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-white bg-white/10 border border-white/20 backdrop-blur hover:bg-white/20 transition-all duration-200 hover:-translate-y-0.5"
          >
            Post an internship
          </Link>
          <Link
            to="/recruiter/applicants"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-white bg-white/10 border border-white/20 backdrop-blur hover:bg-white/20 transition-all duration-200 hover:-translate-y-0.5"
          >
            Review applicants
            {data.new_count > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-surface-900 text-xs font-extrabold tabular-nums">
                {data.new_count}
              </span>
            )}
          </Link>
        </div>
      </PageHero>

      <div className="dash-shell !max-w-6xl pt-10 dash-stack">
        {/* ---- Roles that need an operational decision ---- */}
        {(expiredActive.length > 0 || closingSoon.length > 0) && (
          <div className="reveal rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-4" style={{ '--i': 0 } as React.CSSProperties}>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <span className="flex items-center gap-2 text-sm font-bold text-amber-900">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Needs a decision
              </span>
              {expiredActive.length > 0 && (
                <span className="text-sm text-amber-800">
                  <strong className="tabular-nums">{expiredActive.length}</strong> role
                  {expiredActive.length === 1 ? ' is' : 's are'} past their deadline but still open to applicants
                </span>
              )}
              {closingSoon.length > 0 && (
                <span className="text-sm text-amber-800">
                  <strong className="tabular-nums">{closingSoon.length}</strong> closing within 7 days
                </span>
              )}
              <Link to="/recruiter/jobs" className="ml-auto text-sm font-bold text-amber-900 hover:text-amber-950 link-hover">
                Manage listings
              </Link>
            </div>
          </div>
        )}

        {/* ---- The queue + the funnel ---- */}
        <div className="grid lg:grid-cols-[1.15fr,1fr] gap-6">
          <div className="glow-card p-6 reveal" style={{ '--i': 1 } as React.CSSProperties}>
            <div className="flex items-baseline justify-between gap-3 mb-5">
              <div>
                <h2 className="dash-eyebrow">Waiting on you</h2>
                <p className="text-sm text-surface-400 mt-1.5">Longest-waiting applicants first.</p>
              </div>
              {data.new_count > 0 && (
                <span className="chip bg-amber-50 text-amber-700 ring-1 ring-amber-200 shrink-0">
                  {data.new_count} to review
                </span>
              )}
            </div>

            {data.needs_review.length === 0 ? (
              <div className="dash-empty">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="dash-empty-title">You're all caught up</p>
                <p className="dash-empty-hint">Every application has been triaged.</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-surface-100">
                  {data.needs_review.map((item, i) => (
                    <div key={item.id} className="reveal" style={{ '--i': i } as React.CSSProperties}>
                      <div className="flex items-center gap-3.5 py-3">
                        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 text-white text-sm font-extrabold flex items-center justify-center shrink-0 shadow-sm shadow-primary-500/25">
                          {item.student.charAt(0).toUpperCase()}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block font-bold text-surface-900 truncate">{item.student}</span>
                          <span className="block text-xs text-surface-500 truncate">{item.position || '—'}</span>
                        </span>
                        <span
                          className={`text-xs font-bold tabular-nums shrink-0 ${item.days_waiting >= 7 ? 'text-amber-600' : 'text-surface-400'}`}
                          title={`Applied ${new Date(item.applied_at).toLocaleDateString()}`}
                        >
                          {item.days_waiting}d
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <Link to="/recruiter/applicants" className="btn-secondary !py-2 !px-4 !text-sm mt-5 inline-block">
                  Open review queue
                </Link>
              </>
            )}
          </div>

          <div className="glow-card p-6 reveal" style={{ '--i': 2 } as React.CSSProperties}>
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="dash-eyebrow">Hiring funnel</h2>
              {decided > 0 && (
                <span className="text-xs font-semibold text-surface-500">
                  <span className="text-emerald-600 font-extrabold tabular-nums">{shortlistRate}%</span> advanced
                </span>
              )}
            </div>

            {applicants === 0 ? (
              <div className="dash-empty">
                <p className="dash-empty-title">No applicants yet</p>
                <p className="dash-empty-hint">Candidates will appear here as they apply to your roles.</p>
                <Link to="/recruiter/post-job" className="btn-secondary !py-2 !px-4 !text-sm mt-5 inline-block">Post a role</Link>
              </div>
            ) : (
              <>
                <div className="space-y-5">
                  {FUNNEL.map((stage, i) => {
                    const value = data[stage.key] as number;
                    const pct = applicants ? Math.round((value / applicants) * 100) : 0;
                    return (
                      <div key={stage.key} className="reveal" style={{ '--i': i } as React.CSSProperties}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="flex items-center gap-2 text-sm font-semibold text-surface-700">
                            <i className={`w-2.5 h-2.5 rounded-full ${stage.dot}`}></i>
                            {stage.label}
                          </span>
                          <span className="text-xs font-bold text-surface-500 tabular-nums">
                            {value} <span className="text-surface-300 font-medium">· {pct}%</span>
                          </span>
                        </div>
                        <div className="track !h-2">
                          <div className={`track-fill ${stage.bar}`} style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-4 mt-6 pt-5 border-t border-surface-100">
                  <div>
                    <p className="text-xl font-extrabold text-surface-900 tabular-nums">{offerRate}%</p>
                    <p className="text-xs text-surface-400 mt-0.5">Offer rate, all applicants</p>
                  </div>
                  <div>
                    <p className="text-xl font-extrabold text-surface-900 tabular-nums">
                      {openRoles ? (applicants / openRoles).toFixed(1) : '0'}
                    </p>
                    <p className="text-xs text-surface-400 mt-0.5">Applicants per role</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ---- Applicant inflow ---- */}
        <div className="glow-card p-6 reveal" style={{ '--i': 3 } as React.CSSProperties}>
          <div className="flex flex-wrap items-baseline justify-between gap-3 mb-6">
            <div>
              <h2 className="dash-title">Applicant inflow</h2>
              <p className="text-sm text-surface-400 mt-1">Applications your roles received, month by month.</p>
            </div>
            <span className="flex items-baseline gap-1.5 text-sm font-semibold text-surface-500 whitespace-nowrap">
              <span className="text-2xl font-extrabold text-surface-900 tabular-nums">{inflowTotal}</span>
              in 12 months
            </span>
          </div>
          <AreaChart data={inflow} height={190} unit=" applicants" />
        </div>


        {/* ---- Hiring analytics ---- */}
        {analytics && (
          <div className="reveal" style={{ '--i': 4 } as React.CSSProperties}>
            <div className="mb-4">
              <h2 className="dash-title">Hiring analytics</h2>
              <p className="text-sm text-surface-400 mt-1">
                How candidates move through your pipeline, and what it costs you in time.
              </p>
            </div>

            {/* Headline metrics */}
            <div className="grid sm:grid-cols-3 gap-4 mb-6">
              <div className="glow-card p-5">
                <p className="text-xs uppercase tracking-[0.14em] font-bold text-surface-400">Time to fill</p>
                <p className="text-3xl font-extrabold text-surface-900 tabular-nums mt-2">
                  {analytics.time_to_fill.average_days !== null
                    ? <>{analytics.time_to_fill.average_days}<span className="text-base font-bold text-surface-400 ml-1">days</span></>
                    : <span className="text-surface-300">—</span>}
                </p>
                <p className="text-xs text-surface-400 mt-1">
                  {analytics.time_to_fill.roles_filled > 0
                    ? `Average across ${analytics.time_to_fill.roles_filled} filled role${analytics.time_to_fill.roles_filled === 1 ? '' : 's'}`
                    : 'No role has produced a hire yet'}
                </p>
                {analytics.time_to_fill.fastest && analytics.time_to_fill.slowest &&
                 analytics.time_to_fill.roles_filled > 1 && (
                  <p className="text-xs text-surface-500 mt-3 pt-3 border-t border-surface-100">
                    Fastest <strong className="tabular-nums">{analytics.time_to_fill.fastest.days}d</strong> ({analytics.time_to_fill.fastest.role})
                    {' · '}
                    Slowest <strong className="tabular-nums">{analytics.time_to_fill.slowest.days}d</strong> ({analytics.time_to_fill.slowest.role})
                  </p>
                )}
              </div>

              <div className="glow-card p-5">
                <p className="text-xs uppercase tracking-[0.14em] font-bold text-surface-400">This month</p>
                <p className="text-3xl font-extrabold text-surface-900 tabular-nums mt-2">
                  {analytics.month_over_month.this_month}
                  <span className={`text-sm font-bold ml-2 ${
                    analytics.month_over_month.change_percent > 0 ? 'text-emerald-600'
                    : analytics.month_over_month.change_percent < 0 ? 'text-red-500'
                    : 'text-surface-400'
                  }`}>
                    {analytics.month_over_month.change_percent > 0 ? '▲' : analytics.month_over_month.change_percent < 0 ? '▼' : '='}
                    {' '}{Math.abs(analytics.month_over_month.change_percent)}%
                  </span>
                </p>
                <p className="text-xs text-surface-400 mt-1">
                  applicants in {analytics.month_over_month.this_month_label}
                </p>
                <p className="text-xs text-surface-500 mt-3 pt-3 border-t border-surface-100 tabular-nums">
                  {analytics.month_over_month.last_month} in {analytics.month_over_month.last_month_label}
                </p>
              </div>

              <div className="glow-card p-5">
                <p className="text-xs uppercase tracking-[0.14em] font-bold text-surface-400">Conversion</p>
                <p className="text-3xl font-extrabold text-surface-900 tabular-nums mt-2">
                  {analytics.shortlist_rate}<span className="text-base font-bold text-surface-400">%</span>
                </p>
                <p className="text-xs text-surface-400 mt-1">of applicants reach the shortlist</p>
                <p className="text-xs text-surface-500 mt-3 pt-3 border-t border-surface-100">
                  <strong className="tabular-nums">{analytics.offer_rate}%</strong> go on to an offer
                </p>
              </div>
            </div>

            {/* Horizontal conversion funnel */}
            <div className="glow-card p-6 mb-6">
              <h3 className="dash-eyebrow block mb-5">Pipeline conversion</h3>
              {analytics.funnel[0]?.count === 0 ? (
                <div className="dash-empty">
                  <p className="dash-empty-title">No applicants yet</p>
                  <p className="dash-empty-hint">The funnel fills in as candidates apply to your roles.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {analytics.funnel.map((stage, i) => (
                    <div key={stage.stage} className="reveal" style={{ '--i': i } as React.CSSProperties}>
                      <div className="flex items-baseline justify-between mb-1.5">
                        <span className="text-sm font-bold text-surface-700">{stage.stage}</span>
                        <span className="text-xs font-semibold text-surface-500 tabular-nums">
                          {stage.count}
                          <span className="text-surface-300 font-medium"> · {stage.percent}% of applied</span>
                        </span>
                      </div>
                      {/* Width is share-of-applied, so the bars taper the way a
                          funnel should instead of each being scaled to itself. */}
                      <div className="h-9 rounded-xl bg-surface-100 overflow-hidden">
                        <div
                          className={`h-full rounded-xl bg-gradient-to-r ${FUNNEL_BAR[stage.stage] || 'from-primary-500 to-primary-600'} flex items-center px-3 transition-all duration-700`}
                          style={{ width: `${Math.max(stage.percent, stage.count > 0 ? 6 : 0)}%` }}
                        >
                          <span className="text-xs font-extrabold text-white tabular-nums drop-shadow-sm">
                            {stage.count}
                          </span>
                        </div>
                      </div>
                      {stage.drop_off !== null && stage.drop_off > 0 && (
                        <p className="text-xs text-surface-400 mt-1">
                          <span className="tabular-nums font-semibold text-surface-500">{stage.drop_off}</span> dropped off at this step
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top listings + in-demand skills */}
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="glow-card p-6">
                <h3 className="dash-eyebrow block mb-1">Top performing listings</h3>
                <p className="text-sm text-surface-400 mb-5">By total applications received.</p>
                {analytics.top_listings.length === 0 ? (
                  <div className="dash-empty">
                    <p className="dash-empty-title">Nothing posted yet</p>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {analytics.top_listings.map((listing, i) => {
                      const max = analytics.top_listings[0].applicants || 1;
                      return (
                        <div key={`${listing.kind}-${listing.id}`}>
                          <div className="flex items-baseline justify-between gap-3 mb-1">
                            <Link
                              to={listing.kind === 'job' ? `/jobs/${listing.id}` : `/internships/${listing.id}`}
                              className="text-sm font-bold text-surface-800 hover:text-primary-700 truncate transition-colors"
                            >
                              <span className="text-surface-300 tabular-nums mr-1.5">{i + 1}</span>
                              {listing.title}
                            </Link>
                            <span className="text-xs font-bold text-surface-500 tabular-nums shrink-0">
                              {listing.applicants}
                            </span>
                          </div>
                          <div className="track !h-2">
                            <div
                              className="track-fill track-fill-indigo"
                              style={{ width: `${(listing.applicants / max) * 100}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-surface-400 mt-1">
                            {listing.kind === 'job' ? 'Job' : 'Internship'} · {listing.location}
                            {listing.accepted > 0 && ` · ${listing.accepted} hired`}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="glow-card p-6">
                <h3 className="dash-eyebrow block mb-1">Skills most in demand</h3>
                <p className="text-sm text-surface-400 mb-5">What you ask for across your own listings.</p>
                {analytics.top_skills.length === 0 ? (
                  <div className="dash-empty">
                    <p className="dash-empty-title">No skills listed</p>
                    <p className="dash-empty-hint">Add required skills to your postings to see this.</p>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {analytics.top_skills.map(skill => {
                      const max = analytics.top_skills[0].count || 1;
                      return (
                        <div key={skill.skill}>
                          <div className="flex items-baseline justify-between gap-3 mb-1">
                            <span className="text-sm font-bold text-surface-800 truncate">{skill.skill}</span>
                            <span className="text-xs font-bold text-surface-500 tabular-nums shrink-0">
                              {skill.count} listing{skill.count === 1 ? '' : 's'}
                            </span>
                          </div>
                          <div className="track !h-2">
                            <div
                              className="track-fill track-fill-emerald"
                              style={{ width: `${(skill.count / max) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ---- Per-role performance ---- */}
        <div className="glow-card p-6 reveal" style={{ '--i': 5 } as React.CSSProperties}>
          <div className="flex flex-wrap items-baseline justify-between gap-3 mb-5">
            <div>
              <h2 className="dash-title">Role performance</h2>
              <p className="text-sm text-surface-400 mt-1">
                {roles.length > ROLE_LIMIT
                  ? `Your ${ROLE_LIMIT} busiest roles of ${roles.length}, unreviewed applicants first.`
                  : 'Unreviewed applicants first.'}
              </p>
            </div>
            <Link to="/recruiter/jobs" className="text-sm font-semibold text-primary-600 hover:text-primary-700 link-hover">
              Manage all
            </Link>
          </div>

          {roles.length === 0 ? (
            <div className="dash-empty !p-10">
              <p className="dash-empty-title">You haven't posted anything yet</p>
              <p className="dash-empty-hint">Your jobs and internships will be listed here with their applicant counts.</p>
              <Link to="/recruiter/post-job" className="btn-secondary !py-2 !px-4 !text-sm mt-5 inline-block">Post your first role</Link>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="dash-table dash-table-flush">
                <thead>
                  <tr>
                    <th>Role</th>
                    <th className="!text-right">Applicants</th>
                    <th className="!text-right">New</th>
                    <th className="!text-right">Shortlisted</th>
                    <th className="!text-right">Hired</th>
                    <th className="!text-right">Closes</th>
                  </tr>
                </thead>
                <tbody>
                  {topRoles.map(role => (
                    <tr key={`${role.kind}-${role.id}`}>
                      <td>
                        <Link
                          to={role.kind === 'job' ? `/jobs/${role.id}` : `/internships/${role.id}`}
                          className="group/role block min-w-0"
                        >
                          <span className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${role.is_active ? 'bg-emerald-400' : 'bg-surface-300'}`}></span>
                            <span className="font-bold text-surface-900 truncate transition-colors group-hover/role:text-primary-700">
                              {role.title}
                            </span>
                          </span>
                          <span className="block text-xs text-surface-400 mt-0.5 pl-3.5 truncate">
                            {role.kind === 'job' ? 'Job' : 'Internship'} · {role.location}
                          </span>
                        </Link>
                      </td>
                      <td className="text-right font-semibold tabular-nums">{role.applicants}</td>
                      <td className="text-right tabular-nums">
                        {role.new_applicants > 0 ? (
                          <span className="chip bg-amber-50 text-amber-700 ring-1 ring-amber-200">{role.new_applicants}</span>
                        ) : (
                          <span className="text-surface-300">—</span>
                        )}
                      </td>
                      <td className="text-right tabular-nums">
                        {role.shortlisted || <span className="text-surface-300">—</span>}
                      </td>
                      <td className="text-right tabular-nums whitespace-nowrap">
                        <span className={role.accepted >= role.openings ? 'font-bold text-emerald-600' : ''}>
                          {role.accepted}
                        </span>
                        <span className="text-surface-300"> / {role.openings}</span>
                      </td>
                      <td className="text-right whitespace-nowrap">
                        {role.days_left === null ? (
                          <span className="text-surface-300">—</span>
                        ) : role.expired ? (
                          <span className={`chip ${role.is_active ? 'bg-red-50 text-red-600 ring-1 ring-red-200' : 'chip-idle'}`}>
                            {role.is_active ? 'Overdue' : 'Closed'}
                          </span>
                        ) : (
                          <span className={`text-xs font-semibold tabular-nums ${role.days_left <= 7 ? 'text-amber-600' : 'text-surface-500'}`}>
                            {role.days_left}d
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ---- Employer brand + quick actions ---- */}
        <div className="grid lg:grid-cols-[1fr,1.35fr] gap-6">
          <div className="glow-card p-6 reveal" style={{ '--i': 6 } as React.CSSProperties}>
            <h2 className="dash-eyebrow block mb-5">Company profile</h2>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6">
              <ProgressRing
                percent={completion.percent}
                size={116}
                thickness={12}
                from="#6366f1"
                to={completion.percent === 100 ? '#34d399' : '#d946ef'}
                glow={completion.percent === 100 ? '#34d399' : '#6366f1'}
              />
              <div className="min-w-0 flex-1">
                {completion.missing.length > 0 ? (
                  <p className="text-sm text-surface-500 leading-relaxed">
                    Candidates see this before they apply. Still missing:{' '}
                    <span className="text-surface-800 font-semibold">{completion.missing.join(', ')}</span>
                  </p>
                ) : (
                  <p className="text-sm text-emerald-600 font-semibold">Your company profile is complete.</p>
                )}
                <Link to="/recruiter/company" className="btn-secondary !py-2 !px-4 !text-sm mt-4 inline-block">
                  {completion.percent === 100 ? 'View company profile' : 'Complete profile'}
                </Link>
              </div>
            </div>
          </div>

          <div className="reveal" style={{ '--i': 7 } as React.CSSProperties}>
            <div className="mb-4">
              <h2 className="dash-title">Quick actions</h2>
              <p className="text-sm text-surface-400 mt-1">The things you'll do most often.</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              {QUICK_ACTIONS.map((a, i) => (
                <Link
                  key={a.to}
                  to={a.to}
                  style={{ '--i': i } as React.CSSProperties}
                  className="reveal glow-card shine group p-5"
                >
                  <span className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${a.gradient} flex items-center justify-center shadow-lg ${a.glow} transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3`}>
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={a.d} />
                    </svg>
                  </span>
                  <span className="block font-bold text-surface-900 mt-4 group-hover:text-primary-700 transition-colors">
                    {a.label}
                  </span>
                  <span className="block text-xs text-surface-400 mt-1">{a.hint}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecruiterDashboard;
