import React from 'react';
import { Link } from 'react-router-dom';

export interface Crumb {
  label: string;
  to?: string;
}

interface PageHeroProps {
  /** Small uppercase label above the title. */
  eyebrow?: React.ReactNode;
  /** Shows a live green dot next to the eyebrow. */
  live?: boolean;
  title: React.ReactNode;
  /** Rendered in the brand gradient, immediately after the title. */
  accent?: React.ReactNode;
  subtitle?: React.ReactNode;
  crumbs?: Crumb[];
  /** Right-hand slot — KPI tiles, actions, an avatar. */
  aside?: React.ReactNode;
  /** Centre everything (list/landing pages) instead of the two-column split. */
  center?: boolean;
  children?: React.ReactNode;
}

/**
 * The shared dark hero used at the top of every major page: animated mesh
 * gradient, masked hairline grid, drifting light blooms, and a curved cut into
 * the page background below. Centralised so the whole app keeps one identity —
 * duplicating this markup per page is how design systems rot.
 */
const PageHero: React.FC<PageHeroProps> = ({
  eyebrow,
  live,
  title,
  accent,
  subtitle,
  crumbs,
  aside,
  center = false,
  children,
}) => (
  <section className="relative overflow-hidden mesh-hero mesh-animate grain">
    <div className="absolute inset-0 grid-lines"></div>
    <div className="absolute -top-24 -left-16 w-80 h-80 bg-primary-500/20 rounded-full blur-3xl animate-float"></div>
    <div
      className="absolute -bottom-28 right-0 w-96 h-96 bg-accent-500/20 rounded-full blur-3xl animate-float"
      style={{ animationDelay: '-2.5s' }}
    ></div>

    <div
      className={`relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-16 ${center ? 'text-center' : ''}`}
    >
      {crumbs && crumbs.length > 0 && (
        <nav className="flex items-center gap-2 text-xs font-medium text-white/45 mb-7">
          {crumbs.map((c, i) => (
            <React.Fragment key={c.label}>
              {i > 0 && <span aria-hidden="true">/</span>}
              {c.to ? (
                <Link to={c.to} className="hover:text-white/80 transition-colors">{c.label}</Link>
              ) : (
                <span className="text-white/80">{c.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      <div className={center ? '' : 'grid lg:grid-cols-[1.4fr,1fr] gap-10 items-end'}>
        <div className="animate-fade-in-up">
          {eyebrow && (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-white/75 text-[11px] font-bold uppercase tracking-[0.14em] backdrop-blur">
              {live && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>}
              {eyebrow}
            </span>
          )}
          <h1
            className={`mt-5 text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-[1.05] ${
              center ? 'lg:text-6xl' : ''
            }`}
          >
            {title}
            {accent && (
              <>
                {' '}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-300 via-accent-300 to-emerald-300">
                  {accent}
                </span>
              </>
            )}
          </h1>
          {subtitle && (
            <p
              className={`mt-5 text-base md:text-lg text-white/60 leading-relaxed ${
                center ? 'max-w-2xl mx-auto' : 'max-w-xl'
              }`}
            >
              {subtitle}
            </p>
          )}
          {children}
        </div>

        {aside && !center && (
          <div className="animate-fade-in-up animation-delay-200">{aside}</div>
        )}
      </div>
    </div>

    {/* Curved cut into the page background */}
    <svg
      className="relative z-10 block w-full h-[44px] text-surface-50"
      viewBox="0 0 1440 44"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path fill="currentColor" d="M0,44 L0,20 C240,44 480,0 720,10 C960,20 1200,44 1440,24 L1440,44 Z" />
    </svg>
  </section>
);

export default PageHero;
