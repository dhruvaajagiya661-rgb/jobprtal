import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { recruiterAPI } from '../../api/client';
import { extractApiError } from '../../utils/errors';

const JOB_TYPES = ['Full-time', 'Part-time', 'Remote', 'On-site'];

const EMPTY_FORM = {
  title: '', description: '', requirements: '', location: '',
  salary: '', job_type: 'Full-time', experience_required: '',
  deadline: '', openings: '1', category_name: '',
  skills_required: '', preferred_skills: '',
};

interface Skill { id: number; name: string }

/** A job record handed over by "Duplicate", shaped into form values. */
interface JobTemplate {
  title?: string;
  description?: string;
  requirements?: string;
  location?: string;
  salary?: string;
  job_type?: string;
  experience_required?: string;
  openings?: number;
  category?: { name: string } | null;
  skills_required?: Skill[];
  preferred_skills?: Skill[];
}

function formFromTemplate(job: JobTemplate): typeof EMPTY_FORM {
  return {
    ...EMPTY_FORM,
    title: job.title ? `${job.title} (Copy)` : '',
    description: job.description || '',
    requirements: job.requirements || '',
    location: job.location || '',
    salary: job.salary || '',
    job_type: job.job_type || 'Full-time',
    experience_required: job.experience_required || '',
    // Deliberately not copied: the original's deadline is very likely in the
    // past, and a silently-stale date is worse than an empty required field.
    deadline: '',
    openings: String(job.openings ?? 1),
    category_name: job.category?.name || '',
    skills_required: (job.skills_required || []).map(sk => sk.name).join(', '),
    preferred_skills: (job.preferred_skills || []).map(sk => sk.name).join(', '),
  };
}

const PostJob: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // "Duplicate" on a job card navigates here with the source job in route
  // state; everything but the deadline is carried over as an editable draft.
  const template = (location.state as { template?: JobTemplate } | null)?.template;
  const [form, setForm] = useState(() => (template ? formFromTemplate(template) : EMPTY_FORM));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const data = {
      ...form,
      openings: parseInt(form.openings),
      skills_required: form.skills_required.split(',').map(s => s.trim()).filter(Boolean),
      preferred_skills: form.preferred_skills.split(',').map(s => s.trim()).filter(Boolean),
    };

    try {
      await recruiterAPI.createJob(data);
      navigate('/recruiter/jobs');
    } catch (err: unknown) {
      // Shared helper understands the backend's error envelope
      // ({ error, message, code, fields? }) as well as raw DRF field maps.
      setError(extractApiError(err, 'Failed to post job'));
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Post a New Job</h1>
      <p className="text-gray-500 mb-8">
        {template
          ? `Pre-filled from “${template.title}”. Edit anything you like — this will be posted as a new listing.`
          : 'Fill in the details below to create a job listing'}
      </p>

      {template && (
        <div className="bg-primary-50 text-primary-700 text-sm p-3 rounded-lg border border-primary-100 mb-6 flex items-center justify-between gap-3">
          <span>Using an existing job as a template. Set a new deadline before posting.</span>
          <button
            type="button"
            onClick={() => { setForm(EMPTY_FORM); navigate('/recruiter/post-job', { replace: true }); }}
            className="text-xs font-semibold underline shrink-0"
          >
            Start blank
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100">{error}</div>}

        <div className="grid md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Job Title</label>
            <input type="text" name="title" value={form.title} onChange={handleChange} required className="input-field" placeholder="e.g., Senior Frontend Developer" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Job Type</label>
            <select name="job_type" value={form.job_type} onChange={handleChange} className="input-field">
              {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
            <input type="text" name="category_name" value={form.category_name} onChange={handleChange} className="input-field" placeholder="e.g., Development" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
            <input type="text" name="location" value={form.location} onChange={handleChange} required className="input-field" placeholder="e.g., San Francisco, CA" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Salary</label>
            <input type="text" name="salary" value={form.salary} onChange={handleChange} required className="input-field" placeholder="e.g., $80,000 - $120,000" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Experience Required</label>
            <input type="text" name="experience_required" value={form.experience_required} onChange={handleChange} className="input-field" placeholder="e.g., 3-5 years" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Deadline</label>
            <input type="date" name="deadline" value={form.deadline} onChange={handleChange} required className="input-field" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Number of Openings</label>
            <input type="number" name="openings" value={form.openings} onChange={handleChange} min="1" className="input-field" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
          <textarea name="description" value={form.description} onChange={handleChange} required rows={5} className="input-field" placeholder="Describe the role and responsibilities..." />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Requirements</label>
          <textarea name="requirements" value={form.requirements} onChange={handleChange} required rows={5} className="input-field" placeholder="List the key requirements..." />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Required Skills (comma-separated)</label>
          <input type="text" name="skills_required" value={form.skills_required} onChange={handleChange} className="input-field" placeholder="e.g., React, TypeScript, Node.js" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Preferred Skills (comma-separated)</label>
          <input type="text" name="preferred_skills" value={form.preferred_skills} onChange={handleChange} className="input-field" placeholder="e.g., AWS, Docker, GraphQL" />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full py-3">
          {loading ? 'Posting...' : 'Post Job'}
        </button>
      </form>
    </div>
  );
};

export default PostJob;
