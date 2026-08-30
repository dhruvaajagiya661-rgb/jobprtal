import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { jobsAPI } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import PageHero from '../../components/ui/PageHero';
import MatchRing from '../../components/ui/MatchRing';
import useSeo from '../../hooks/useSeo';

interface Job {
  id: number;
  title: string;
  company: { id: number; name: string; logo?: string; location: string };
  category: { id: number; name: string };
  job_type: string;
  location: string;
  salary: string;
  experience_required: string;
  skills_required: { id: number; name: string }[];
  deadline: string;
  created_at: string;
  match_score?: number | null;
}

interface JobsResponse {
  count: number;
  results?: Job[];
}

const JOB_TYPES = ['Full-time', 'Part-time', 'Remote', 'On-site'];
// LinkedIn-style tabs: "All" plus one tab per job type.
const JOB_TABS = ['All', ...JOB_TYPES];

const PAGE_SIZE = 20;

const JobList: React.FC = () => {
  useSeo({
    title: 'Jobs',
    description: 'Browse open graduate and entry-level jobs, filter by skills, location and type, and see how well each one matches your profile.',
  });
  const { isStudent } = useAuth();
  const [search, setSearch] = useState('');
  // Single-select type tab ("All" = no filter), synced to ?type= in the URL
  // so filters are shareable and survive the back button. Case-insensitive.
  const [searchParams, setSearchParams] = useSearchParams();
  const rawType = searchParams.get('type') ?? '';
  const activeTab =
    JOB_TABS.find(t => t.toLowerCase() === rawType.toLowerCase()) ?? 'All';
  const [currentPage, setCurrentPage] = useState(1);
  const selectedTypes = activeTab === 'All' ? [] : [activeTab];

  const { data, isLoading, isFetching } = useQuery<JobsResponse>({
    queryKey: ['jobs', currentPage, search, selectedTypes],
    queryFn: async () => {
      const params: Record<string, string> = { page: String(currentPage) };
      if (search) params.q = search;
      if (selectedTypes.length) params.job_type = selectedTypes.join(',');
      const r = await jobsAPI.list(params);
      return r.data;
    },
    placeholderData: (prev) => prev, // keep last list during refetch
  });

  const jobs = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const selectTab = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'All') next.delete('type');
    else next.set('type', tab);
    setSearchParams(next, { replace: false });
    setCurrentPage(1);
  };

  return (
    <div className="pb-20">
      <PageHero
        center
        eyebrow={totalCount > 0 ? `${totalCount} open role${totalCount === 1 ? '' : 's'}` : 'Opportunities'}
        live
        title="Find your dream"
        accent="job"
        subtitle="Search by title, company or location — then filter down to the way you want to work."
      >
        {/* Search + filters live inside the hero so the first thing you see is
            the thing you came to do. */}
        <div className="mt-9 max-w-3xl mx-auto">
          <div className="relative">
            <svg className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              id="job-search"
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              aria-label="Search jobs"
              className="w-full pl-14 pr-5 py-4 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 text-white placeholder-white/40 text-base transition-all duration-200 focus:outline-none focus:bg-white/15 focus:border-white/40 focus:ring-4 focus:ring-white/10"
              placeholder="Search jobs by title, company, or location…"
            />
          </div>

          <div role="group" aria-label="Filter jobs by type" className="mt-4 flex flex-wrap justify-center gap-2">
            {JOB_TABS.map(tab => {
              const isActive = tab === activeTab;
              return (
                <button
                  key={tab}
                  onClick={() => selectTab(tab)}
                  aria-pressed={isActive}
                  className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-white text-surface-900 shadow-lg'
                      : 'bg-white/10 text-white/70 border border-white/15 backdrop-blur hover:bg-white/20 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>
      </PageHero>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-surface-200">
                <div className="flex items-start gap-4">
                  <div className="skeleton h-14 w-14 rounded-2xl flex-shrink-0"></div>
                  <div className="flex-1 space-y-3">
                    <div className="skeleton h-5 w-3/4"></div>
                    <div className="skeleton h-4 w-1/2"></div>
                    <div className="flex gap-2">
                      <div className="skeleton h-6 w-20 rounded-full"></div>
                      <div className="skeleton h-6 w-24 rounded-full"></div>
                    </div>
                  </div>
                  <div className="text-right space-y-2">
                    <div className="skeleton h-5 w-24"></div>
                    <div className="skeleton h-4 w-16"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="glow-card p-16 text-center animate-fade-in">
            <div className="w-20 h-20 bg-surface-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-surface-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-surface-900 mb-2">No jobs found</h3>
            <p className="text-surface-500 text-sm">
              {search ? `Nothing matches “${search}”.` : 'Try adjusting your filters.'}
            </p>
            {(search || activeTab !== 'All') && (
              <button
                onClick={() => { setSearch(''); selectTab('All'); }}
                className="btn-secondary !py-2 !px-4 !text-sm mt-6"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-surface-500">
                <span className="font-extrabold text-surface-900 tabular-nums">{totalCount}</span> job{totalCount === 1 ? '' : 's'} found
                {activeTab !== 'All' && <span className="text-surface-400"> · {activeTab}</span>}
              </p>
              {isFetching && !isLoading && (
                <span className="text-xs text-surface-400 flex items-center gap-1.5">
                  <span className="spinner-gradient !w-3.5 !h-3.5"></span>
                  Refreshing…
                </span>
              )}
            </div>

            <div className="space-y-4">
              {jobs.map((job, i) => (
                <Link
                  key={job.id}
                  to={`/jobs/${job.id}`}
                  style={{ '--i': i } as React.CSSProperties}
                  className="reveal glow-card shine group flex flex-col md:flex-row md:items-center gap-5 p-6"
                >
                  <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/20 text-white text-xl font-extrabold transition-transform duration-300 group-hover:scale-105">
                    {(job.company?.name || '?').charAt(0).toUpperCase()}
                  </span>

                  <span className="flex-1 min-w-0">
                    <span className="block text-lg font-bold text-surface-900 group-hover:text-primary-700 transition-colors leading-snug">
                      {job.title}
                    </span>
                    <span className="block text-sm text-surface-500 mt-0.5">
                      {job.company?.name} · {job.location}
                    </span>
                    <span className="flex flex-wrap gap-2 mt-3">
                      <span className="chip bg-primary-50 text-primary-700 ring-1 ring-primary-200/70">{job.job_type}</span>
                      {job.skills_required?.slice(0, 3).map(s => (
                        <span key={s.id} className="chip chip-idle">{s.name}</span>
                      ))}
                      {job.skills_required?.length > 3 && (
                        <span className="chip chip-idle">+{job.skills_required.length - 3}</span>
                      )}
                    </span>
                  </span>

                  <span className="flex flex-row md:flex-col items-center md:items-end gap-4 md:gap-2 flex-shrink-0">
                    {isStudent && typeof job.match_score === 'number' && <MatchRing score={job.match_score} />}
                    <span className="text-lg font-extrabold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">
                      {job.salary}
                    </span>
                    {job.experience_required && (
                      <span className="text-xs text-surface-400 font-medium">{job.experience_required}</span>
                    )}
                  </span>
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-12">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-5 py-2.5 text-sm font-semibold text-surface-600 bg-white border border-surface-300 rounded-xl hover:bg-surface-50 hover:border-surface-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {[currentPage - 1, currentPage, currentPage + 1]
                    .filter(p => p > 0 && p <= totalPages)
                    .map(p => (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        aria-current={p === currentPage ? 'page' : undefined}
                        className={`w-10 h-10 text-sm font-bold rounded-xl transition-all tabular-nums ${
                          p === currentPage
                            ? 'bg-gradient-to-r from-primary-600 to-accent-500 text-white shadow-lg shadow-primary-500/25'
                            : 'text-surface-600 hover:bg-surface-100'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-5 py-2.5 text-sm font-semibold text-surface-600 bg-white border border-surface-300 rounded-xl hover:bg-surface-50 hover:border-surface-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default JobList;
