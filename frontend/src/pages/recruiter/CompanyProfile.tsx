import React, { useState, useEffect } from 'react';
import { recruiterAPI } from '../../api/client';
import { extractApiError } from '../../utils/errors';
import { useToast } from '../../context/ToastContext';

interface Company {
  id: number;
  name: string;
  description: string;
  industry: string;
  size: string;
  website: string;
  location: string;
  logo?: string;
}

const CompanyProfile: React.FC = () => {
  const toast = useToast();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', industry: '', size: '', website: '', location: '',
  });

  useEffect(() => {
    recruiterAPI.company().then(r => {
      const c = r.data;
      setCompany(c);
      setForm({
        name: c.name || '',
        description: c.description || '',
        industry: c.industry || '',
        size: c.size || '',
        website: c.website || '',
        location: c.location || '',
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, val]) => formData.append(key, val));
      await recruiterAPI.updateCompany(formData);
      toast.success('Company profile updated');
    } catch (err) { toast.error(extractApiError(err, 'Failed to update')); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Company Profile</h1>
      <p className="text-gray-500 mb-8">Manage your company's public information</p>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Company Name</label>
            <input type="text" name="name" value={form.name} onChange={handleChange} required className="input-field" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={4} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Industry</label>
            <input type="text" name="industry" value={form.industry} onChange={handleChange} className="input-field" placeholder="e.g., Technology" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Company Size</label>
            <select name="size" value={form.size} onChange={handleChange} className="input-field">
              <option value="">Select size</option>
              <option value="1-10 employees">1-10 employees</option>
              <option value="11-50 employees">11-50 employees</option>
              <option value="51-200 employees">51-200 employees</option>
              <option value="201-1000 employees">201-1000 employees</option>
              <option value="1000+ employees">1000+ employees</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Website</label>
            <input type="url" name="website" value={form.website} onChange={handleChange} className="input-field" placeholder="https://example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
            <input type="text" name="location" value={form.location} onChange={handleChange} className="input-field" />
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full py-3">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
};

export default CompanyProfile;
