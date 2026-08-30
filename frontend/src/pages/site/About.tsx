import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import PageHero from '../../components/ui/PageHero';
import { platformAPI, type PlatformStats } from '../../api/client';
import { SITE } from '../../config/site';
import useSeo from '../../hooks/useSeo';

const PRINCIPLES = [
  {
    title: 'Show the reasoning',
    body: 'Every match score breaks down into skills, experience, field fit and location — with the exact skills you have and the ones to learn. A number you cannot interrogate is not useful.',
  },
  {
    title: 'Close the gap, do not just name it',
    body: 'Where a role asks for something you do not have yet, the skill-gap planner links straight to the learning path for it. Rejection should leave you with a next step.',
  },
  {
    title: 'One place for the whole pipeline',
    body: 'Applied, shortlisted, interviewing, offered. Students track every application on one board; recruiters move candidates through the same pipeline from the other side.',
  },
  {
    title: 'Recruiters are users too',
    body: 'Company pages, applicant management, saved candidates and job alerts are first-class product surfaces, not an afterthought bolted onto a job board.',
  },
];

const About: React.FC = () => {
  useSeo({
    title: 'About',
    description:
      'Why PortAL exists: explainable match scores, skill-gap planning, and one pipeline shared by students and recruiters.',
  });

  const [stats, setStats] = useState<PlatformStats | null>(null);
  useEffect(() => {
    platformAPI.stats().then((r) => setStats(r.data)).catch(() => {});
  }, []);

  const figures = [
    { value: stats?.jobs, label: 'Open jobs' },
    { value: stats?.internships, label: 'Open internships' },
    { value: stats?.companies, label: 'Companies hiring' },
    { value: stats?.students, label: 'Students registered' },
  ];

  return (
    <div className="bg-surface-50 min-h-screen">
      <PageHero
        eyebrow="About"
        title="Job hunting should not feel like"
        accent="guesswork."
        subtitle={SITE.description}
        crumbs={[{ label: 'Home', to: '/' }, { label: 'About' }]}
        center
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
        <section className="animate-fade-in-up">
          <h2 className="section-title">Why we built it</h2>
          <div className="mt-5 space-y-4 text-surface-600 leading-relaxed">
            <p>
              Most job boards tell a student one thing: apply, or do not. They will not say how close
              a candidate actually is to a role, which requirement is the one holding them back, or
              what to do about it. So applications go out by the hundred, recruiters drown in volume,
              and both sides lose.
            </p>
            <p>
              PortAL was built around the opposite idea — that the interesting part is the{' '}
              <em>reasoning</em>. Every opportunity carries a match score you can open up and argue
              with. Where you fall short, the gap becomes a concrete plan rather than a silent
              rejection.
            </p>
          </div>
        </section>

        <section className="mt-16 animate-fade-in-up">
          <h2 className="section-title">What we hold to</h2>
          <div className="grid sm:grid-cols-2 gap-5 mt-8">
            {PRINCIPLES.map((p, i) => (
              <div key={p.title} className="card p-6" style={{ animationDelay: `${i * 80}ms` }}>
                <h3 className="font-bold text-surface-900 mb-2">{p.title}</h3>
                <p className="text-sm text-surface-600 leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 animate-fade-in-up">
          <h2 className="section-title">Where things stand</h2>
          <p className="section-subtitle">
            Live numbers from the platform, not marketing figures.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            {figures.map((f) => (
              <div key={f.label} className="card p-6 text-center">
                <p className="text-3xl font-extrabold gradient-text">
                  {f.value === undefined ? '—' : f.value.toLocaleString()}
                </p>
                <p className="text-sm text-surface-500 mt-1">{f.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 card-gradient p-8 md:p-10 text-center animate-fade-in-up">
          <h2 className="text-2xl font-bold text-surface-900">Have a question?</h2>
          <p className="text-surface-600 mt-2 mb-6">
            We read everything that comes in and reply {SITE.responseTime}.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/contact" className="btn-primary">
              Contact us
            </Link>
            <Link to="/jobs" className="btn-outline">
              Browse opportunities
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default About;
