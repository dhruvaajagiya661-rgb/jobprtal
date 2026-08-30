import React from 'react';
import { Link } from 'react-router-dom';

import LegalPage, { type LegalSection } from './LegalPage';
import { SITE } from '../../config/site';
import useSeo from '../../hooks/useSeo';

const SECTIONS: LegalSection[] = [
  {
    id: 'what-we-collect',
    heading: 'What we collect',
    body: (
      <>
        <p>We only hold data that the platform needs in order to work:</p>
        <ul>
          <li>
            <strong>Account details</strong> — your name, email address, password (stored only as a
            salted hash, never in readable form) and whether you signed up as a student or a
            recruiter.
          </li>
          <li>
            <strong>Profile content</strong> — everything you choose to add: education, experience,
            skills, portfolio links, your uploaded resume, and a company profile if you recruit.
          </li>
          <li>
            <strong>Activity on the platform</strong> — applications you submit, jobs you save,
            connections and endorsements, messages you send through in-app chat, and notifications
            generated for you.
          </li>
          <li>
            <strong>Linked accounts</strong> — if you connect a public GitHub profile, we read its
            public repositories to verify the skills you claim. We never request write access and we
            never read private repositories.
          </li>
          <li>
            <strong>Technical logs</strong> — IP address, browser user agent, and timestamps of
            requests, kept for security and debugging.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'how-we-use-it',
    heading: 'How we use it',
    body: (
      <ul>
        <li>To run your account, authenticate you, and keep the service secure.</li>
        <li>
          To calculate your match score against a role, and to show you the breakdown behind it.
        </li>
        <li>To deliver applications to the recruiter who posted the role.</li>
        <li>
          To send transactional email and in-app notifications — application status changes, message
          alerts, and job alerts you have asked for.
        </li>
        <li>To detect abuse, rate-limit automated traffic, and investigate security incidents.</li>
      </ul>
    ),
  },
  {
    id: 'who-sees-it',
    heading: 'Who can see your data',
    body: (
      <>
        <p>
          <strong>Recruiters</strong> see your profile and resume when you apply to one of their
          roles, and can see your public profile if you have made it public.
        </p>
        <p>
          <strong>Other users</strong> see only what your public profile exposes — you control that
          from your profile settings.
        </p>
        <p>
          <strong>We do not sell your data</strong>, and we do not share it with advertisers. Data
          leaves our systems only where a service provider is needed to operate the platform (email
          delivery, hosting), and only to the extent that service requires.
        </p>
      </>
    ),
  },
  {
    id: 'cookies',
    heading: 'Cookies and local storage',
    body: (
      <>
        <p>
          We do not use advertising or third-party tracking cookies. Your browser stores an
          authentication token so you stay signed in between visits, plus a small amount of
          interface state such as filters you last used.
        </p>
        <p>Clearing your browser storage signs you out and removes all of it.</p>
      </>
    ),
  },
  {
    id: 'retention',
    heading: 'How long we keep it',
    body: (
      <ul>
        <li>Profile and application data: for as long as your account is open.</li>
        <li>
          Deleted account: profile, resume and messages are removed. Applications already sent to a
          recruiter may be retained by that recruiter for their own hiring records.
        </li>
        <li>Security logs: kept for a limited period, then rotated out.</li>
      </ul>
    ),
  },
  {
    id: 'your-rights',
    heading: 'Your rights',
    body: (
      <>
        <p>You can, at any time:</p>
        <ul>
          <li>See and edit everything on your profile from your account settings.</li>
          <li>Download a copy of the data we hold about you.</li>
          <li>Delete your account, which removes your profile and resume from the platform.</li>
          <li>Turn off job alerts and non-essential email from your notification settings.</li>
        </ul>
        <p>
          For a data export or deletion request, email{' '}
          <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> or use the{' '}
          <Link to="/contact">contact form</Link>. We respond {SITE.responseTime}.
        </p>
      </>
    ),
  },
  {
    id: 'security',
    heading: 'How we protect it',
    body: (
      <ul>
        <li>All traffic is served over HTTPS in production, with HSTS enabled.</li>
        <li>Passwords are hashed; nobody at {SITE.name} can read yours.</li>
        <li>
          Access to your data is scoped by role — a recruiter cannot read another recruiter's
          applicants, and no ordinary account can reach administrative data.
        </li>
        <li>Sensitive actions are recorded in an audit log.</li>
      </ul>
    ),
  },
  {
    id: 'changes',
    heading: 'Changes to this policy',
    body: (
      <p>
        If we change how we handle your data in a way that materially affects you, we will update
        the date at the top of this page and notify you in the app before the change takes effect.
      </p>
    ),
  },
];

const Privacy: React.FC = () => {
  useSeo({
    title: 'Privacy Policy',
    description: `How ${SITE.name} collects, uses, shares and protects your personal data — and the rights you have over it.`,
  });

  return (
    <LegalPage
      eyebrow="Privacy"
      title="Your data, and what"
      accent="we do with it."
      intro="Written to be read, not to be skipped. This is exactly what we collect, why, who sees it, and how to get it back or get rid of it."
      sections={SECTIONS}
    />
  );
};

export default Privacy;
