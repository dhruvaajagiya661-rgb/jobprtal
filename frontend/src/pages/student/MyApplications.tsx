import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { studentAPI, applicationsAPI } from '../../api/client';
import { extractApiError } from '../../utils/errors';
import { useToast } from '../../context/ToastContext';

interface Application {
  id: number;
  job: { id: number; title: string; company: { name: string }; salary: string; location: string } | null;
  internship: { id: number; title: string; company: { name: string }; stipend: string } | null;
  status: string;
  applied_at: string;
  updated_at: string;
}

const statusColors: Record<string, string> = {
  Applied: 'badge-warning',
  Shortlisted: 'badge-primary',
  Accepted: 'badge-success',
  Rejected: 'badge-danger',
};

const MyApplications: React.FC = () => {
  const toast = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState<number | null>(null);

  useEffect(() => {
    studentAPI.applications().then(r => {
      setApplications(r.data.results || r.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleWithdraw = async (app: Application) => {
    if (!window.confirm(`Withdraw your application for "${app.job?.title || app.internship?.title || 'this position'}"?`)) return;
    setWithdrawing(app.id);
    try {
      await applicationsAPI.withdraw(app.id);
      setApplications(prev => prev.filter(a => a.id !== app.id));
    } catch (err) {
      toast.error(extractApiError(err, 'Failed to withdraw application'));
    } finally {
      setWithdrawing(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Applications</h1>
          <p className="text-gray-500 mt-1">Track all your job and internship applications</p>
        </div>
        <Link to="/student/applications/board" className="mt-4 md:mt-0 btn-primary text-sm py-2 px-4">
          📊 Board View
        </Link>
      </div>
      <div className="mb-8"></div>

      {applications.length === 0 ? (
        <div className="text-center py-20">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900">No applications yet</h3>
          <p className="text-gray-500 mt-1">Start applying to jobs and internships</p>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map(app => {
            const title = app.job?.title || app.internship?.title || 'Position';
            const company = app.job?.company?.name || app.internship?.company?.name || '';
            const detail = app.job?.salary || app.internship?.stipend || '';
            return (
              <div key={app.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{title}</h3>
                    <p className="text-sm text-gray-500">{company}</p>
                    {detail && <p className="text-sm text-gray-400 mt-1">{detail}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={statusColors[app.status] || 'badge-warning'}>{app.status}</span>
                    {(app.status === 'Applied' || app.status === 'Shortlisted') && (
                      <button
                        type="button"
                        onClick={() => handleWithdraw(app)}
                        disabled={withdrawing === app.id}
                        className="text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
                      >
                        {withdrawing === app.id ? 'Withdrawing...' : 'Withdraw'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-4 text-xs text-gray-400">
                  <span>Applied: {new Date(app.applied_at).toLocaleDateString()}</span>
                  <span>Updated: {new Date(app.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyApplications;
