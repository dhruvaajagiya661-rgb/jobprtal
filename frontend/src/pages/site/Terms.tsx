import React from 'react';
import { Link } from 'react-router-dom';

import LegalPage, { type LegalSection } from './LegalPage';
import { SITE } from '../../config/site';
import useSeo from '../../hooks/useSeo';

const SECTIONS: LegalSection[] = [
  {
    id: 'accepting',
    heading: 'Accepting these terms',
    body: (
      <p>
        By creating an account or using {SITE.name}, you agree to these terms. If you are using the
        platform on behalf of a company, you confirm you are authorised to accept them for that
        company.
      </p>
    ),
  },
  {
    id: 'accounts',
    heading: 'Your account',
    body: (
      <ul>
        <li>You must be at least 16 years old to register.</li>
        <li>One person, one account. Do not share credentials or let someone else use yours.</li>
        <li>Everything you put on your profile must be true — qualifications included.</li>
        <li>
          You are responsible for activity under your account. Tell us immediately if you think it
          has been compromised.
        </li>
      </ul>
    ),
  },
  {
    id: 'students',
    heading: 'If you are a student',
    body: (
      <ul>
        <li>
          Apply only to roles you genuinely intend to pursue. Bulk or automated applications are not
          permitted.
        </li>
        <li>
          Your resume and profile are shared with the recruiter for any role you apply to. Do not
          upload documents containing data you are not willing to share.
        </li>
        <li>
          Match scores are guidance, not a guarantee. A high score does not entitle you to an
          interview, and a low one does not bar you from applying.
        </li>
      </ul>
    ),
  },
  {
    id: 'recruiters',
    heading: 'If you are a recruiter',
    body: (
      <ul>
        <li>
          Post only genuine, currently open positions at a company you are authorised to represent.
        </li>
        <li>
          No listing may require payment from applicants, promise unrealistic compensation, or
          function as an advertisement rather than a job.
        </li>
        <li>
          Applicant data may be used only to assess that candidate for the role they applied to. Do
          not export it, resell it, or add it to an unrelated mailing list.
        </li>
        <li>
          Selection must not discriminate on grounds protected by applicable law. Postings that
          state such a preference will be removed.
        </li>
      </ul>
    ),
  },
  {
    id: 'acceptable-use',
    heading: 'Acceptable use',
    body: (
      <>
        <p>Do not:</p>
        <ul>
          <li>Scrape, crawl, or bulk-extract listings, profiles, or contact details.</li>
          <li>
            Probe, load-test, or attempt to bypass authentication, rate limits, or access controls.
          </li>
          <li>
            Upload malware, or content that is unlawful, harassing, hateful, or infringes someone
            else's rights.
          </li>
          <li>Impersonate another person or company, or misrepresent your affiliation.</li>
          <li>Use in-app messaging to send unsolicited marketing.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'content',
    heading: 'Content you post',
    body: (
      <p>
        You keep ownership of everything you upload. You grant {SITE.name} a licence to store,
        display and transmit that content strictly for the purpose of operating the platform — for
        example, showing your profile to a recruiter you applied to. That licence ends when you
        delete the content, except for copies a recruiter has already received.
      </p>
    ),
  },
  {
    id: 'moderation',
    heading: 'Suspension and removal',
    body: (
      <p>
        We may remove a listing or suspend an account that breaks these terms, and we will tell you
        why. Serious cases — fraud, attacks on the platform, harm to other users — may be actioned
        immediately and without notice. You can appeal any decision through the{' '}
        <Link to="/contact">contact form</Link>.
      </p>
    ),
  },
  {
    id: 'availability',
    heading: 'Availability and no warranty',
    body: (
      <p>
        We work to keep {SITE.name} available and accurate, but we provide it as-is. We do not
        warrant that listings are error-free, that a role is still open, or that the service will be
        uninterrupted. We are not a party to any employment relationship formed through the
        platform, and we do not guarantee any hiring outcome.
      </p>
    ),
  },
  {
    id: 'liability',
    heading: 'Limitation of liability',
    body: (
      <p>
        To the extent the law allows, {SITE.name} is not liable for indirect or consequential loss —
        including lost opportunities, lost earnings, or loss of data — arising from your use of the
        platform. Nothing here limits liability that cannot lawfully be limited.
      </p>
    ),
  },
  {
    id: 'changes',
    heading: 'Changes and contact',
    body: (
      <p>
        We may update these terms as the platform changes. Material changes will be announced in the
        app before they take effect, and the date at the top of this page will change. Questions go
        to <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
      </p>
    ),
  },
];

const Terms: React.FC = () => {
  useSeo({
    title: 'Terms of Service',
    description: `The rules for using ${SITE.name} — what students, recruiters and we each agree to.`,
  });

  return (
    <LegalPage
      eyebrow="Terms"
      title="The rules, in"
      accent="plain English."
      intro="What you can expect from us, what we expect from you, and what happens when someone gets it wrong."
      sections={SECTIONS}
    />
  );
};

export default Terms;
