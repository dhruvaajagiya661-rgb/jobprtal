import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { extractApiError } from '../../utils/errors';
import { useToast } from '../../context/ToastContext';
import PageHero from '../../components/ui/PageHero';
import useSeo from '../../hooks/useSeo';

interface NotificationPreferences {
  email_applications: boolean;
  email_messages: boolean;
  email_job_alerts: boolean;
  email_network: boolean;
  email_weekly_digest: boolean;
  push_applications: boolean;
  push_messages: boolean;
  push_job_alerts: boolean;
  push_network: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  email_applications: true,
  email_messages: true,
  email_job_alerts: true,
  email_network: true,
  email_weekly_digest: false,
  push_applications: true,
  push_messages: true,
  push_job_alerts: true,
  push_network: true,
};

interface SettingRowProps {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (val: boolean) => void;
}

const SettingRow: React.FC<SettingRowProps> = ({ label, description, enabled, onChange }) => (
  <div className="flex items-center justify-between py-4">
    <div className="min-w-0 flex-1 mr-4">
      <p className="text-sm font-semibold text-surface-900">{label}</p>
      <p className="text-xs text-surface-400 mt-0.5">{description}</p>
    </div>
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
        enabled ? 'bg-primary-600' : 'bg-surface-300'
      }`}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
        enabled ? 'translate-x-5' : 'translate-x-0'
      }`} />
    </button>
  </div>
);

const NotificationSettings: React.FC = () => {
  useSeo({ title: 'Notification Settings', noIndex: true });
  const toast = useToast();
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient.get('/v1/notifications/settings/')
      .then((r: { data: Partial<NotificationPreferences> }) => setPrefs({ ...DEFAULT_PREFS, ...r.data }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const updatePref = (key: keyof NotificationPreferences, value: boolean) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.patch('/v1/notifications/settings/', prefs);
      toast.success('Settings saved');
    } catch (err) {
      toast.error(extractApiError(err, 'Could not save settings'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
        <div className="spinner-gradient !w-11 !w-11 !border-[3px]"></div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      <PageHero
        eyebrow="Customize your experience"
        live
        title="Notification"
        accent="Settings"
        subtitle="Choose what notifications you receive and how."
      />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 space-y-6">
        {/* Email notifications */}
        <div className="glow-card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-surface-900">Email Notifications</h2>
              <p className="text-xs text-surface-400">Receive updates via email</p>
            </div>
          </div>
          <div className="divide-y divide-surface-100">
            <SettingRow
              label="Application updates"
              description="Get notified when your application status changes"
              enabled={prefs.email_applications}
              onChange={v => updatePref('email_applications', v)}
            />
            <SettingRow
              label="New messages"
              description="Email when someone sends you a message"
              enabled={prefs.email_messages}
              onChange={v => updatePref('email_messages', v)}
            />
            <SettingRow
              label="Job alerts"
              description="New jobs matching your saved alerts"
              enabled={prefs.email_job_alerts}
              onChange={v => updatePref('email_job_alerts', v)}
            />
            <SettingRow
              label="Network activity"
              description="Connection requests and profile views"
              enabled={prefs.email_network}
              onChange={v => updatePref('email_network', v)}
            />
            <SettingRow
              label="Weekly digest"
              description="A summary of activity and recommendations"
              enabled={prefs.email_weekly_digest}
              onChange={v => updatePref('email_weekly_digest', v)}
            />
          </div>
        </div>

        {/* Push notifications */}
        <div className="glow-card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-accent-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-surface-900">In-App Notifications</h2>
              <p className="text-xs text-surface-400">Show in the notification bell</p>
            </div>
          </div>
          <div className="divide-y divide-surface-100">
            <SettingRow
              label="Application updates"
              description="Notifications when your application status changes"
              enabled={prefs.push_applications}
              onChange={v => updatePref('push_applications', v)}
            />
            <SettingRow
              label="New messages"
              description="When someone sends you a message"
              enabled={prefs.push_messages}
              onChange={v => updatePref('push_messages', v)}
            />
            <SettingRow
              label="Job alerts"
              description="New jobs matching your saved alerts"
              enabled={prefs.push_job_alerts}
              onChange={v => updatePref('push_job_alerts', v)}
            />
            <SettingRow
              label="Network activity"
              description="Connection requests and profile views"
              enabled={prefs.push_network}
              onChange={v => updatePref('push_network', v)}
            />
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;
