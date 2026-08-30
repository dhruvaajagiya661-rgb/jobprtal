import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { studentAPI } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { extractApiError } from '../../utils/errors';
import { completionFromProfile } from '../../utils/profileCompletion';
import PageHero from '../../components/ui/PageHero';
import AreaChart from '../../components/charts/AreaChart';
import ProgressRing from '../../components/charts/ProgressRing';
import useSeo from '../../hooks/useSeo';

interface ApplicationItem {
  id: number;
  job: { id: number; title: string; company: { name: string }; salary?: string; location?: string } | null;
  internship: { id: number; title: string; company: { name: string }; stipend?: string; location?: string } | null;
  status: string;
  applied_at: string;
}

interface DashboardData {
  profile: Record<string, unknown>;
  applications: ApplicationItem[];
  applications_count: number;
  pending_count: number;
  shortlisted_count: number;
  rejected_count: number;
  accepted_count: number;
  monthly_activity: { month: string; count: number }[];
  recommended_jobs: { id: number; title: string; company: { name: string }; salary: string; location: string }[];
  recommended_internships: { id: number; title: string; company: { name: string }; stipend: string; location: string }[];
}

const STATUS_BADGE: Record<string, string> = {
  Accepted: 'badge-success',
  Shortlisted: 'badge-primary',
  Rejected: 'badge-danger',
};

// The hiring pipeline, in the order an application actually moves through it.
const FUNNEL = [
  { key: 'pending_count', label: 'Pending', dot: 'bg-amber-400', bar: 'track-fill-amber' },
  { key: 'shortlisted_count', label: 'Shortlisted', dot: 'bg-indigo-400', bar: 'track-fill-indigo' },
  { key: 'accepted_count', label: 'Accepted', dot: 'bg-emerald-400', bar: 'track-fill-emerald' },
  { key: 'rejected_count', label: 'Rejected', dot: 'bg-red-400', bar: 'track-fill-violet' },
] as const;

const StudentDashboard: React.FC = () => {
  useSeo({ title: 'Student dashboard', noIndex: true });
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboard = () => {
    setLoading(true);
    setError('');
    studentAPI.dashboard()
      .then(r => setData(r.data))
      .catch(err => setError(extractApiError(err, 'Could not load your dashboard. Please try again.')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchDashboard(); }, []);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
        <div className="spinner-gradient !w-11 !h-11 !border-[3px]"></div>
        <p className="text-sm text-surface-400 font-medium animate-pulse">Loading your dashboard…</p>
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

  const completion = completionFromProfile(data.profile);
  const hasResume = !!data.profile?.resume;
  const activity = (data.monthly_activity ?? []).map(m => ({ label: m.month, value: m.count }));
  const activityTotal = activity.reduce((sum, p) => sum + p.value, 0);
  const total = data.applications_count || 0;
  // Of the applications that have moved past "pending", how many went forward.
  const decided = data.shortlisted_count + data.accepted_count + data.rejected_count;
  const successRate = decided ? Math.round(((data.shortlisted_count + data.accepted_count) / decided) * 100) : 0;

  const KPIS = [
    { value: total, label: 'Applications' },
    { value: data.pending_count, label: 'In review' },
    { value: data.shortlisted_count, label: 'Shortlisted' },
    { value: data.accepted_count, label: 'Offers' },
  ];

  return (
    <div className="pb-20">
      <PageHero
        eyebrow="Your workspace"
        live
        title="Welcome back,"
        accent={user?.username}
        subtitle={
          total > 0
            ? `You have ${data.pending_count} application${data.pending_count === 1 ? '' : 's'} in review and ${activityTotal} sent in the last 12 months.`
            : 'Your hiring pipeline starts here. Browse roles, apply, and track every stage in one place.'
        }
        aside={
          <div className="grid grid-cols-2 gap-3">
            {KPIS.map(k => (
              <div key={k.label} className="kpi">
                <p className="kpi-value">{k.value}</p>
                <p className="kpi-label">{k.label}</p>
              </div>
            ))}
          </div>
        }
      >
        <div className="flex flex-wrap gap-3 mt-8">
          <Link to="/jobs" className="btn-primary">Browse jobs</Link>
          <Link
            to="/student/applications/board"
            className="px-6 py-2.5 rounded-xl font-semibold text-white bg-white/10 border border-white/20 backdrop-blur hover:bg-white/20 transition-all duration-200 hover:-translate-y-0.5"
          >
            Application board
          </Link>
          <Link
            to="/careers/skill-gap"
            className="px-6 py-2.5 rounded-xl font-semibold text-white bg-white/10 border border-white/20 backdrop-blur hover:bg-white/20 transition-all duration-200 hover:-translate-y-0.5"
          >
            Skill gap analysis
          </Link>
        </div>
      </PageHero>

      <div className="dash-shell !max-w-6xl pt-10 dash-stack">
        {/* ---- Profile readiness + pipeline ---- */}
        <div className="grid lg:grid-cols-[1fr,1.2fr] gap-6">
          <div className="glow-card p-6 reveal" style={{ '--i': 0 } as React.CSSProperties}>
            <h2 className="dash-eyebrow block mb-5">Profile readiness</h2>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6">
              <ProgressRing
                percent={completion.percent}
                size={132}
                thickness={13}
                from="#6366f1"
                to={completion.percent === 100 ? '#34d399' : '#d946ef'}
                glow={completion.percent === 100 ? '#34d399' : '#6366f1'}
              />
              <div className="min-w-0 flex-1">
                <span className={hasResume ? 'chip chip-done' : 'chip bg-red-50 text-red-600 ring-1 ring-red-200'}>
                  {hasResume ? 'Resume uploaded' : 'No resume yet'}
                </span>
                {completion.missing.length > 0 ? (
                  <p className="text-sm text-surface-500 mt-3 leading-relaxed">
                    Still missing:{' '}
                    <span className="text-surface-800 font-semibold">{completion.missing.join(', ')}</span>
                  </p>
                ) : (
                  <p className="text-sm text-emerald-600 font-semibold mt-3">Your profile is complete.</p>
                )}
                <Link to="/student/profile" className="btn-secondary !py-2 !px-4 !text-sm mt-4 inline-block">
                  {completion.percent === 100 ? 'View profile' : 'Complete profile'}
                </Link>
              </div>
            </div>
          </div>

          <div className="glow-card p-6 reveal" style={{ '--i': 1 } as React.CSSProperties}>
            <div className="flex items-baseline justify-between mb-6">
              <h2 className="dash-eyebrow">Your pipeline</h2>
              {decided > 0 && (
                <span className="text-xs font-semibold text-surface-500">
                  <span className="text-emerald-600 font-extrabold tabular-nums">{successRate}%</span> moved forward
                </span>
              )}
            </div>

            {total === 0 ? (
              <div className="dash-empty">
                <p className="dash-empty-title">No applications yet</p>
                <p className="dash-empty-hint">Apply to your first role and it will show up here.</p>
                <Link to="/jobs" className="btn-secondary !py-2 !px-4 !text-sm mt-5 inline-block">Find a role</Link>
              </div>
            ) : (
              <div className="space-y-5">
                {FUNNEL.map((stage, i) => {
                  const value = data[stage.key] as number;
                  const pct = total ? Math.round((value / total) * 100) : 0;
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
            )}
          </div>
        </div>

        {/* ---- Activity over time (data the dashboard already fetched but never showed) ---- */}
        <div className="glow-card p-6 reveal" style={{ '--i': 2 } as React.CSSProperties}>
          <div className="flex flex-wrap items-baseline justify-between gap-3 mb-6">
            <div>
              <h2 className="dash-title">Application activity</h2>
              <p className="text-sm text-surface-400 mt-1">Applications you sent, month by month.</p>
            </div>
            <span className="flex items-baseline gap-1.5 text-sm font-semibold text-surface-500 whitespace-nowrap">
              <span className="text-2xl font-extrabold text-surface-900 tabular-nums">{activityTotal}</span>
              in 12 months
            </span>
          </div>
          <AreaChart data={activity} height={190} unit=" applications" />
        </div>

        {/* ---- Recent applications ---- */}
        <div className="glow-card p-6 reveal" style={{ '--i': 3 } as React.CSSProperties}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="dash-title">Recent applications</h2>
            <Link to="/student/applications" className="text-sm font-semibold text-primary-600 hover:text-primary-700 link-hover">
              View all
            </Link>
          </div>

          {data.applications.length === 0 ? (
            <div className="dash-empty">
              <p className="dash-empty-title">Nothing here yet</p>
              <p className="dash-empty-hint">Your applications will appear as you send them.</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-100">
              {data.applications.slice(0, 5).map((app, i) => {
                const title = app.job?.title || app.internship?.title || 'Application';
                const company = app.job?.company?.name || app.internship?.company?.name || '—';
                const href = app.job ? `/jobs/${app.job.id}` : app.internship ? `/internships/${app.internship.id}` : null;
                const row = (
                  <>
                    <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 text-white font-extrabold flex items-center justify-center shrink-0 shadow-sm shadow-primary-500/25 transition-transform duration-300 group-hover/row:scale-105">
                      {company.charAt(0).toUpperCase()}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-bold text-surface-900 truncate transition-colors group-hover/row:text-primary-700">{title}</span>
                      <span className="block text-sm text-surface-500 truncate">{company}</span>
                    </span>
                    <span className={`badge ${STATUS_BADGE[app.status] || 'badge-warning'} shrink-0`}>{app.status}</span>
                    <span className="text-xs text-surface-400 tabular-nums shrink-0 hidden sm:block w-24 text-right">
                      {new Date(app.applied_at).toLocaleDateString()}
                    </span>
                  </>
                );
                return (
                  <div key={app.id} className="reveal" style={{ '--i': i } as React.CSSProperties}>
                    {href ? (
                      <Link to={href} className="group/row flex items-center gap-4 py-3.5 px-3 -mx-3 rounded-xl transition-colors hover:bg-surface-50">
                        {row}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-4 py-3.5 px-3">{row}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ---- Recommendations ---- */}
        {data.recommended_jobs?.length > 0 && (
          <div className="reveal" style={{ '--i': 4 } as React.CSSProperties}>
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <h2 className="dash-title">Recommended for you</h2>
                <p className="text-sm text-surface-400 mt-1">Matched against the skills on your profile.</p>
              </div>
              <Link to="/jobs" className="text-sm font-semibold text-primary-600 hover:text-primary-700 link-hover">See all jobs</Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.recommended_jobs.map((job, i) => (
                <Link
                  key={job.id}
                  to={`/jobs/${job.id}`}
                  style={{ '--i': i } as React.CSSProperties}
                  className="reveal glow-card shine p-5 group"
                >
                  <div className="flex items-start gap-3">
                    <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 text-white font-extrabold flex items-center justify-center shrink-0 shadow-sm">
                      {(job.company?.name || '?').charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-bold text-surface-900 leading-snug group-hover:text-primary-700 transition-colors line-clamp-2">
                        {job.title}
                      </span>
                      <span className="block text-sm text-surface-500 truncate mt-0.5">{job.company?.name}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-surface-100">
                    <span className="text-sm font-extrabold text-primary-600">{job.salary}</span>
                    <span className="text-xs text-surface-400 font-medium truncate ml-2">{job.location}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {data.recommended_internships?.length > 0 && (
          <div className="reveal" style={{ '--i': 5 } as React.CSSProperties}>
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <h2 className="dash-title">Internships worth a look</h2>
                <p className="text-sm text-surface-400 mt-1">Shorter commitments matched to the same skills.</p>
              </div>
              <Link to="/internships" className="text-sm font-semibold text-primary-600 hover:text-primary-700 link-hover">
                See all internships
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.recommended_internships.map((intern, i) => (
                <Link
                  key={intern.id}
                  to={`/internships/${intern.id}`}
                  style={{ '--i': i } as React.CSSProperties}
                  className="reveal glow-card shine p-5 group"
                >
                  <div className="flex items-start gap-3">
                    <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white font-extrabold flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/25">
                      {(intern.company?.name || '?').charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-bold text-surface-900 leading-snug group-hover:text-primary-700 transition-colors line-clamp-2">
                        {intern.title}
                      </span>
                      <span className="block text-sm text-surface-500 truncate mt-0.5">{intern.company?.name}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-surface-100">
                    <span className="text-sm font-extrabold text-emerald-600">{intern.stipend}</span>
                    <span className="text-xs text-surface-400 font-medium truncate ml-2">{intern.location}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;
