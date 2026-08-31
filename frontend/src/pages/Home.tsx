import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { jobsAPI, internshipsAPI, platformAPI, type PlatformStats } from '../api/client';
import PageHero from '../components/ui/PageHero';
import useSeo from '../hooks/useSeo';
import { SITE } from '../config/site';

interface Job {
  id: number;
  title: string;
  company: { id: number; name: string; logo?: string; location: string };
  job_type: string;
  salary: string;
  location: string;
  description: string;
  created_at: string;
}

interface Internship {
  id: number;
  title: string;
  company: { id: number; name: string };
  internship_type: string;
  location: string;
  duration: string;
  stipend: string;
}

// Categories come from the API (real names, real counts). Only the gradient is
// decorative, assigned by position so the row always looks deliberate.
const CATEGORY_GRADIENTS = [
  'from-blue-500 to-cyan-500',
  'from-purple-500 to-pink-500',
  'from-orange-500 to-red-500',
  'from-emerald-500 to-teal-500',
];

const Home: React.FC = () => {
  useSeo({
    title: SITE.name,
    description: SITE.description,
    canonicalPath: '/',
  });

  const [heroJob, setHeroJob] = useState<Job | null>(null);
  const [featuredJobs, setFeaturedJobs] = useState<Job[]>([]);
  const [featuredInternships, setFeaturedInternships] = useState<Internship[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    jobsAPI.list({ ordering: '-created_at' }).then(r => {
      const jobs = r.data.results || r.data || [];
      if (jobs.length > 0) setHeroJob(jobs[Math.floor(Math.random() * jobs.length)]);
      setFeaturedJobs(jobs.slice(0, 6));
    }).catch(() => {});

    internshipsAPI.featured().then(r => {
      setFeaturedInternships(r.data?.results || r.data || []);
    }).catch(() => {});

    platformAPI.stats().then(r => setStats(r.data)).catch(() => {});
  }, []);

  const categories = (stats?.categories ?? []).slice(0, 4);

  return (
    <div>
      {/* ===== HERO — the shared PageHero every major page opens with ===== */}
      <PageHero
        eyebrow="Connecting talent with opportunity"
        live
        title="Find your dream"
        accent="internship & job."
        subtitle="Connect with top companies and startups. Build your career with the most trusted internship and job portal."
        aside={
          heroJob ? (
            <div className="panel-dark p-7 hover:border-white/20 transition-all duration-300">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 bg-gradient-to-br from-primary-500/20 to-accent-500/20 rounded-2xl flex items-center justify-center shrink-0">
                  <svg className="w-7 h-7 text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h3 className="text-xl font-bold text-white truncate">{heroJob.title}</h3>
                  <p className="text-sm text-white/50 truncate">{heroJob.company?.name} • {heroJob.location}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mb-5">
                <span className="px-3.5 py-1 bg-primary-500/10 border border-primary-500/20 rounded-xl text-xs text-primary-300">{heroJob.job_type}</span>
                <span className="px-3.5 py-1 bg-accent-500/10 border border-accent-500/20 rounded-xl text-xs text-accent-300">{heroJob.salary}</span>
              </div>
              <p className="text-sm text-white/50 mb-6 line-clamp-2 leading-relaxed">{heroJob.description}</p>
              <Link to={`/jobs/${heroJob.id}`} className="group/btn inline-flex items-center justify-center w-full gap-2 bg-gradient-to-r from-primary-500 to-accent-500 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/30">
                View Opportunity
                <svg className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          ) : (
            <div className="panel-dark p-10 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-primary-500/20 to-accent-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <svg className="w-8 h-8 text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-1.5">Exciting Careers Await</h3>
              <p className="text-sm text-white/50">Be the first to apply for top-tier roles.</p>
            </div>
          )
        }
      >
        <div className="flex flex-wrap gap-4 mt-8">
          <Link to="/jobs" className="group inline-flex items-center gap-2 bg-gradient-to-r from-primary-500 to-accent-500 text-white font-semibold py-3 px-7 rounded-xl shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0">
            Browse Jobs
            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
          <Link to="/register" className="inline-flex items-center text-white font-semibold py-3 px-7 rounded-xl border-2 border-white/20 hover:bg-white/10 hover:border-white/40 transition-all duration-200">
            Get Started Free
          </Link>
        </div>
        {/* Live platform figures. Rendered only once loaded -- an empty
            slot is better than an invented number. */}
        {stats && (
          <dl className="flex flex-wrap items-center gap-x-10 gap-y-5 mt-10">
            {[
              { value: stats.jobs, label: 'Open jobs' },
              { value: stats.internships, label: 'Open internships' },
              { value: stats.companies, label: 'Companies hiring' },
            ].map(item => (
              <div key={item.label}>
                <dt className="sr-only">{item.label}</dt>
                <dd>
                  <span className="block text-white font-bold text-2xl">
                    {item.value?.toLocaleString() ?? '—'}
                  </span>
                  <span className="block text-white/50 text-sm">{item.label}</span>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </PageHero>

      {/* ===== CATEGORIES SECTION ===== */}
      {categories.length > 0 && (
      <section className="py-16 md:py-24 bg-surface-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14 animate-fade-in-up">
            <span className="badge-primary mb-4">Categories</span>
            <h2 className="section-title">Explore by Category</h2>
            <p className="section-subtitle mx-auto">Find opportunities in your field of interest</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-6">
            {categories.map((cat, i) => {
              const gradient = CATEGORY_GRADIENTS[i % CATEGORY_GRADIENTS.length];
              return (
              <Link key={cat.id} to={`/jobs?category=${encodeURIComponent(cat.name)}`}
                className="group card-hover relative p-8 text-center animate-fade-in-up"
                style={{ animationDelay: `${i * 100}ms` }}>
                {/* Gradient overlay on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity duration-300`}></div>

                <div className={`w-16 h-16 bg-gradient-to-br ${gradient} rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-surface-900 mb-1 group-hover:text-primary-600 transition-colors">{cat.name}</h3>
                <p className="text-sm text-surface-400">
                  {cat.count} {cat.count === 1 ? 'open role' : 'open roles'}
                </p>
              </Link>
              );
            })}
          </div>
        </div>
      </section>
      )}

      {/* ===== FEATURED INTERNSHIPS ===== */}
      {featuredInternships.length > 0 && (
        <section className="py-16 md:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-14 animate-fade-in-up">
              <div>
                <span className="badge-success mb-4">Latest Opportunities</span>
                <h2 className="section-title">Latest Internships</h2>
                <p className="section-subtitle">Fresh opportunities for students and graduates</p>
              </div>
              <Link to="/internships" className="btn-outline mt-4 md:mt-0 group">
                View All Internships
                <svg className="w-4 h-4 inline ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
            <div className="grid md:grid-cols-3 gap-6 stagger-enter">
              {featuredInternships.map((intern) => (
                <Link key={intern.id} to={`/internships/${intern.id}`}
                  className="group card-hover p-6">
                  <div className="flex items-start justify-between mb-5">
                    <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                      </svg>
                    </div>
                    <span className="badge-success">{intern.internship_type}</span>
                  </div>
                  <h3 className="text-lg font-bold text-surface-900 mb-1.5 group-hover:text-primary-600 transition-colors">{intern.title}</h3>
                  <p className="text-sm text-surface-500 mb-4">{intern.company?.name}</p>
                  <div className="flex items-center gap-4 text-sm text-surface-400 mb-5">
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      {intern.location}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {intern.duration}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-surface-100">
                    <span className="font-bold text-emerald-600">{intern.stipend}</span>
                    <span className="text-sm font-medium text-primary-600 group-hover:translate-x-1 transition-transform">Details →</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== FEATURED JOBS ===== */}
      <section className="py-16 md:py-24 bg-surface-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-14 animate-fade-in-up">
            <div>
              <span className="badge-primary mb-4">Featured</span>
              <h2 className="section-title">Featured Job Postings</h2>
              <p className="section-subtitle">Build your future with world-class companies</p>
            </div>
            <Link to="/jobs" className="btn-outline mt-4 md:mt-0 group">
              View All Jobs
              <svg className="w-4 h-4 inline ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-enter">
            {featuredJobs.slice(0, 6).map((job) => (
              <Link key={job.id} to={`/jobs/${job.id}`}
                className="group card-hover p-6">
                <div className="flex items-start justify-between mb-5">
                  <div className="w-14 h-14 bg-gradient-to-br from-primary-400 to-accent-500 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/20">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="badge-primary">{job.job_type}</span>
                </div>
                <h3 className="text-lg font-bold text-surface-900 mb-1.5 group-hover:text-primary-600 transition-colors">{job.title}</h3>
                <p className="text-sm text-surface-500 mb-2">{job.company?.name}</p>
                <p className="text-xs text-surface-400 mb-5">{job.location}</p>
                <div className="flex items-center justify-between pt-4 border-t border-surface-100">
                  <span className="text-lg font-bold gradient-text">{job.salary}</span>
                  <span className="text-sm font-medium text-primary-600 group-hover:translate-x-1 transition-transform">View →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA SECTION — same mesh panel treatment the dashboards use ===== */}
      <section className="pb-16 md:pb-24 bg-surface-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl mesh-hero mesh-animate grain text-white">
            <div className="absolute inset-0 grid-lines"></div>
            <div className="relative z-10 px-6 py-16 md:py-20 text-center">
              <h2 className="text-3xl md:text-5xl font-bold mb-5 animate-fade-in-up">
                Ready to Start Your{' '}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-300 via-accent-300 to-emerald-300">
                  Journey?
                </span>
              </h2>
              <p className="text-lg md:text-xl text-white/60 mb-9 max-w-2xl mx-auto animate-fade-in-up animation-delay-100">
                Create a free account, see why each role matches you, and keep every application in one place.
              </p>
              <div className="flex flex-wrap justify-center gap-4 animate-fade-in-up animation-delay-200">
                <Link to="/register" className="bg-white text-primary-700 hover:bg-primary-50 font-bold py-3 px-9 rounded-xl shadow-2xl shadow-black/20 hover:-translate-y-1 transition-all duration-200">
                  Create Free Account
                </Link>
                <Link to="/jobs" className="bg-transparent hover:bg-white/10 text-white font-semibold py-3 px-9 rounded-xl border-2 border-white/30 hover:border-white/50 transition-all duration-200">
                  Browse Opportunities
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
