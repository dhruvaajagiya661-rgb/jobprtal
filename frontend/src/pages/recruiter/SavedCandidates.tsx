import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { recruiterAPI } from '../../api/client';
import { extractApiError } from '../../utils/errors';
import { useToast } from '../../context/ToastContext';

interface SavedCandidate {
  id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  skills: string[];
  education: string;
  experience: string;
  resume: string | null;
  profile_photo: string | null;
  portfolio_link: string | null;
  github_link: string | null;
  linkedin_link: string | null;
  notes: string;
  saved_at: string;
}

const SavedCandidates: React.FC = () => {
  const toast = useToast();
  const [candidates, setCandidates] = useState<SavedCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [skill, setSkill] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  // Which card has its note open for editing, and the in-progress text.
  const [editingNote, setEditingNote] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  useEffect(() => {
    let cancelled = false;
    recruiterAPI
      .savedCandidates()
      .then(r => { if (!cancelled) setCandidates((Array.isArray(r.data) ? r.data : (r.data?.results || [])) as SavedCandidate[]); })
      .catch(err => {
        if (!cancelled) setError(extractApiError(err, 'Could not load your saved candidates.'));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Options come from the full saved set so they stay stable as filters narrow it.
  const allSkills = useMemo(
    () => Array.from(new Set(candidates.flatMap(c => c.skills))).sort((a, b) => a.localeCompare(b)),
    [candidates]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return candidates.filter(c => {
      const matchesSearch =
        !q ||
        c.student_name.toLowerCase().includes(q) ||
        c.student_email.toLowerCase().includes(q) ||
        c.notes.toLowerCase().includes(q);
      const matchesSkill = !skill || c.skills.includes(skill);
      return matchesSearch && matchesSkill;
    });
  }, [candidates, search, skill]);

  const handleRemove = async (candidate: SavedCandidate) => {
    if (!window.confirm(`Remove ${candidate.student_name} from your talent pool?`)) return;
    setBusyId(candidate.student_id);
    try {
      await recruiterAPI.unsaveCandidate(candidate.student_id);
      setCandidates(prev => prev.filter(c => c.id !== candidate.id));
      toast.success('Candidate removed');
    } catch (err) {
      toast.error(extractApiError(err, 'Failed to remove candidate'));
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveNote = async (candidate: SavedCandidate) => {
    setBusyId(candidate.student_id);
    try {
      await recruiterAPI.saveCandidate(candidate.student_id, noteDraft);
      setCandidates(prev =>
        prev.map(c => (c.id === candidate.id ? { ...c, notes: noteDraft } : c))
      );
      setEditingNote(null);
      toast.success('Note saved');
    } catch (err) {
      toast.error(extractApiError(err, 'Failed to save note'));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Saved Candidates</h1>
          <p className="text-gray-500">
            {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} in your talent pool
          </p>
        </div>
        <Link to="/recruiter/applicants" className="btn-secondary text-sm">Browse applicants</Link>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100 mt-4">{error}</div>
      )}

      {candidates.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 my-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, email or notes…"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <select
              value={skill}
              onChange={e => setSkill(e.target.value)}
              disabled={allSkills.length === 0}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">{allSkills.length === 0 ? 'No skills listed' : 'All skills'}</option>
              {allSkills.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      )}

      {candidates.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900">No saved candidates yet</h3>
          <p className="text-gray-500 mt-1 max-w-md mx-auto">
            Save promising applicants from the applicants list and they'll be waiting here for
            your next opening — even after the role they applied to is closed.
          </p>
          <Link to="/recruiter/applicants" className="btn-primary mt-6 inline-block">Review applicants</Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <h3 className="text-lg font-medium text-gray-900">No matches</h3>
          <p className="text-gray-500 mt-1">Try a different search or skill filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(c => (
            <div key={c.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    {c.profile_photo ? (
                      <img src={c.profile_photo} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-11 h-11 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-primary-600 font-semibold">
                          {c.student_name?.[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <Link
                        to={`/profile/${c.student_id}`}
                        className="font-semibold text-gray-900 hover:text-primary-600 transition-colors truncate block"
                      >
                        {c.student_name}
                      </Link>
                      <p className="text-sm text-gray-500 truncate">{c.student_email}</p>
                    </div>
                  </div>

                  {c.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {(Array.isArray(c.skills) ? c.skills : []).slice(0, 8).map(s => (
                        <span key={s} className="inline-block text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{s}</span>
                      ))}
                      {c.skills.length > 8 && (
                        <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                          +{c.skills.length - 8} more
                        </span>
                      )}
                    </div>
                  )}

                  {c.education && (
                    <div className="mb-2">
                      <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Education</p>
                      <p className="text-sm text-gray-600 whitespace-pre-line line-clamp-3">{c.education}</p>
                    </div>
                  )}

                  {c.experience && (
                    <div className="mb-2">
                      <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Experience</p>
                      <p className="text-sm text-gray-600 whitespace-pre-line line-clamp-3">{c.experience}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-4 mt-3">
                    {c.resume ? (
                      <a href={c.resume} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                        View Resume →
                      </a>
                    ) : (
                      <span className="text-sm text-gray-400">No resume on profile</span>
                    )}
                    {c.portfolio_link && (
                      <a href={c.portfolio_link} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-gray-700">Portfolio</a>
                    )}
                    {c.github_link && (
                      <a href={c.github_link} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-gray-700">GitHub</a>
                    )}
                    {c.linkedin_link && (
                      <a href={c.linkedin_link} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-gray-700">LinkedIn</a>
                    )}
                  </div>

                  {/* Private note — why this person was worth keeping. */}
                  <div className="mt-4 pt-3 border-t border-gray-50">
                    {editingNote === c.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={noteDraft}
                          onChange={e => setNoteDraft(e.target.value)}
                          rows={2}
                          placeholder="Why is this candidate worth remembering?"
                          className="input-field !text-sm"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSaveNote(c)}
                            disabled={busyId === c.student_id}
                            className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50"
                          >
                            {busyId === c.student_id ? 'Saving…' : 'Save note'}
                          </button>
                          <button onClick={() => setEditingNote(null)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingNote(c.id); setNoteDraft(c.notes); }}
                        className="text-left w-full group"
                      >
                        <span className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Note</span>
                        <span className="block text-sm text-gray-600 group-hover:text-primary-600 transition-colors">
                          {c.notes || 'Add a note…'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-stretch gap-2 shrink-0 w-full sm:w-auto">
                  <Link to={`/profile/${c.student_id}`} className="text-xs font-medium text-primary-600 hover:text-primary-700 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors text-center">
                    View profile
                  </Link>
                  <button
                    onClick={() => handleRemove(c)}
                    disabled={busyId === c.student_id}
                    className="text-xs font-medium text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3">Saved {new Date(c.saved_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedCandidates;
