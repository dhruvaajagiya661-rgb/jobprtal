/**
 * Single source of truth for the things a real website has to state about
 * itself: who it is, how to reach it, and where its accounts live.
 *
 * Social links are intentionally empty by default. The footer renders only the
 * ones that are filled in, so the site never ships dead `href="#"` icons —
 * add a URL here and the icon appears.
 */

export const SITE = {
  name: 'PortAL',
  tagline: 'Find your internship. Know why it fits.',
  description:
    'PortAL connects students with internships and graduate jobs. See exactly why each role matches you, close your skill gaps, and track every application in one place.',
  /** Absolute origin, resolved at runtime so previews and production agree. */
  get url(): string {
    return typeof window !== 'undefined' ? window.location.origin : '';
  },
  contactEmail: 'support@portal.com',
  supportHours: 'Monday to Friday, 9am – 6pm IST',
  responseTime: 'within 2 business days',
  foundedYear: 2026,
} as const;

export type SocialLink = { label: string; href: string; icon: SocialIcon };
export type SocialIcon = 'twitter' | 'linkedin' | 'github' | 'globe';

/** Fill in a `href` to make the icon appear in the footer. */
export const SOCIAL_LINKS: SocialLink[] = [
  { label: 'PortAL on X', href: '', icon: 'twitter' },
  { label: 'PortAL on LinkedIn', href: '', icon: 'linkedin' },
  { label: 'PortAL on GitHub', href: '', icon: 'github' },
].filter((link) => link.href.length > 0) as SocialLink[];

export const LEGAL_UPDATED = 'August 2026';
