import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { internshipsAPI } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import PageHero from '../../components/ui/PageHero';
import MatchRing from '../../components/ui/MatchRing';
import useSeo from '../../hooks/useSeo';

interface Internship {
  id: number;
  title: string;
  company: { id: number; name: string };
  internship_type: string;
  location: string;
  stipend: string;
  duration: string;
  skills_required: { id: number; name: string }[];
  created_at: string;
  match_score?: number | null;
}

const TYPES = ['Full-time', 'Part-time', 'Remote', 'On-site'];
// LinkedIn-style tabs: "All" plus one tab per internship type.
const TABS = ['All', ...TYPES];

const InternshipList: React.FC = () => {
  useSeo({
    title: 'Internships',
    description: 'Browse open internships from companies hiring students, with stipend, duration and an explainable match score for each.',
  });
  const { isStudent } = useAuth();
  const [search, setSearch] = useState('');
  // Single-select type tab ("All" = no filter), synced to ?type= in the URL
  // so filters are shareable and survive the back button. Case-insensitive.
  const [searchParams, setSearchParams] = useSearchParams();
  const rawType = searchParams.get('type') ?? '';
  const activeTab =
    TABS.find(t => t.toLowerCase() === rawType.toLowerCase()) ?? 'All';
  const [stipendFilter, setStipendFilter] = useState('');
  const selectedTypes = activeTab === 'All' ? [] : [activeTab];

  const { data, isLoading, isFetching } = useQuery<{ results?: Internship[]; [key: string]: unknown }>({
    queryKey: ['internships', search, selectedTypes, stipendFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (search) params.q = search;
      if (selectedTypes.length) params.type = selectedTypes.join(',');
      if (stipendFilter) params.stipend = stipendFilter;
      const r = await internshipsAPI.list(params);
      return r.data;
    },
    placeholderData: (prev) => prev,
  });

  const internships: Internship[] = data?.results ?? (data && Array.isArray(data) ? data : []);

  const selectTab = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'All') next.delete('type');
    else next.set('type', tab);
    setSearchParams(next, { replace: false });
  };

  const hasFilters = !!search || activeTab !== 'All' || !!stipendFilter;

  return (
    <div className="pb-20">
      <PageHero
        center
        eyebrow={internships.length > 0 ? `${internships.length} opportunit${internships.length === 1 ? 'y' : 'ies'}` : 'Internships'}
        live
        title="Kickstart your"
        accent="career"
        subtitle="Paid and unpaid internships from companies hiring right now — filtered the way you want to work."
      >
        <div className="mt-9 max-w-3xl mx-auto">
          <div className="relative">
            <svg className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search internships"
              className="w-full pl-14 pr-5 py-4 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 text-white placeholder-white/40 text-base transition-all duration-200 focus:outline-none focus:bg-white/15 focus:border-white/40 focus:ring-4 focus:ring-white/10"
              placeholder="Search internships by title, company, or location…"
            />
          </div>

          <div role="group" aria-label="Filter internships" className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {TABS.map(tab => {
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
            <span className="w-px h-6 bg-white/20 mx-1.5" aria-hidden="true"></span>
            {['paid', 'unpaid'].map(s => (
              <button
                key={s}
                onClick={() => setStipendFilter(stipendFilter === s ? '' : s)}
                aria-pressed={stipendFilter === s}
                className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all duration-200 ${
                  stipendFilter === s
                    ? 'bg-emerald-400 text-surface-900 shadow-lg'
                    : 'bg-white/10 text-white/70 border border-white/15 backdrop-blur hover:bg-white/20 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </PageHero>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-surface-200 space-y-4">
                <div className="skeleton h-12 w-12 rounded-2xl"></div>
                <div className="skeleton h-5 w-3/4"></div>
                <div className="skeleton h-4 w-1/2"></div>
                <div className="flex gap-2">
                  <div className="skeleton h-6 w-20 rounded-full"></div>
                  <div className="skeleton h-6 w-16 rounded-full"></div>
                </div>
              </div>
            ))}
          </div>
        ) : internships.length === 0 ? (
          <div className="glow-card p-16 text-center animate-fade-in">
            <div className="w-20 h-20 bg-surface-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-surface-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-surface-900 mb-2">No internships found</h3>
            <p className="text-surface-500 text-sm">
              {search ? `Nothing matches “${search}”.` : 'Try adjusting your filters.'}
            </p>
            {hasFilters && (
              <button
                onClick={() => { setSearch(''); setStipendFilter(''); selectTab('All'); }}
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
                <span className="font-extrabold text-surface-900 tabular-nums">{internships.length}</span> internship{internships.length === 1 ? '' : 's'}
                {activeTab !== 'All' && <span className="text-surface-400"> · {activeTab}</span>}
                {stipendFilter && <span className="text-surface-400"> · {stipendFilter}</span>}
              </p>
              {isFetching && !isLoading && (
                <span className="text-xs text-surface-400 flex items-center gap-1.5">
                  <span className="spinner-gradient !w-3.5 !h-3.5"></span>
                  Refreshing…
                </span>
              )}
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {internships.map((intern, i) => (
                <Link
                  key={intern.id}
                  to={`/internships/${intern.id}`}
                  style={{ '--i': i } as React.CSSProperties}
                  className="reveal glow-card shine group p-6 flex flex-col"
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 text-white text-lg font-extrabold flex items-center justify-center shadow-lg shadow-primary-500/20 transition-transform duration-300 group-hover:scale-105">
                      {(intern.company?.name || '?').charAt(0).toUpperCase()}
                    </span>
                    {isStudent && typeof intern.match_score === 'number' ? (
                      <MatchRing score={intern.match_score} size={44} />
                    ) : (
                      <span className="chip chip-done">{intern.internship_type}</span>
                    )}
                  </div>

                  <h3 className="font-bold text-surface-900 leading-snug group-hover:text-primary-700 transition-colors line-clamp-2">
                    {intern.title}
                  </h3>
                  <p className="text-sm text-surface-500 mt-1">{intern.company?.name}</p>

                  <div className="flex items-center gap-4 mt-3 text-xs text-surface-400 font-medium flex-1">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="truncate">{intern.location}</span>
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {intern.duration}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-surface-100">
                    <span className="text-sm font-extrabold text-emerald-600">{intern.stipend}</span>
                    <span className="text-sm font-semibold text-primary-600 group-hover:translate-x-0.5 transition-transform">
                      Details →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default InternshipList;
