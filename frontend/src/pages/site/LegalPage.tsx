import React from 'react';
import { Link } from 'react-router-dom';

import PageHero from '../../components/ui/PageHero';
import { LEGAL_UPDATED } from '../../config/site';

export interface LegalSection {
  id: string;
  heading: string;
  body: React.ReactNode;
}

interface LegalPageProps {
  eyebrow: string;
  title: string;
  accent: string;
  intro: string;
  sections: LegalSection[];
}

/**
 * Shared shell for the policy pages: hero, a sticky table of contents, and the
 * numbered sections. Privacy and Terms differ only in their content, so the
 * chrome lives here rather than being copied into each one.
 */
const LegalPage: React.FC<LegalPageProps> = ({ eyebrow, title, accent, intro, sections }) => (
  <div className="bg-surface-50 min-h-screen">
    <PageHero
      eyebrow={eyebrow}
      title={title}
      accent={accent}
      subtitle={intro}
      crumbs={[{ label: 'Home', to: '/' }, { label: eyebrow }]}
      center
    />

    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      <p className="text-sm text-surface-500 mb-8">Last updated: {LEGAL_UPDATED}</p>

      <div className="grid lg:grid-cols-[240px,1fr] gap-10 items-start">
        <nav aria-label="On this page" className="hidden lg:block sticky top-24">
          <p className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">
            On this page
          </p>
          <ul className="space-y-2 border-l border-surface-200">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="block -ml-px border-l-2 border-transparent hover:border-primary-500 pl-3 text-sm text-surface-500 hover:text-primary-600 transition-colors"
                >
                  {i + 1}. {s.heading}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="card p-6 md:p-10">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className={i > 0 ? 'mt-10 scroll-mt-24' : 'scroll-mt-24'}>
              <h2 className="text-xl font-bold text-surface-900 mb-3">
                {i + 1}. {s.heading}
              </h2>
              <div className="space-y-3 text-surface-600 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_a]:text-primary-600 [&_a]:underline">
                {s.body}
              </div>
            </section>
          ))}

          <p className="mt-12 pt-6 border-t border-surface-200 text-sm text-surface-500">
            Something here unclear? <Link to="/contact">Ask us</Link> — we would rather explain it
            than have you guess.
          </p>
        </article>
      </div>
    </div>
  </div>
);

export default LegalPage;
