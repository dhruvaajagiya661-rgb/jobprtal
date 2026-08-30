import React from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { SITE, SOCIAL_LINKS, type SocialIcon } from '../../config/site';

/** Real brand glyphs — the previous version drew the same circle for all four. */
const SOCIAL_PATHS: Record<SocialIcon, string> = {
  twitter:
    'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z',
  linkedin:
    'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286ZM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125ZM7.119 20.452H3.555V9h3.564v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003Z',
  github:
    'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12Z',
  globe:
    'M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2Zm7.938 9h-3.03a15.7 15.7 0 0 0-1.1-5.316A8.02 8.02 0 0 1 19.938 11ZM12 4.04c.784 1.086 1.717 3.3 1.9 6.96h-3.8c.183-3.66 1.116-5.874 1.9-6.96ZM4.062 13h3.03c.114 1.94.49 3.75 1.1 5.316A8.02 8.02 0 0 1 4.062 13Zm3.03-2h-3.03a8.02 8.02 0 0 1 4.13-5.316A15.7 15.7 0 0 0 7.092 11ZM12 19.96c-.784-1.086-1.717-3.3-1.9-6.96h3.8c-.183 3.66-1.116 5.874-1.9 6.96Zm3.808-1.644c.61-1.566.986-3.376 1.1-5.316h3.03a8.02 8.02 0 0 1-4.13 5.316Z',
};

const STUDENT_LINKS = [
  { to: '/jobs', label: 'Browse jobs' },
  { to: '/internships', label: 'Find internships' },
  { to: '/careers/paths', label: 'Career paths' },
  { to: '/careers/interview-prep', label: 'Interview prep' },
];

// Only shown to visitors who are not signed in yet.
const STUDENT_GUEST_LINKS = [...STUDENT_LINKS, { to: '/register', label: 'Create an account' }];

// Signed-in recruiters get links into their own console; guests get the
// sign-up / sign-in routes instead.
const RECRUITER_LINKS = [
  { to: '/recruiter/post-job', label: 'Post a job' },
  { to: '/recruiter/dashboard', label: 'Recruiter dashboard' },
  { to: '/recruiter/applicants', label: 'Applicants' },
];

const RECRUITER_GUEST_LINKS = [
  { to: '/register', label: 'Post a job' },
  { to: '/recruiter/dashboard', label: 'Recruiter dashboard' },
  { to: '/login', label: 'Recruiter sign in' },
];

const COMPANY_LINKS = [
  { to: '/about', label: 'About us' },
  { to: '/contact', label: 'Contact' },
  { to: '/privacy', label: 'Privacy policy' },
  { to: '/terms', label: 'Terms of service' },
];

const FooterColumn: React.FC<{
  heading: string;
  links: { to: string; label: string }[];
  dot?: string;
}> = ({ heading, links, dot = 'bg-primary-500' }) => (
  <div>
    <h3 className="font-semibold text-white mb-5 text-sm uppercase tracking-wider">{heading}</h3>
    <ul className="space-y-3">
      {links.map((link) => (
        <li key={`${heading}-${link.label}`}>
          <Link
            to={link.to}
            className="text-sm text-surface-400 hover:text-primary-400 transition-colors duration-200 flex items-center"
          >
            <span className={`w-1 h-1 ${dot} rounded-full mr-2`} aria-hidden="true"></span>
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  </div>
);

const Footer: React.FC = () => {
  const { isStudent, isRecruiter } = useAuth();

  // Role-aware columns: a signed-in student never sees the recruiter links,
  // a signed-in recruiter never sees the student links. Anonymous visitors
  // (and admins) see both, since the footer is how they find either side.
  const columns: { heading: string; links: { to: string; label: string }[]; dot?: string }[] = [];
  if (!isRecruiter) {
    columns.push({
      heading: 'For students',
      links: isStudent ? STUDENT_LINKS : STUDENT_GUEST_LINKS,
    });
  }
  if (!isStudent) {
    columns.push({
      heading: 'For recruiters',
      links: isRecruiter ? RECRUITER_LINKS : RECRUITER_GUEST_LINKS,
      dot: 'bg-accent-500',
    });
  }
  columns.push({ heading: 'Company', links: COMPANY_LINKS, dot: 'bg-emerald-500' });

  return (
  <footer className="bg-surface-900 text-surface-300 mt-auto">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="h-px bg-gradient-to-r from-transparent via-primary-500/50 to-transparent"></div>

      <div className="py-16">
        <div className={`grid grid-cols-2 gap-10 md:gap-12 ${columns.length === 3 ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
          <div className="col-span-2">
            <Link to="/" className="inline-flex items-center space-x-2 mb-4">
              <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-base">P</span>
              </div>
              <span className="text-xl font-bold text-white">{SITE.name}</span>
            </Link>
            <p className="text-surface-400 text-sm leading-relaxed max-w-md">{SITE.description}</p>

            <a
              href={`mailto:${SITE.contactEmail}`}
              className="inline-block mt-5 text-sm text-surface-400 hover:text-primary-400 transition-colors"
            >
              {SITE.contactEmail}
            </a>

            {/* Rendered only for accounts that actually exist -- see config/site.ts */}
            {SOCIAL_LINKS.length > 0 && (
              <div className="flex space-x-4 mt-6">
                {SOCIAL_LINKS.map((social) => (
                  <a
                    key={social.icon}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer me"
                    aria-label={social.label}
                    className="w-10 h-10 bg-surface-800 hover:bg-surface-700 rounded-xl flex items-center justify-center text-surface-400 hover:text-primary-400 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d={SOCIAL_PATHS[social.icon]} />
                    </svg>
                  </a>
                ))}
              </div>
            )}
          </div>

          {columns.map((col) => (
            <FooterColumn key={col.heading} heading={col.heading} links={col.links} dot={col.dot} />
          ))}
        </div>
      </div>

      <div className="border-t border-surface-800 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-sm text-surface-500">
          © {new Date().getFullYear()} {SITE.name}. All rights reserved.
        </p>
        <div className="flex items-center gap-5 text-sm text-surface-500">
          <Link to="/privacy" className="hover:text-primary-400 transition-colors">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-primary-400 transition-colors">
            Terms
          </Link>
          <Link to="/contact" className="hover:text-primary-400 transition-colors">
            Contact
          </Link>
        </div>
      </div>
    </div>
  </footer>
  );
};

export default Footer;
