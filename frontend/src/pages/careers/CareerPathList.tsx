import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { careersAPI } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import PageHero from '../../components/ui/PageHero';
import useSeo from '../../hooks/useSeo';

interface CareerPath {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  avg_salary_min: number;
  avg_salary_max: number;
  growth_outlook: string;
  milestone_count: number;
  question_count: number;
}

const money = (n?: number) =>
  typeof n === 'number' ? `$${Math.round(n / 1000)}k` : 'N/A';

const CareerPathList: React.FC = () => {
  useSeo({
    title: 'Career paths',
    description: 'Explore career paths, the skills each one needs, and the roles they lead to.',
  });
  const [paths, setPaths] = useState<CareerPath[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated, isStudent } = useAuth();

  useEffect(() => {
    careersAPI.paths()
      .then(r => setPaths(r.data.results || r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
        <div className="spinner-gradient !w-11 !h-11 !border-[3px]"></div>
        <p className="text-sm text-surface-400 font-medium animate-pulse">Loading career paths…</p>
      </div>
    );
  }

  return (
    <div className="pb-20">
      <PageHero
        center
        eyebrow={`${paths.length} track${paths.length === 1 ? '' : 's'} mapped`}
        live
        title="Chart your"
        accent="career path"
        subtitle="Real salary bands, milestone-by-milestone roadmaps and the interview questions that actually come up — for every track worth pursuing."
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        {paths.length === 0 ? (
          <div className="glow-card p-16 text-center">
            <h3 className="text-lg font-bold text-surface-900">No career paths available yet</h3>
            <p className="text-surface-500 text-sm mt-1.5">Check back soon for career guidance.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {paths.map((path, i) => (
              <Link
                key={path.id}
                to={`/careers/paths/${path.id}`}
                style={{ '--i': i } as React.CSSProperties}
                className="reveal glow-card shine group p-6 flex flex-col"
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
                  style={{
                    backgroundImage: `linear-gradient(135deg, ${path.color}22, ${path.color}0d)`,
                    boxShadow: `inset 0 0 0 1px ${path.color}33`,
                  }}
                >
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: path.color }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>

                <h3 className="text-lg font-bold text-surface-900 group-hover:text-primary-700 transition-colors leading-snug">
                  {path.name}
                </h3>
                <p className="text-sm text-surface-500 mt-2 line-clamp-2 leading-relaxed flex-1">
                  {path.description}
                </p>

                <div className="mt-5 flex items-baseline gap-2">
                  <span className="text-xl font-extrabold text-surface-900 tabular-nums">
                    {money(path.avg_salary_min)}
                  </span>
                  <span className="text-surface-300 font-bold">–</span>
                  <span className="text-xl font-extrabold text-surface-900 tabular-nums">
                    {money(path.avg_salary_max)}
                  </span>
                  <span className="text-[11px] text-surface-400 font-semibold ml-0.5">avg. range</span>
                </div>

                <div className="mt-4 pt-4 border-t border-surface-100 flex items-center gap-2 flex-wrap">
                  <span className="chip chip-idle">{path.milestone_count} milestones</span>
                  <span className="chip chip-idle">{path.question_count} questions</span>
                  {path.growth_outlook && <span className="chip chip-done">{path.growth_outlook}</span>}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* ===================== NEXT STEPS ===================== */}
        <div className="mt-14 grid md:grid-cols-2 gap-5">
          <Link
            to="/careers/interview-prep"
            className="glow-card shine group relative overflow-hidden p-8 flex items-start gap-5"
          >
            <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shrink-0 shadow-lg shadow-primary-500/25 transition-transform duration-300 group-hover:scale-110">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-bold text-surface-900 group-hover:text-primary-700 transition-colors">
                Interview Prep
              </span>
              <span className="block text-sm text-surface-500 mt-1.5 leading-relaxed">
                Practise the real questions asked for each track, and track what you've mastered.
              </span>
            </span>
          </Link>

          {/* The skill-gap planner is a student-account feature. Say so up front
              rather than letting the click bounce somewhere unexpected. */}
          <Link
            to="/careers/skill-gap"
            className="glow-card shine group relative overflow-hidden p-8 flex items-start gap-5"
          >
            <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-500 to-primary-600 flex items-center justify-center shrink-0 shadow-lg shadow-accent-500/25 transition-transform duration-300 group-hover:scale-110">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-bold text-surface-900 group-hover:text-primary-700 transition-colors">
                  Skill Gap Analysis
                </span>
                {!isStudent && <span className="chip chip-progress">Student accounts</span>}
              </span>
              <span className="block text-sm text-surface-500 mt-1.5 leading-relaxed">
                {isStudent
                  ? 'See exactly which skills stand between you and each role, ranked by real demand.'
                  : isAuthenticated
                    ? 'Available on student accounts — see which skills each role actually demands.'
                    : 'Sign in with a student account to see which skills each role actually demands.'}
              </span>
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CareerPathList;
