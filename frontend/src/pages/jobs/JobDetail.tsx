import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { jobsAPI, applicationsAPI, studentAPI } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { extractApiError } from '../../utils/errors';
import { useToast } from '../../context/ToastContext';
import MatchRing from '../../components/ui/MatchRing';
import useSeo from '../../hooks/useSeo';

interface JobDetail {
  id: number;
  title: string;
  company: { id: number; name: string; logo?: string; description: string; industry: string; location: string; website: string };
  recruiter: { id: number; name: string; designation: string } | null;
  category: { id: number; name: string };
  job_type: string;
  description: string;
  requirements: string;
  location: string;
  salary: string;
  experience_required: string;
  skills_required: { id: number; name: string }[];
  preferred_skills: { id: number; name: string }[];
  deadline: string;
  openings: number;
  created_at: string;
  is_active: boolean;
  has_applied: boolean;
  match_score?: number | null;
  match_breakdown?: MatchBreakdown | null;
}

interface MatchComponent {
  label: string;
  max_points: number;
  points: number;
  detail: string;
}

interface MatchBreakdown {
  score: number;
  verdict: string;
  matched_skills: string[];
  missing_skills: string[];
  matched_preferred_skills: string[];
  missing_preferred_skills: string[];
  components: MatchComponent[];
}

const JobDetail: React.FC = () => {
  const toast = useToast();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, isStudent } = useAuth();
  const [applying, setApplying] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const jobId = Number(id);

  const { data: job, isLoading, isError } = useQuery<JobDetail>({
    queryKey: ['job', jobId],
    queryFn: async () => (await jobsAPI.detail(jobId)).data,
    enabled: Number.isFinite(jobId) && jobId > 0,
  });

  // A job page is the most-shared and most-indexed URL on the site, so it gets
  // the role and company in the title rather than the generic site default.
  useSeo({
    title: job ? `${job.title} at ${job.company?.name ?? 'PortAL'}` : 'Job',
    description: job
      ? `${job.title} at ${job.company?.name} in ${job.location}. ${job.job_type}. Apply on PortAL and see how well the role matches your profile.`
      : undefined,
  });

  // If the job can't be loaded (deleted / private), bounce back to the list.
  useEffect(() => {
    if (isError && !isLoading) {
      navigate('/jobs', { replace: true });
    }
  }, [isError, isLoading, navigate]);

  const handleApply = async () => {
    if (!resumeFile) {
      setError('Please upload your resume');
      return;
    }
    setApplying(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('job_id', String(jobId));
      formData.append('resume', resumeFile);
      await applicationsAPI.apply(formData);
      // Update cache so the UI reflects the applied state without a reload.
      queryClient.setQueryData<JobDetail>(['job', jobId], (old) => old ? { ...old, has_applied: true } : old);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Application sent');
    } catch (err: unknown) {
      setError(extractApiError(err, 'Application failed'));
    } finally {
      setApplying(false);
    }
  };

  const handleSaveJob = async () => {
    try {
      await studentAPI.saveJob(jobId);
      setSaved(true);
      toast.success('Job saved to your list');
    } catch (err) {
      toast.error(extractApiError(err, 'Failed to save job'));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
        <div className="spinner-gradient !w-11 !h-11 !border-[3px]"></div>
        <p className="text-sm text-surface-400 font-medium animate-pulse">Loading role…</p>
      </div>
    );
  }
  if (!job) return null;

  const applied = job.has_applied;
  const breakdown = job.match_breakdown;
  const monogram = (job.company?.name || '?').charAt(0).toUpperCase();

  const FACTS = [
    { label: 'Category', value: job.category?.name || '—' },
    { label: 'Openings', value: String(job.openings) },
    { label: 'Deadline', value: job.deadline || '—' },
    { label: 'Posted', value: new Date(job.created_at).toLocaleDateString() },
  ];

  return (
    <div className="pb-20">
      {/* ===================== HERO ===================== */}
      <section className="relative overflow-hidden mesh-hero mesh-animate grain">
        <div className="absolute inset-0 grid-lines"></div>
        <div className="absolute -top-24 -left-16 w-80 h-80 bg-primary-500/20 rounded-full blur-3xl animate-float"></div>
        <div className="absolute -bottom-28 right-0 w-96 h-96 bg-accent-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '-2.5s' }}></div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-14">
          <Link to="/jobs" className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/50 hover:text-white/90 transition-colors mb-8">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to jobs
          </Link>

          <div className="flex flex-col md:flex-row md:items-start gap-6 animate-fade-in-up">
            <span className="w-20 h-20 rounded-3xl bg-white/10 border border-white/20 backdrop-blur-xl flex items-center justify-center text-3xl font-extrabold text-white shrink-0 shadow-2xl">
              {monogram}
            </span>

            <div className="flex-1 min-w-0">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.08]">
                {job.title}
              </h1>
              <p className="text-lg text-white/60 mt-2.5">
                {job.company?.name} · {job.location}
              </p>
              {/* The hiring contact, linked to their public profile — a name
                  candidates can look up before they apply. */}
              {job.recruiter && (
                <p className="text-sm text-white/45 mt-1.5">
                  Posted by{' '}
                  <Link
                    to={`/profile/recruiter/${job.recruiter.id}`}
                    className="font-semibold text-white/75 hover:text-white underline underline-offset-2 decoration-white/30 hover:decoration-white/70 transition-colors"
                  >
                    {job.recruiter.name}
                  </Link>
                  {job.recruiter.designation && ` · ${job.recruiter.designation}`}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-5">
                <span className="chip bg-white/10 text-white/80 border border-white/15 backdrop-blur">{job.job_type}</span>
                <span className="chip bg-emerald-400/15 text-emerald-300 border border-emerald-400/25 backdrop-blur">{job.salary}</span>
                {job.experience_required && (
                  <span className="chip bg-white/10 text-white/80 border border-white/15 backdrop-blur">{job.experience_required}</span>
                )}
                {!job.is_active && <span className="chip bg-red-400/15 text-red-300 border border-red-400/25">Closed</span>}
              </div>
            </div>

            {isStudent && typeof job.match_score === 'number' && (
              <div className="panel-dark px-6 py-5 text-center shrink-0 self-start">
                <p className="text-4xl font-extrabold text-white tabular-nums leading-none">{job.match_score}%</p>
                <p className="kpi-label !mt-2">Your match</p>
              </div>
            )}
          </div>
        </div>

        <svg className="relative z-10 block w-full h-[44px] text-surface-50" viewBox="0 0 1440 44" preserveAspectRatio="none" aria-hidden="true">
          <path fill="currentColor" d="M0,44 L0,20 C240,44 480,0 720,10 C960,20 1200,44 1440,24 L1440,44 Z" />
        </svg>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div className="grid lg:grid-cols-[1.7fr,1fr] gap-7 items-start">
          {/* ===================== MAIN ===================== */}
          <div className="space-y-6">
            <section className="glow-card p-7 reveal" style={{ '--i': 0 } as React.CSSProperties}>
              <h2 className="text-xs uppercase tracking-[0.14em] font-bold text-surface-400 mb-4">About the role</h2>
              <p className="text-surface-600 leading-relaxed whitespace-pre-line">{job.description}</p>
            </section>

            <section className="glow-card p-7 reveal" style={{ '--i': 1 } as React.CSSProperties}>
              <h2 className="text-xs uppercase tracking-[0.14em] font-bold text-surface-400 mb-4">Requirements</h2>
              <p className="text-surface-600 leading-relaxed whitespace-pre-line">{job.requirements}</p>
            </section>

            {(job.skills_required.length > 0 || job.preferred_skills?.length > 0) && (
              <section className="glow-card p-7 reveal" style={{ '--i': 2 } as React.CSSProperties}>
                <h2 className="text-xs uppercase tracking-[0.14em] font-bold text-surface-400 mb-5">Skills</h2>

                {job.skills_required.length > 0 && (
                  <>
                    <p className="text-sm font-bold text-surface-700 mb-3">Required</p>
                    <div className="flex flex-wrap gap-2">
                      {job.skills_required.map((s, i) => (
                        <span
                          key={s.id}
                          style={{ '--i': i } as React.CSSProperties}
                          className="reveal px-3 py-1.5 rounded-xl text-sm font-semibold text-primary-700 bg-gradient-to-br from-primary-50 to-accent-50 ring-1 ring-primary-200/70"
                        >
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </>
                )}

                {job.preferred_skills?.length > 0 && (
                  <>
                    <p className="text-sm font-bold text-surface-700 mt-6 mb-3">Nice to have</p>
                    <div className="flex flex-wrap gap-2">
                      {job.preferred_skills.map((s, i) => (
                        <span
                          key={s.id}
                          style={{ '--i': i } as React.CSSProperties}
                          className="reveal px-3 py-1.5 rounded-xl text-sm font-medium text-surface-600 bg-surface-100"
                        >
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}

            {/* Why this match? — turns the opaque score into next actions. */}
            {isStudent && breakdown && (
              <section className="glow-card p-7 reveal" style={{ '--i': 3 } as React.CSSProperties}>
                <div className="flex items-center gap-5 mb-6">
                  <MatchRing score={breakdown.score} size={72} />
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-surface-900">Why this match?</h2>
                    <p className="text-sm text-surface-500 mt-0.5">{breakdown.verdict}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {breakdown.components.map((c, i) => {
                    const pct = c.max_points ? (c.points / c.max_points) * 100 : 0;
                    return (
                      <div key={c.label} className="reveal" style={{ '--i': i } as React.CSSProperties}>
                        <div className="flex justify-between items-baseline mb-1.5">
                          <span className="text-sm font-semibold text-surface-700">{c.label}</span>
                          <span className="text-xs font-bold text-surface-400 tabular-nums">
                            {c.points}<span className="text-surface-300">/{c.max_points} pts</span>
                          </span>
                        </div>
                        <div className="track !h-2">
                          <div
                            className={`track-fill ${pct >= 70 ? 'track-fill-emerald' : pct >= 35 ? 'track-fill-amber' : 'track-fill-violet'}`}
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          ></div>
                        </div>
                        <p className="text-[11px] text-surface-400 mt-1.5">{c.detail}</p>
                      </div>
                    );
                  })}
                </div>

                {(breakdown.matched_skills.length > 0 || breakdown.missing_skills.length > 0) && (
                  <div className="grid sm:grid-cols-2 gap-6 mt-7 pt-6 border-t border-surface-100">
                    {breakdown.matched_skills.length > 0 && (
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] font-bold text-emerald-600 mb-3">
                          You have · {breakdown.matched_skills.length}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {breakdown.matched_skills.map(name => (
                            <span key={name} className="px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200/70">
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {breakdown.missing_skills.length > 0 && (
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] font-bold text-amber-600 mb-3">
                          To learn · {breakdown.missing_skills.length}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {breakdown.missing_skills.map(name => (
                            <span key={name} className="px-2.5 py-1 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 ring-1 ring-amber-200/70">
                              {name}
                            </span>
                          ))}
                        </div>
                        <Link to="/careers/skill-gap" className="inline-block text-xs font-bold text-primary-600 hover:text-primary-700 mt-3 link-hover">
                          Close this gap →
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>

          {/* ===================== SIDEBAR ===================== */}
          <div className="lg:sticky lg:top-24 space-y-5">
            {isAuthenticated && isStudent && (
              <div className="glow-card p-6">
                {applied ? (
                  <div className="text-center py-2">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/25">
                      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="font-bold text-surface-900">Application sent</p>
                    <p className="text-xs text-surface-400 mt-1.5">Track its progress on your board.</p>
                    <Link to="/student/applications/board" className="btn-secondary !py-2 !px-4 !text-sm mt-5 inline-block">
                      View board
                    </Link>
                  </div>
                ) : (
                  <>
                    <h3 className="font-bold text-surface-900 mb-1">Apply for this role</h3>
                    <p className="text-xs text-surface-400 mb-4">PDF, DOC or DOCX.</p>
                    {error && (
                      <p className="text-red-600 text-sm mb-3 px-3 py-2 rounded-lg bg-red-50 ring-1 ring-red-200/70">{error}</p>
                    )}
                    <label className="block cursor-pointer group">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={e => { setResumeFile(e.target.files?.[0] || null); setError(''); }}
                        className="sr-only"
                      />
                      <span className={`flex items-center gap-3 p-3.5 rounded-xl border-2 border-dashed transition-colors ${
                        resumeFile
                          ? 'border-emerald-300 bg-emerald-50/50'
                          : 'border-surface-200 group-hover:border-primary-300 group-hover:bg-primary-50/40'
                      }`}>
                        <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          resumeFile ? 'bg-emerald-500' : 'bg-surface-200 group-hover:bg-primary-500'
                        } transition-colors`}>
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-surface-800 truncate">
                            {resumeFile ? resumeFile.name : 'Upload your resume'}
                          </span>
                          <span className="block text-[11px] text-surface-400">
                            {resumeFile ? `${(resumeFile.size / 1024).toFixed(0)} KB · click to change` : 'Click to choose a file'}
                          </span>
                        </span>
                      </span>
                    </label>
                    <button onClick={handleApply} disabled={applying} className="btn-primary w-full mt-4">
                      {applying ? 'Sending…' : 'Apply now'}
                    </button>
                  </>
                )}
              </div>
            )}

            {isAuthenticated && isStudent && (
              <button onClick={handleSaveJob} disabled={saved} className="btn-secondary w-full disabled:opacity-60">
                <svg className="w-4 h-4 inline mr-1.5 -mt-0.5" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                {saved ? 'Saved' : 'Save job'}
              </button>
            )}

            {!isAuthenticated && (
              <div className="glow-card p-6 text-center">
                <p className="text-sm font-semibold text-surface-700">Sign in to apply</p>
                <p className="text-xs text-surface-400 mt-1.5 leading-relaxed">
                  Students can apply, save roles and see how well they match.
                </p>
                <Link to="/login" className="btn-primary !py-2 !px-4 !text-sm mt-5 inline-block">Sign in</Link>
              </div>
            )}

            <div className="glow-card p-6">
              <h3 className="text-xs uppercase tracking-[0.14em] font-bold text-surface-400 mb-4">At a glance</h3>
              <dl className="space-y-3">
                {FACTS.map(f => (
                  <div key={f.label} className="flex justify-between items-baseline gap-3 text-sm">
                    <dt className="text-surface-400">{f.label}</dt>
                    <dd className="font-bold text-surface-800 text-right truncate">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {job.company?.description && (
              <div className="glow-card p-6">
                <h3 className="text-xs uppercase tracking-[0.14em] font-bold text-surface-400 mb-3">About {job.company.name}</h3>
                <p className="text-sm text-surface-500 leading-relaxed line-clamp-5">{job.company.description}</p>
                {job.company.website && (
                  <a
                    href={job.company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-xs font-bold text-primary-600 hover:text-primary-700 mt-3 link-hover"
                  >
                    Visit website →
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobDetail;
