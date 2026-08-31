import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { recruiterAPI } from '../../api/client';
import { extractApiError } from '../../utils/errors';
import { useToast } from '../../context/ToastContext';

interface Applicant {
  id: number;
  job: { id: number; title: string; company: { name: string } } | null;
  internship: { id: number; title: string; company: { name: string } } | null;
  student: number;
  student_name: string;
  student_email: string;
  student_skills: string[];
  resume: string;
  status: string;
  applied_at: string;
}

const STATUS_OPTIONS = ['Applied', 'Shortlisted', 'Accepted', 'Rejected'];

const statusColors: Record<string, string> = {
  Applied: 'badge-warning',
  Shortlisted: 'badge-primary',
  Accepted: 'badge-success',
  Rejected: 'badge-danger',
};

const Applicant: React.FC = () => {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters (search is debounced to avoid hammering the API per keystroke)
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [skill, setSkill] = useState('');
  const [allSkills, setAllSkills] = useState<string[]>([]);

  // Student ids already in the recruiter's talent pool, so the save button
  // renders in the right state on first paint instead of flipping after a click.
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [savingId, setSavingId] = useState<number | null>(null);

  const jobId = searchParams.get('job_id') ? Number(searchParams.get('job_id')) : undefined;

  const hasFilters = debouncedSearch !== '' || status !== '' || skill !== '';

  // Debounce the search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset filters when switching between postings
  useEffect(() => {
    setSearch('');
    setDebouncedSearch('');
    setStatus('');
    setSkill('');
  }, [jobId]);

  const fetchApplicants = () => {
    setLoading(true);
    recruiterAPI
      .applicants({
        job_id: jobId,
        search: debouncedSearch || undefined,
        status: status || undefined,
        skill: skill || undefined,
      })
      .then(r => setApplicants((Array.isArray(r.data) ? r.data : (r.data?.results || [])) as Applicant[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchApplicants(); }, [jobId, debouncedSearch, status, skill]);

  // Build the skill dropdown from the unfiltered applicant set so its options
  // stay stable while other filters narrow the list.
  useEffect(() => {
    recruiterAPI
      .applicants({ job_id: jobId })
      .then(r => {
        const data = (Array.isArray(r.data) ? r.data : (r.data?.results || [])) as Applicant[];
        const skills = Array.from(
          new Set(data.flatMap(a => a.student_skills || []))
        ).sort((a, b) => a.localeCompare(b));
        setAllSkills(skills);
      })
      .catch(() => {});
  }, [jobId]);

  // The talent pool is recruiter-wide, not per-posting, so it loads once.
  useEffect(() => {
    let cancelled = false;
    recruiterAPI
      .savedCandidates()
      .then(r => {
        if (cancelled) return;
        const savedArr = (Array.isArray(r.data) ? r.data : (r.data?.results || [])) as { student_id: number }[];
        setSavedIds(new Set(savedArr.map(c => c.student_id)));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleToggleSave = async (studentId: number, name: string) => {
    const alreadySaved = savedIds.has(studentId);
    setSavingId(studentId);
    try {
      if (alreadySaved) {
        await recruiterAPI.unsaveCandidate(studentId);
        setSavedIds(prev => {
          const next = new Set(prev);
          next.delete(studentId);
          return next;
        });
        toast.success(`${name} removed from saved candidates`);
      } else {
        await recruiterAPI.saveCandidate(studentId);
        setSavedIds(prev => new Set(prev).add(studentId));
        toast.success(`${name} saved to your talent pool`);
      }
    } catch (err) {
      toast.error(extractApiError(err, 'Failed to update saved candidates'));
    } finally {
      setSavingId(null);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatus('');
    setSkill('');
  };

  const handleStatusChange = async (appId: number, newStatus: string) => {
    try {
      await recruiterAPI.updateApplicationStatus(appId, newStatus);
      fetchApplicants();
    } catch (err) { toast.error(extractApiError(err, 'Failed to update status')); }
  };

  // Keep the page (and its filter bar) mounted once data has loaded; only a
  // full-page spinner on the very first load. Filter changes just update the
  // results so the search box never disappears mid-typing.
  if (loading && applicants.length === 0) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Applicants</h1>
        <div className="flex items-center gap-4">
          <p className="text-gray-500">{applicants.length} applicant{applicants.length !== 1 ? 's' : ''} found</p>
          <Link to="/recruiter/saved-candidates" className="btn-secondary text-xs py-1.5 px-3">
            Saved candidates{savedIds.size > 0 && ` (${savedIds.size})`}
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Search by name or email */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Status filter */}
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Skill filter */}
          <select
            value={skill}
            onChange={e => setSkill(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            disabled={allSkills.length === 0}
          >
            <option value="">{allSkills.length === 0 ? 'No skills listed' : 'All skills'}</option>
            {allSkills.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Filtering by {[debouncedSearch && `name/email “${debouncedSearch}”`, status && `status “${status}”`, skill && `skill “${skill}”`].filter(Boolean).join(' · ')}
            </p>
            <button onClick={clearFilters} className="text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors">
              Clear filters
            </button>
          </div>
        )}
      </div>

      {applicants.length === 0 ? (
        <div className="text-center py-20">
          <h3 className="text-lg font-medium text-gray-900">No applicants found</h3>
          <p className="text-gray-500 mt-1">
            {hasFilters ? 'Try adjusting your search or filters' : 'Applications will appear here once students start applying'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {applicants.map(app => (
            <div key={app.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-primary-600 font-semibold">{app.student_name?.[0] || '?'}</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{app.student_name || 'Applicant'}</h3>
                      <p className="text-sm text-gray-500 truncate">{app.student_email}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">
                    Applied for: <span className="font-medium">{app.job?.title || app.internship?.title}</span>
                    <span className={`ml-2 inline-block text-xs px-2 py-0.5 rounded-full ${app.job ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {app.job ? 'Job' : app.internship ? 'Internship' : 'Position'}
                    </span>
                  </p>
                  {app.student_skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(Array.isArray(app.student_skills) ? app.student_skills : []).slice(0, 5).map(s => (
                        <span key={s} className="inline-block text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{s}</span>
                      ))}
                      {app.student_skills.length > 5 && (
                        <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">+{app.student_skills.length - 5} more</span>
                      )}
                    </div>
                  )}
                  {app.resume && (
                    <a href={app.resume} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 hover:text-primary-700 mt-2 inline-block">
                      View Resume →
                    </a>
                  )}
                </div>
                <div className="text-right shrink-0 ml-4">
                  <span className={statusColors[app.status] || 'badge-warning'}>{app.status}</span>
                  <div className="flex justify-end gap-1 mt-2">
                    <button
                      onClick={() => handleToggleSave(app.student, app.student_name || 'Applicant')}
                      disabled={savingId === app.student}
                      title={savedIds.has(app.student) ? 'Remove from your talent pool' : 'Keep this candidate for future roles'}
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                        savedIds.has(app.student)
                          ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                          : 'text-gray-500 hover:text-primary-600 hover:bg-primary-50'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" fill={savedIds.has(app.student) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                      {savedIds.has(app.student) ? 'Saved' : 'Save'}
                    </button>

                  </div>
                  <div className="flex gap-1 mt-2">
                    {['Shortlisted', 'Accepted', 'Rejected'].map(s => (
                      <button key={s} onClick={() => handleStatusChange(app.id, s)}
                        className={`text-xs px-2 py-1 rounded transition-colors ${
                          app.status === s
                            ? s === 'Accepted' ? 'bg-green-100 text-green-700'
                            : s === 'Shortlisted' ? 'bg-blue-100 text-blue-700'
                            : 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3">Applied {new Date(app.applied_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Applicant;
