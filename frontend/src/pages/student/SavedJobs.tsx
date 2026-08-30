import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { studentAPI } from '../../api/client';
import { extractApiError } from '../../utils/errors';
import { useToast } from '../../context/ToastContext';

interface Job {
  id: number;
  title: string;
  company: { id: number; name: string; location: string };
  job_type: string;
  salary: string;
  location: string;
}

const SavedJobs: React.FC = () => {
  const toast = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentAPI.savedJobs().then(r => setJobs(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleUnsave = async (jobId: number) => {
    try {
      await studentAPI.unsaveJob(jobId);
      setJobs(prev => prev.filter(j => j.id !== jobId));
    } catch (err) { toast.error(extractApiError(err, 'Failed to unsave')); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Saved Jobs</h1>
      <p className="text-gray-500 mb-8">Jobs you've saved for later</p>

      {jobs.length === 0 ? (
        <div className="text-center py-20">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900">No saved jobs</h3>
          <p className="text-gray-500 mt-1">Save jobs to review them later</p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map(job => (
            <div key={job.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center justify-between">
              <div>
                <Link to={`/jobs/${job.id}`} className="font-semibold text-gray-900 hover:text-primary-600">{job.title}</Link>
                <p className="text-sm text-gray-500">{job.company?.name} • {job.location}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="badge-primary">{job.job_type}</span>
                  <span className="text-sm font-medium text-primary-600">{job.salary}</span>
                </div>
              </div>
              <button onClick={() => handleUnsave(job.id)} className="text-gray-400 hover:text-red-500 transition-colors p-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedJobs;
