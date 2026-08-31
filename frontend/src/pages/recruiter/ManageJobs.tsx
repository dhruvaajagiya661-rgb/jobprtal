import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { recruiterAPI } from '../../api/client';
import { extractApiError } from '../../utils/errors';
import { useToast } from '../../context/ToastContext';

interface Job {
  id: number;
  title: string;
  job_type: string;
  location: string;
  salary: string;
  created_at: string;
  is_active: boolean;
  applications?: { id: number }[];
}

interface Internship {
  id: number;
  title: string;
  internship_type: string;
  location: string;
  stipend: string;
  duration: string;
  created_at: string;
  is_active: boolean;
}

type RecruiterPost =
  | (Job & { postType: 'job' })
  | (Internship & { postType: 'internship' });

const ManageJobs: React.FC = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<RecruiterPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([recruiterAPI.jobs(), recruiterAPI.internships()])
      .then(([jobsResponse, internshipsResponse]) => {
        const jobsArr = Array.isArray(jobsResponse.data) ? jobsResponse.data : (jobsResponse.data?.results || []);
        const internshipsArr = Array.isArray(internshipsResponse.data) ? internshipsResponse.data : (internshipsResponse.data?.results || []);
        const ownJobs = jobsArr.map((job: Job) => ({ ...job, postType: 'job' as const }));
        const ownInternships = internshipsArr.map((internship: Internship) => ({
          ...internship,
          postType: 'internship' as const,
        }));
        setPosts([...ownJobs, ...ownInternships].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /** Open the post form pre-filled from an existing job, as a new draft.
   *
   * The full record is fetched here rather than reused from the list: the
   * list serializer has no description, requirements or preferred skills, so
   * duplicating from it would silently drop the bulk of the posting. It goes
   * through the recruiter-scoped detail endpoint because a closed job is not
   * readable from the public one.
   */
  const handleDuplicate = async (jobId: number) => {
    setDuplicatingId(jobId);
    try {
      const { data } = await recruiterAPI.jobDetail(jobId);
      navigate('/recruiter/post-job', { state: { template: data } });
    } catch (err) {
      toast.error(extractApiError(err, 'Could not load this job to duplicate'));
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleDelete = async (jobId: number) => {
    if (!window.confirm('Are you sure you want to delete this job?')) return;
    try {
      await recruiterAPI.deleteJob(jobId);
      setPosts(prev => prev.filter(post => post.postType !== 'job' || post.id !== jobId));
    } catch (err) { toast.error(extractApiError(err, 'Failed to delete job')); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Posts</h1>
          <p className="text-gray-500">{posts.length} post{posts.length !== 1 ? 's' : ''} posted by you</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/recruiter/internships" className="btn-secondary text-sm">Manage Internships</Link>
          <Link to="/recruiter/post-job" className="btn-primary text-sm">Post New Job</Link>
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-20">
          <h3 className="text-lg font-medium text-gray-900">No posts yet</h3>
          <p className="text-gray-500 mt-1">Post your first job or internship to start receiving applications</p>
          <Link to="/recruiter/post-job" className="btn-primary mt-6 inline-block">Post a Job</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <div key={`${post.postType}-${post.id}`} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{post.title}</h3>
                    <span className="badge-ghost">{post.postType === 'job' ? 'Job' : 'Internship'}</span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {post.location} • {post.postType === 'job' ? post.job_type : `${post.internship_type} • ${post.duration}`}
                  </p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-sm font-medium text-primary-600">
                      {post.postType === 'job' ? post.salary : post.stipend}
                    </span>
                    <span className={`badge ${post.is_active ? 'badge-success' : 'badge-danger'}`}>
                      {post.is_active ? 'Active' : 'Closed'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to={`/recruiter/applicants?${post.postType === 'job' ? 'job_id' : 'internship_id'}=${post.id}`}
                    className="btn-secondary text-xs py-1.5 px-3"
                  >
                    Applicants
                  </Link>
                  {post.postType === 'job' && (
                    <button
                      onClick={() => handleDuplicate(post.id)}
                      disabled={duplicatingId === post.id}
                      title="Start a new posting pre-filled from this one"
                      className="text-xs font-medium text-primary-600 hover:text-primary-700 px-2.5 py-1.5 rounded-lg hover:bg-primary-50 transition-colors disabled:opacity-40"
                    >
                      {duplicatingId === post.id ? 'Opening…' : 'Duplicate'}
                    </button>
                  )}
                  {post.postType === 'internship' && (
                    <button
                      onClick={() => navigate(`/recruiter/post-internship?edit=${post.id}`)}
                      className="text-xs font-medium text-primary-600 hover:text-primary-700 px-2.5 py-1.5 rounded-lg hover:bg-primary-50 transition-colors"
                    >
                      Edit
                    </button>
                  )}
                  {post.postType === 'job' && (
                    <button onClick={() => handleDelete(post.id)} className="text-red-500 hover:text-red-700 p-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3">Posted {new Date(post.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ManageJobs;
