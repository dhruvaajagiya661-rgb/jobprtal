import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { recruiterAPI } from '../../api/client';
import { extractApiError } from '../../utils/errors';

const INTERNSHIP_TYPES = ['Full-time', 'Part-time', 'Remote', 'On-site'];

interface Skill { id: number; name: string }

const PostInternship: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Same form serves "post" and "edit"; ?edit=<id> switches it into edit mode
  // rather than duplicating 200 lines of inputs in a second page.
  const editId = searchParams.get('edit') ? Number(searchParams.get('edit')) : null;
  const isEdit = Boolean(editId);

  const [form, setForm] = useState({
    title: '', description: '', requirements: '', location: '',
    stipend: '', duration: '', internship_type: 'Full-time',
    deadline: '', openings: '1', category_name: '',
    skills_required: '', preferred_skills: '',
  });
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(isEdit);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    recruiterAPI
      .internshipDetail(editId)
      .then(r => {
        if (cancelled) return;
        const d = r.data;
        setForm({
          title: d.title || '',
          description: d.description || '',
          requirements: d.requirements || '',
          location: d.location || '',
          stipend: d.stipend || '',
          duration: d.duration || '',
          internship_type: d.internship_type || 'Full-time',
          deadline: d.deadline || '',
          openings: String(d.openings ?? 1),
          category_name: d.category?.name || '',
          skills_required: (d.skills_required || []).map((s: Skill) => s.name).join(', '),
          preferred_skills: (d.preferred_skills || []).map((s: Skill) => s.name).join(', '),
        });
      })
      .catch(err => {
        if (!cancelled) setError(extractApiError(err, 'Could not load this internship.'));
      })
      .finally(() => { if (!cancelled) setLoadingExisting(false); });
    return () => { cancelled = true; };
  }, [editId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const data = {
      ...form,
      openings: parseInt(form.openings, 10) || 1,
      skills_required: form.skills_required.split(',').map(s => s.trim()).filter(Boolean),
      preferred_skills: form.preferred_skills.split(',').map(s => s.trim()).filter(Boolean),
    };

    try {
      if (isEdit) {
        await recruiterAPI.updateInternship({ ...data, internship_id: editId });
      } else {
        await recruiterAPI.createInternship(data);
      }
      navigate('/recruiter/internships');
    } catch (err: unknown) {
      setError(extractApiError(err, isEdit ? 'Failed to update internship' : 'Failed to post internship'));
    } finally {
      setLoading(false);
    }
  };

  if (loadingExisting) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        {isEdit ? 'Edit Internship' : 'Post a New Internship'}
      </h1>
      <p className="text-gray-500 mb-8">
        {isEdit
          ? 'Update the details below — applicants already in the pipeline are unaffected.'
          : 'Fill in the details below to create an internship listing'}
      </p>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100">{error}</div>}

        <div className="grid md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Internship Title</label>
            <input type="text" name="title" value={form.title} onChange={handleChange} required className="input-field" placeholder="e.g., Frontend Engineering Intern" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Internship Type</label>
            <select name="internship_type" value={form.internship_type} onChange={handleChange} className="input-field">
              {INTERNSHIP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
            <input type="text" name="category_name" value={form.category_name} onChange={handleChange} className="input-field" placeholder="e.g., Development" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
            <input type="text" name="location" value={form.location} onChange={handleChange} required className="input-field" placeholder="e.g., Bengaluru, India" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Stipend</label>
            <input type="text" name="stipend" value={form.stipend} onChange={handleChange} required className="input-field" placeholder="e.g., ₹20,000/month or Unpaid" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Duration</label>
            <input type="text" name="duration" value={form.duration} onChange={handleChange} required className="input-field" placeholder="e.g., 3 months" />
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
          <textarea name="description" value={form.description} onChange={handleChange} required rows={5} className="input-field" placeholder="Describe the internship and what the intern will work on..." />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Requirements</label>
          <textarea name="requirements" value={form.requirements} onChange={handleChange} required rows={5} className="input-field" placeholder="List the key requirements..." />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Required Skills (comma-separated)</label>
          <input type="text" name="skills_required" value={form.skills_required} onChange={handleChange} className="input-field" placeholder="e.g., React, TypeScript" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Preferred Skills (comma-separated)</label>
          <input type="text" name="preferred_skills" value={form.preferred_skills} onChange={handleChange} className="input-field" placeholder="e.g., Figma, Testing" />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={loading} className="btn-primary flex-1 py-3">
            {loading
              ? (isEdit ? 'Saving...' : 'Posting...')
              : (isEdit ? 'Save Changes' : 'Post Internship')}
          </button>
          {isEdit && (
            <button
              type="button"
              onClick={() => navigate('/recruiter/internships')}
              className="btn-secondary py-3 px-6"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default PostInternship;
