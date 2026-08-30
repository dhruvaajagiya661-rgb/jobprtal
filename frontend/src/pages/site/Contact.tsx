import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import PageHero from '../../components/ui/PageHero';
import { platformAPI } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { SITE } from '../../config/site';
import { extractApiError } from '../../utils/errors';
import useSeo from '../../hooks/useSeo';

type Field = 'name' | 'email' | 'subject' | 'message';
type Form = Record<Field, string>;

const EMPTY: Form = { name: '', email: '', subject: '', message: '' };

const SUBJECTS = [
  'General question',
  'Trouble with my account',
  'Reporting a job posting',
  'Recruiter / employer enquiry',
  'Privacy or data request',
  'Something else',
];

const Contact: React.FC = () => {
  useSeo({
    title: 'Contact',
    description: `Get in touch with the ${SITE.name} team. We reply ${SITE.responseTime}.`,
  });

  const toast = useToast();
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const update =
    (field: Field) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
      setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
    };

  /** Mirror the server rules so obvious mistakes are caught without a round trip. */
  const validate = (): boolean => {
    const next: Partial<Record<Field, string>> = {};
    if (!form.name.trim()) next.name = 'Tell us who you are.';
    if (!form.email.trim()) next.email = 'We need an address to reply to.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      next.email = 'That does not look like a valid email address.';
    if (!form.subject.trim()) next.subject = 'Pick a subject.';
    if (!form.message.trim()) next.message = 'Add a message so we know how to help.';
    else if (form.message.trim().length < 20)
      next.message = 'A little more detail will get you a better answer (20+ characters).';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending || !validate()) return;

    setSending(true);
    try {
      const { data } = await platformAPI.contact({
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim(),
        message: form.message.trim(),
      });
      setSent(true);
      setForm(EMPTY);
      toast.success(data.detail);
    } catch (err) {
      // Surface per-field problems the server caught that the client did not.
      const response = (err as { response?: { data?: { errors?: Record<string, string> } } })
        .response;
      if (response?.data?.errors) {
        setErrors(response.data.errors as Partial<Record<Field, string>>);
      }
      toast.error(extractApiError(err, 'We could not send your message. Please try again.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-surface-50 min-h-screen">
      <PageHero
        eyebrow="Contact"
        title="Talk to"
        accent="a human."
        subtitle={`Questions, bug reports, partnership ideas — all of it reaches the same inbox, and we reply ${SITE.responseTime}.`}
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Contact' }]}
        center
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid lg:grid-cols-[1.5fr,1fr] gap-8 items-start">
          <div className="card p-6 md:p-8 animate-fade-in-up">
            {sent ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-5">
                  <svg
                    className="w-8 h-8 text-emerald-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-surface-900 mb-2">Message sent</h2>
                <p className="text-surface-600 mb-6">
                  Thanks for writing in. You will hear back {SITE.responseTime}.
                </p>
                <button type="button" className="btn-outline" onClick={() => setSent(false)}>
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                <h2 className="text-xl font-bold text-surface-900 mb-6">Send us a message</h2>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label
                      htmlFor="contact-name"
                      className="block text-sm font-semibold text-surface-700 mb-1.5"
                    >
                      Your name
                    </label>
                    <input
                      id="contact-name"
                      className={errors.name ? 'input-error' : 'input-field'}
                      value={form.name}
                      onChange={update('name')}
                      autoComplete="name"
                      maxLength={120}
                      aria-invalid={Boolean(errors.name)}
                      aria-describedby={errors.name ? 'contact-name-error' : undefined}
                    />
                    {errors.name && (
                      <p id="contact-name-error" className="text-sm text-red-600 mt-1.5">
                        {errors.name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="contact-email"
                      className="block text-sm font-semibold text-surface-700 mb-1.5"
                    >
                      Email address
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      className={errors.email ? 'input-error' : 'input-field'}
                      value={form.email}
                      onChange={update('email')}
                      autoComplete="email"
                      maxLength={254}
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? 'contact-email-error' : undefined}
                    />
                    {errors.email && (
                      <p id="contact-email-error" className="text-sm text-red-600 mt-1.5">
                        {errors.email}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-5">
                  <label
                    htmlFor="contact-subject"
                    className="block text-sm font-semibold text-surface-700 mb-1.5"
                  >
                    Subject
                  </label>
                  <select
                    id="contact-subject"
                    className={errors.subject ? 'input-error' : 'input-field'}
                    value={form.subject}
                    onChange={update('subject')}
                    aria-invalid={Boolean(errors.subject)}
                  >
                    <option value="">Choose one...</option>
                    {SUBJECTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {errors.subject && (
                    <p className="text-sm text-red-600 mt-1.5">{errors.subject}</p>
                  )}
                </div>

                <div className="mt-5">
                  <label
                    htmlFor="contact-message"
                    className="block text-sm font-semibold text-surface-700 mb-1.5"
                  >
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    className={errors.message ? 'input-error' : 'input-field'}
                    value={form.message}
                    onChange={update('message')}
                    rows={6}
                    maxLength={5000}
                    aria-invalid={Boolean(errors.message)}
                    aria-describedby={errors.message ? 'contact-message-error' : undefined}
                  />
                  <div className="flex justify-between mt-1.5">
                    {errors.message ? (
                      <p id="contact-message-error" className="text-sm text-red-600">
                        {errors.message}
                      </p>
                    ) : (
                      <span />
                    )}
                    <span className="text-xs text-surface-400">{form.message.length}/5000</span>
                  </div>
                </div>

                <button type="submit" className="btn-primary w-full mt-7" disabled={sending}>
                  {sending ? 'Sending...' : 'Send message'}
                </button>
                <p className="text-xs text-surface-400 mt-3 text-center">
                  We use your address only to reply. See our{' '}
                  <Link to="/privacy" className="text-primary-600 hover:underline">
                    privacy policy
                  </Link>
                  .
                </p>
              </form>
            )}
          </div>

          <aside className="space-y-4 animate-fade-in-up animation-delay-100">
            <div className="card p-6">
              <h3 className="font-bold text-surface-900 mb-4">Other ways to reach us</h3>
              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="text-surface-500">Email</dt>
                  <dd>
                    <a
                      href={`mailto:${SITE.contactEmail}`}
                      className="text-primary-600 font-medium hover:underline"
                    >
                      {SITE.contactEmail}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-surface-500">Support hours</dt>
                  <dd className="text-surface-800 font-medium">{SITE.supportHours}</dd>
                </div>
                <div>
                  <dt className="text-surface-500">Typical reply</dt>
                  <dd className="text-surface-800 font-medium">{SITE.responseTime}</dd>
                </div>
              </dl>
            </div>

            <div className="card p-6">
              <h3 className="font-bold text-surface-900 mb-2">Hiring on {SITE.name}?</h3>
              <p className="text-sm text-surface-600 mb-4">
                Create a recruiter account to post roles, manage applicants and build a company
                page.
              </p>
              <Link to="/register" className="btn-outline w-full text-center block">
                Create a recruiter account
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Contact;
