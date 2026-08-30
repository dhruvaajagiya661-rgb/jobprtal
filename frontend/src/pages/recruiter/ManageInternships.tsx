import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { recruiterAPI } from '../../api/client';
import { extractApiError } from '../../utils/errors';
import { useToast } from '../../context/ToastContext';

interface Internship {
  id: number;
  title: string;
  company: { id: number; name: string; logo?: string | null } | null;
  internship_type: string;
  location: string;
  stipend: string;
  duration: string;
  deadline: string | null;
  created_at: string;
  is_active: boolean;
}

/** The applicant counts the internships endpoint doesn't carry, keyed by id. */
interface Counts {
  applicants: number;
  new_applicants: number;
}

const ManageInternships: React.FC = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const [internships, setInternships] = useState<Internship[]>([]);
  const [counts, setCounts] = useState<Record<number, Counts>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    // The list endpoint has the posting's own fields; the dashboard's role
    // rows have the per-role application counts. Neither has both, so fetch
    // both and merge — no new backend surface needed for a count column.
    Promise.all([recruiterAPI.internships(), recruiterAPI.dashboard()])
      .then(([listRes, dashRes]) => {
        if (cancelled) return;
        setInternships((listRes.data || []) as Internship[]);
        const rows = (dashRes.data?.roles || []) as {
          id: number;
          kind: string;
          applicants: number;
          new_applicants: number;
        }[];
        const map: Record<number, Counts> = {};
        rows
          .filter(r => r.kind === 'internship')
          .forEach(r => {
            map[r.id] = { applicants: r.applicants, new_applicants: r.new_applicants };
          });
        setCounts(map);
      })
      .catch(err => {
        if (!cancelled) setError(extractApiError(err, 'Could not load your internships.'));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleDelete = async (internship: Internship) => {
    const applicants = counts[internship.id]?.applicants ?? 0;
    const warning = applicants
      ? `\n\nThis will also remove ${applicants} application${applicants === 1 ? '' : 's'}.`
      : '';
    if (!window.confirm(`Delete “${internship.title}”?${warning}`)) return;
    setDeletingId(internship.id);
    try {
      await recruiterAPI.deleteInternship(internship.id);
      setInternships(prev => prev.filter(i => i.id !== internship.id));
      toast.success('Internship deleted');
    } catch (err) {
      toast.error(extractApiError(err, 'Failed to delete internship'));
    } finally {
      setDeletingId(null);
    }
  };

  const daysLeft = (deadline: string | null): number | null => {
    if (!deadline) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(deadline);
    end.setHours(0, 0, 0, 0);
    return Math.round((end.getTime() - today.getTime()) / 86400000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const active = internships.filter(i => i.is_active).length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Internships</h1>
          <p className="text-gray-500">
            {internships.length} internship{internships.length !== 1 ? 's' : ''} posted by you
            {internships.length > 0 && ` · ${active} active`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/recruiter/jobs" className="btn-secondary text-sm">Manage Jobs</Link>
          <Link to="/recruiter/post-internship" className="btn-primary text-sm">Post Internship</Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100 mb-6">{error}</div>
      )}

      {internships.length === 0 ? (
        <div className="text-center py-20">
          <h3 className="text-lg font-medium text-gray-900">No internships yet</h3>
          <p className="text-gray-500 mt-1">Post your first internship to start receiving applications</p>
          <Link to="/recruiter/post-internship" className="btn-primary mt-6 inline-block">Post an Internship</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {internships.map(internship => {
            const applicants = counts[internship.id]?.applicants ?? 0;
            const unreviewed = counts[internship.id]?.new_applicants ?? 0;
            const left = daysLeft(internship.deadline);
            // Past its closing date but still accepting applicants — the
            // thing recruiters most often forget to act on.
            const overdue = left !== null && left < 0;
            return (
              <div key={internship.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{internship.title}</h3>
                      <span className={`badge ${internship.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {internship.is_active ? 'Active' : 'Closed'}
                      </span>
                      {overdue && internship.is_active && (
                        <span className="badge badge-warning">Past deadline</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {internship.company?.name || 'Your company'} · {internship.location}
                    </p>

                    <dl className="flex flex-wrap items-center gap-x-6 gap-y-1 mt-3 text-sm">
                      <div className="flex items-center gap-1.5">
                        <dt className="text-gray-400">Type</dt>
                        <dd className="font-medium text-gray-700">{internship.internship_type || '—'}</dd>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <dt className="text-gray-400">Stipend</dt>
                        <dd className="font-medium text-primary-600">{internship.stipend || '—'}</dd>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <dt className="text-gray-400">Duration</dt>
                        <dd className="font-medium text-gray-700">{internship.duration || '—'}</dd>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <dt className="text-gray-400">Deadline</dt>
                        <dd className={`font-medium ${overdue ? 'text-red-600' : left !== null && left <= 7 ? 'text-amber-600' : 'text-gray-700'}`}>
                          {internship.deadline
                            ? `${new Date(internship.deadline).toLocaleDateString()}${
                                left === null ? '' : overdue ? ' (passed)' : ` (${left}d left)`
                              }`
                            : '—'}
                        </dd>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <dt className="text-gray-400">Applications</dt>
                        <dd className="font-medium text-gray-700">
                          {applicants}
                          {unreviewed > 0 && (
                            <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">
                              {unreviewed} new
                            </span>
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      to={`/recruiter/applicants?internship_id=${internship.id}`}
                      className="btn-secondary text-xs py-1.5 px-3"
                    >
                      Applicants
                    </Link>
                    <button
                      onClick={() => navigate(`/recruiter/post-internship?edit=${internship.id}`)}
                      className="text-xs font-medium text-primary-600 hover:text-primary-700 px-2.5 py-1.5 rounded-lg hover:bg-primary-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(internship)}
                      disabled={deletingId === internship.id}
                      aria-label={`Delete ${internship.title}`}
                      className="text-red-500 hover:text-red-700 p-2 disabled:opacity-40"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  Posted {new Date(internship.created_at).toLocaleDateString()}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ManageInternships;
