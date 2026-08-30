export interface CompletionOptions {
  hasPhoto: boolean;
  hasResume: boolean;
  hasSkills: boolean;
  hasEducation: boolean;
  hasExperience: boolean;
  hasLinks: boolean;
}

export interface CompletionResult {
  percent: number;
  missing: string[];
}

/**
 * Profile completion scoring, shared between the profile page and the
 * student dashboard so both always agree:
 *   Photo 15% · Resume 20% · Skills 20% · Education 15% · Experience 15% · Links 15%
 */
export function computeCompletion(opts: CompletionOptions): CompletionResult {
  const items: { label: string; done: boolean; weight: number }[] = [
    { label: 'Profile photo', done: opts.hasPhoto, weight: 15 },
    { label: 'Resume', done: opts.hasResume, weight: 20 },
    { label: 'Skills', done: opts.hasSkills, weight: 20 },
    { label: 'Education', done: opts.hasEducation, weight: 15 },
    { label: 'Experience', done: opts.hasExperience, weight: 15 },
    { label: 'Links', done: opts.hasLinks, weight: 15 },
  ];
  const percent = items.reduce((sum, it) => sum + (it.done ? it.weight : 0), 0);
  return {
    percent,
    missing: items.filter(it => !it.done).map(it => it.label),
  };
}

/** Loose profile shape as returned by the student API (dashboard & /me). */
export interface StudentProfileLike {
  profile_photo?: unknown;
  resume?: unknown;
  skills?: unknown[];
  education?: unknown;
  experience?: unknown;
  portfolio_link?: unknown;
  github_link?: unknown;
  linkedin_link?: unknown;
}

/** Compute completion directly from a profile object returned by the API. */
export function completionFromProfile(
  profile: StudentProfileLike | null | undefined
): CompletionResult {
  return computeCompletion({
    hasPhoto: !!profile?.profile_photo,
    hasResume: !!profile?.resume,
    hasSkills: Array.isArray(profile?.skills) && profile.skills.length > 0,
    hasEducation:
      typeof profile?.education === 'string' &&
      profile.education.trim().length > 0,
    hasExperience:
      typeof profile?.experience === 'string' &&
      profile.experience.trim().length > 0,
    hasLinks: !!(
      profile?.portfolio_link || profile?.github_link || profile?.linkedin_link
    ),
  });
}
