import React, { useState } from 'react';
import { studentAPI } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { extractApiError } from '../../utils/errors';

export interface DetectedSkill {
  id: number;
  name: string;
  occurrences: number;
  evidence: string;
  already_on_profile: boolean;
}

interface ParseResult {
  skills: DetectedSkill[];
  experience_years: number | null;
  education_level: string | null;
  pages: number;
  words: number;
  characters: number;
  new_skills_count: number;
  filename: string;
}

interface ResumeInsightsProps {
  /** True when a resume is already stored, enabling the no-upload re-scan. */
  hasStoredResume: boolean;
  /** Called with the freshly added skill names after a successful apply. */
  onSkillsAdded?: (names: string[]) => void;
}

/**
 * Reads a CV and proposes skills for the profile.
 *
 * Two deliberate product decisions:
 *  - Nothing is written until the student confirms. A keyword match is a
 *    suggestion, not a fact about someone's abilities.
 *  - Every suggestion shows the sentence it came from, so the student can
 *    judge it rather than trusting a black box.
 */
const ResumeInsights: React.FC<ResumeInsightsProps> = ({ hasStoredResume, onSkillsAdded }) => {
  const toast = useToast();
  const [result, setResult] = useState<ParseResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const runScan = async (file?: File) => {
    setScanning(true);
    setError('');
    setResult(null);
    try {
      const r = await studentAPI.parseResume(file);
      const data: ParseResult = r.data;
      setResult(data);
      // Pre-select everything new — the common case is "yes, all of these".
      setSelected(new Set(data.skills.filter(s => !s.already_on_profile).map(s => s.id)));
      if (data.new_skills_count === 0) {
        toast.info('Scan complete — no new skills found.');
      }
    } catch (err) {
      setError(extractApiError(err, 'Could not read that resume.'));
    } finally {
      setScanning(false);
    }
  };

  const toggle = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applySelected = async () => {
    if (!selected.size) return;
    setApplying(true);
    try {
      const r = await studentAPI.applyParsedSkills([...selected]);
      const added: string[] = r.data.added ?? [];
      toast.success(
        added.length
          ? `Added ${added.length} skill${added.length === 1 ? '' : 's'} to your profile`
          : 'Those skills were already on your profile'
      );
      onSkillsAdded?.(added);
      // Reflect the new state without a re-scan.
      setResult(prev =>
        prev
          ? {
              ...prev,
              skills: prev.skills.map(s =>
                selected.has(s.id) ? { ...s, already_on_profile: true } : s
              ),
              new_skills_count: prev.skills.filter(
                s => !s.already_on_profile && !selected.has(s.id)
              ).length,
            }
          : prev
      );
      setSelected(new Set());
    } catch (err) {
      toast.error(extractApiError(err, 'Could not add those skills.'));
    } finally {
      setApplying(false);
    }
  };

  const newSkills = result?.skills.filter(s => !s.already_on_profile) ?? [];
  const knownSkills = result?.skills.filter(s => s.already_on_profile) ?? [];

  return (
    <div className="glow-card overflow-hidden">
      {/* Header */}
      <div className="relative overflow-hidden mesh-hero grain p-7">
        <div className="absolute inset-0 grid-lines"></div>
        <div className="relative z-10 flex items-start gap-4">
          <span className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-xl flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-white">Resume intelligence</h2>
              <span className="chip bg-white/10 text-white/70 border border-white/15">Beta</span>
            </div>
            <p className="text-sm text-white/55 mt-1.5 leading-relaxed">
              Scan your CV to find the skills it already proves — each one shown with the line it came from.
            </p>

            <div className="flex flex-wrap gap-2.5 mt-5">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  className="sr-only"
                  disabled={scanning}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) runScan(f);
                    e.target.value = '';
                  }}
                />
                <span className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
                  scanning
                    ? 'bg-white/10 text-white/40 cursor-wait'
                    : 'bg-white text-surface-900 hover:-translate-y-0.5 shadow-lg'
                }`}>
                  {scanning ? (
                    <>
                      <span className="spinner-gradient !w-4 !h-4"></span>
                      Reading…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Upload &amp; scan
                    </>
                  )}
                </span>
              </label>

              {hasStoredResume && (
                <button
                  onClick={() => runScan()}
                  disabled={scanning}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-white/10 border border-white/20 backdrop-blur hover:bg-white/20 transition-all duration-200 disabled:opacity-40"
                >
                  Scan my saved resume
                </button>
              )}
            </div>
            <p className="text-[11px] text-white/35 mt-3">PDF, DOCX or TXT · max 5 MB · nothing is saved until you confirm</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-7">
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 ring-1 ring-red-200/70">
            <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}

        {!result && !error && !scanning && (
          <p className="text-sm text-surface-400 text-center py-6">
            No scan yet — upload a CV above to see what it proves.
          </p>
        )}

        {result && (
          <>
            {/* What we read */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
              {[
                { v: String(result.skills.length), l: 'Skills found' },
                { v: result.experience_years != null ? `${result.experience_years}y` : '—', l: 'Experience' },
                { v: result.education_level ?? '—', l: 'Education' },
                { v: result.words.toLocaleString(), l: 'Words read' },
              ].map(s => (
                <div key={s.l} className="rounded-2xl bg-surface-50 border border-surface-200/70 p-4">
                  <p className="text-xl font-extrabold text-surface-900 tabular-nums truncate">{s.v}</p>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-surface-400 font-bold mt-1">{s.l}</p>
                </div>
              ))}
            </div>

            {newSkills.length > 0 ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="font-bold text-surface-900">
                      {newSkills.length} new skill{newSkills.length === 1 ? '' : 's'} detected
                    </h3>
                    <p className="text-xs text-surface-400 mt-0.5">Untick anything you'd rather not claim.</p>
                  </div>
                  <button
                    onClick={() =>
                      setSelected(
                        selected.size === newSkills.length ? new Set() : new Set(newSkills.map(s => s.id))
                      )
                    }
                    className="text-xs font-bold text-primary-600 hover:text-primary-700 link-hover"
                  >
                    {selected.size === newSkills.length ? 'Clear all' : 'Select all'}
                  </button>
                </div>

                <div className="space-y-2.5">
                  {newSkills.map((s, i) => {
                    const checked = selected.has(s.id);
                    const open = expanded === s.id;
                    return (
                      <div
                        key={s.id}
                        style={{ '--i': i } as React.CSSProperties}
                        className={`reveal rounded-2xl border transition-all duration-200 ${
                          checked ? 'border-primary-300 bg-primary-50/40' : 'border-surface-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3 p-4">
                          <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(s.id)}
                              className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500 focus:ring-offset-0"
                            />
                            <span className="font-bold text-surface-900 truncate">{s.name}</span>
                            <span className="chip chip-idle shrink-0">
                              {s.occurrences}× mentioned
                            </span>
                          </label>
                          {s.evidence && (
                            <button
                              onClick={() => setExpanded(open ? null : s.id)}
                              aria-expanded={open}
                              aria-label={`${open ? 'Hide' : 'Show'} evidence for ${s.name}`}
                              className="p-1.5 rounded-lg text-surface-400 hover:text-primary-600 hover:bg-primary-50 transition-colors shrink-0"
                            >
                              <svg className={`w-4 h-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          )}
                        </div>
                        {open && s.evidence && (
                          <div className="expand-in px-4 pb-4 -mt-1">
                            <p className="text-sm text-surface-500 italic leading-relaxed pl-4 border-l-2 border-primary-300">
                              “{s.evidence}”
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={applySelected}
                  disabled={applying || selected.size === 0}
                  className="btn-primary w-full mt-6"
                >
                  {applying
                    ? 'Adding…'
                    : selected.size === 0
                      ? 'Select skills to add'
                      : `Add ${selected.size} skill${selected.size === 1 ? '' : 's'} to my profile`}
                </button>
              </>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 p-7 text-center">
                <p className="font-bold text-surface-900">Nothing new to add</p>
                <p className="text-sm text-surface-500 mt-1.5">
                  Every skill this CV proves is already on your profile.
                </p>
              </div>
            )}

            {knownSkills.length > 0 && (
              <div className="mt-7 pt-6 border-t border-surface-100">
                <p className="text-[11px] uppercase tracking-[0.14em] font-bold text-surface-400 mb-3">
                  Already on your profile · {knownSkills.length}
                </p>
                <div className="flex flex-wrap gap-2">
                  {knownSkills.map(s => (
                    <span key={s.id} className="chip chip-done">{s.name}</span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ResumeInsights;
