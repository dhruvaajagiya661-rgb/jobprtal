import type { CompletionResult } from './profileCompletion';

/** Loose company shape as returned by /v1/recruiters/dashboard/ and /company/. */
export interface CompanyLike {
  name?: unknown;
  description?: unknown;
  industry?: unknown;
  size?: unknown;
  website?: unknown;
  location?: unknown;
}

const filled = (v: unknown): boolean =>
  typeof v === 'string' ? v.trim().length > 0 : v != null && v !== '';

/**
 * Employer-brand completeness, the company-side counterpart to
 * computeCompletion() for students.
 *
 * Scored ONLY on the six fields CompanyProfile.tsx can actually edit —
 * name 10 · description 25 · location 20 · industry 15 · size 15 · website 15.
 * The Company model also carries logo, cover_photo, about, mission, culture,
 * benefits and specialities, but no screen sets them yet, so counting them here
 * would show a recruiter a gap with no way to close it.
 */
export function completionFromCompany(
  company: CompanyLike | null | undefined
): CompletionResult {
  const items: { label: string; done: boolean; weight: number }[] = [
    { label: 'Company name', done: filled(company?.name), weight: 10 },
    { label: 'Description', done: filled(company?.description), weight: 25 },
    { label: 'Location', done: filled(company?.location), weight: 20 },
    { label: 'Industry', done: filled(company?.industry), weight: 15 },
    { label: 'Company size', done: filled(company?.size), weight: 15 },
    { label: 'Website', done: filled(company?.website), weight: 15 },
  ];
  return {
    percent: items.reduce((sum, it) => sum + (it.done ? it.weight : 0), 0),
    missing: items.filter(it => !it.done).map(it => it.label),
  };
}
