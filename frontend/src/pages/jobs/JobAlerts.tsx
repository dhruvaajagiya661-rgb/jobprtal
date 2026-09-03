import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { jobAlertsAPI } from '../../api/client';
import { asArray } from '../../utils/apiHelpers';
import { extractApiError } from '../../utils/errors';
import { useToast } from '../../context/ToastContext';
import PageHero from '../../components/ui/PageHero';
import useSeo from '../../hooks/useSeo';

interface JobAlert {
  id: number;
  title: string;
  keywords: string;
  location: string;
  job_type: string;
  min_salary: string;
  is_active: boolean;
  created_at: string;
}

const JOB_TYPES = ['Any', 'Full-time', 'Part-time', 'Remote', 'On-site'];

const JobAlerts: React.FC = () => {
  useSeo({ title: 'Job Alerts', noIndex: true });
  const toast = useToast();
  const [alerts, setAlerts] = useState<JobAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', keywords: '', location: '', job_type: 'Any', min_salary: '' });
  const [creating, setCreating] = useState(false);

  const fetchAlerts = () => {
    setLoading(true);
    jobAlertsAPI
      .list()
      .then(r => setAlerts(asArray(r.data)))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAlerts(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await jobAlertsAPI.create(form);
      toast.success('Alert created');
      setShowForm(false);
      setForm({ title: '', keywords: '', location: '', job_type: 'Any', min_salary: '' });
      fetchAlerts();
    } catch (err) {
      toast.error(extractApiError(err, 'Could not create alert'));
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await jobAlertsAPI.toggle(id);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_active: !a.is_active } : a));
    } catch (err) {
      toast.error(extractApiError(err, 'Could not update alert'));
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this alert?')) return;
    try {
      await jobAlertsAPI.delete(id);
      setAlerts(prev => prev.filter(a => a.id !== id));
      toast.success('Alert deleted');
    } catch (err) {
      toast.error(extractApiError(err, 'Could not delete alert'));
    }
  };

  return (
    <div className="pb-20">
      <PageHero
        eyebrow="Never miss an opportunity"
        live
        title="Job Alerts"
        accent="notifications"
        subtitle="Set up alerts and get notified when jobs matching your criteria are posted."
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-surface-900">Your Alerts ({alerts.length})</h2>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm">
            {showForm ? 'Cancel' : '+ New Alert'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="glow-card p-6 mb-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">Alert Name</label>
              <input type="text" value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} required className="input-field" placeholder="e.g., React jobs in Bangalore" />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">Keywords</label>
                <input type="text" value={form.keywords} onChange={e => setForm(prev => ({ ...prev, keywords: e.target.value }))} className="input-field" placeholder="e.g., React, TypeScript" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">Location</label>
                <input type="text" value={form.location} onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))} className="input-field" placeholder="e.g., Bangalore" />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">Job Type</label>
                <select value={form.job_type} onChange={e => setForm(prev => ({ ...prev, job_type: e.target.value }))} className="input-field">
                  {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">Min Salary</label>
                <input type="text" value={form.min_salary} onChange={e => setForm(prev => ({ ...prev, min_salary: e.target.value }))} className="input-field" placeholder="e.g., 50000" />
              </div>
            </div>
            <button type="submit" disabled={creating} className="btn-primary w-full">
              {creating ? 'Creating…' : 'Create Alert'}
            </button>
          </form>
        )}

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-5 border border-surface-200">
                <div className="skeleton h-5 w-1/2 mb-2"></div>
                <div className="skeleton h-4 w-1/3"></div>
              </div>
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-surface-200">
            <svg className="w-16 h-16 text-surface-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-surface-600 font-medium">No alerts yet</p>
            <p className="text-surface-400 text-sm mt-1 mb-6">Create an alert to get notified about matching jobs.</p>
            <button onClick={() => setShowForm(true)} className="btn-primary text-sm">Create your first alert</button>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map(alert => (
              <div key={alert.id} className={`glow-card p-5 flex items-center gap-4 ${!alert.is_active ? 'opacity-60' : ''}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${alert.is_active ? 'bg-emerald-100 text-emerald-600' : 'bg-surface-100 text-surface-400'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-surface-900">{alert.title}</h3>
                  <p className="text-xs text-surface-500 mt-0.5">
                    {[alert.keywords, alert.location, alert.job_type !== 'Any' && alert.job_type, alert.min_salary && `Min $${alert.min_salary}`].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggle(alert.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      alert.is_active
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-surface-100 text-surface-500 hover:bg-surface-200'
                    }`}
                  >
                    {alert.is_active ? 'Active' : 'Paused'}
                  </button>
                  <button onClick={() => handleDelete(alert.id)} className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <Link to="/jobs" className="text-sm font-semibold text-primary-600 hover:text-primary-700 link-hover">
            Browse all jobs →
          </Link>
        </div>
      </div>
    </div>
  );
};

export default JobAlerts;
