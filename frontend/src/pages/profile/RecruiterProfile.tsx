import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { publicRecruiterAPI } from '../../api/client';
import { extractApiError } from '../../utils/errors';

interface Company {
  id: number;
  name: string;
  logo: string | null;
  industry: string | null;
  location: string | null;
  size: string | null;
  website: string | null;
  description: string | null;
  about?: string | null;
  followers_count?: number;
}

interface Listing {
  id: number;
  title: string;
  location: string;
  deadline: string | null;
  salary?: string;
  stipend?: string;
  duration?: string;
  job_type?: string;
  internship_type?: string;
  skills_required: { id: number; name: string }[];
}

interface Review {
  id: number;
  user_username: string;
  title: string;
  content: string;
  rating: number;
  pros: string;
  cons: string;
  employment_status: string;
  created_at: string;
}

interface RecruiterPublic {
  id: number;
  username: string;
  full_name: string;
  designation: string;
  company: Company | null;
  followers_count: number;
  reviews: Review[];
  average_rating: number | null;
  jobs: Listing[];
  internships: Listing[];
}

const Stars: React.FC<{ rating: number }> = ({ rating }) => (
  <span className="text-amber-400 text-sm" aria-label={`${rating} out of 5`}>
    {'★'.repeat(rating)}
    <span className="text-gray-200">{'★'.repeat(Math.max(0, 5 - rating))}</span>
  </span>
);

const ListingCard: React.FC<{ listing: Listing; kind: 'job' | 'internship' }> = ({ listing, kind }) => (
  <Link
    to={kind === 'job' ? `/jobs/${listing.id}` : `/internships/${listing.id}`}
    className="block bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:border-primary-200 hover:shadow-md transition-all"
  >
    <div className="flex items-start justify-between gap-3">
      <h3 className="font-semibold text-gray-900">{listing.title}</h3>
      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${kind === 'job' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
        {kind === 'job' ? 'Job' : 'Internship'}
      </span>
    </div>
    <p className="text-sm text-gray-500 mt-1">
      {listing.location}
      {(listing.job_type || listing.internship_type) && ` · ${listing.job_type || listing.internship_type}`}
      {listing.duration && ` · ${listing.duration}`}
    </p>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
      <span className="text-sm font-medium text-primary-600">{listing.salary || listing.stipend || '—'}</span>
      {listing.deadline && (
        <span className="text-xs text-gray-400">
          Closes {new Date(listing.deadline).toLocaleDateString()}
        </span>
      )}
    </div>
    {listing.skills_required?.length > 0 && (
      <div className="flex flex-wrap gap-1.5 mt-3">
        {listing.skills_required.slice(0, 5).map(s => (
          <span key={s.id} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{s.name}</span>
        ))}
      </div>
    )}
  </Link>
);

const RecruiterProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const recruiterId = Number(id);
  const [data, setData] = useState<RecruiterPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'jobs' | 'internships' | 'reviews'>('jobs');

  useEffect(() => {
    if (!Number.isFinite(recruiterId) || recruiterId <= 0) {
      setError('Invalid recruiter id');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    publicRecruiterAPI
      .get(recruiterId)
      .then(r => { if (!cancelled) setData(r.data as RecruiterPublic); })
      .catch(err => {
        if (!cancelled) setError(extractApiError(err, 'This recruiter profile could not be found.'));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [recruiterId]);

  useEffect(() => {
    // Land on whichever tab actually has something in it, so a recruiter who
    // only posts internships doesn't open to an empty "Jobs" pane.
    if (!data) return;
    if (data.jobs.length === 0 && data.internships.length > 0) setTab('internships');
    else if (data.jobs.length === 0 && data.internships.length === 0 && data.reviews.length > 0) setTab('reviews');
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <h1 className="text-xl font-bold text-gray-900">Profile unavailable</h1>
        <p className="text-gray-500 mt-2">{error || 'This recruiter profile could not be found.'}</p>
        <Link to="/jobs" className="btn-primary mt-6 inline-block">Browse open roles</Link>
      </div>
    );
  }

  const company = data.company;
  const TABS = [
    { key: 'jobs' as const, label: 'Jobs', count: data.jobs.length },
    { key: 'internships' as const, label: 'Internships', count: data.internships.length },
    { key: 'reviews' as const, label: 'Company reviews', count: data.reviews.length },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* ---- Identity ---- */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white text-2xl font-extrabold shrink-0">
            {(data.full_name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{data.full_name}</h1>
            <p className="text-gray-600 mt-0.5">
              {data.designation || 'Recruiter'}
              {company && <> at <span className="font-medium text-gray-900">{company.name}</span></>}
            </p>

            {company && (
              <div className="flex items-center gap-3 mt-4">
                {company.logo ? (
                  <img src={company.logo} alt="" className="w-11 h-11 rounded-xl object-cover border border-gray-100" />
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 font-bold">
                    {company.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="text-sm text-gray-500 min-w-0">
                  <p className="truncate">
                    {[company.industry, company.location, company.size].filter(Boolean).join(' · ') ||
                      'Company details not set'}
                  </p>
                  {company.website && (
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-700 text-xs"
                    >
                      {company.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-5 pt-5 border-t border-gray-50">
              <div>
                <p className="text-lg font-bold text-gray-900 tabular-nums">{data.followers_count}</p>
                <p className="text-xs text-gray-400">Company follower{data.followers_count === 1 ? '' : 's'}</p>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 tabular-nums">{data.jobs.length + data.internships.length}</p>
                <p className="text-xs text-gray-400">Open role{data.jobs.length + data.internships.length === 1 ? '' : 's'}</p>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 tabular-nums">
                  {data.average_rating !== null ? data.average_rating.toFixed(1) : '—'}
                </p>
                <p className="text-xs text-gray-400">
                  {data.reviews.length > 0
                    ? `From ${data.reviews.length} review${data.reviews.length === 1 ? '' : 's'}`
                    : 'No reviews yet'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {company?.description && (
          <p className="text-sm text-gray-600 leading-relaxed mt-6 pt-6 border-t border-gray-50">
            {company.about || company.description}
          </p>
        )}
      </div>

      {/* ---- Postings & reviews ---- */}
      <div className="flex items-center gap-1 mt-8 border-b border-gray-100">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-xs text-gray-400 tabular-nums">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'jobs' && (
          data.jobs.length === 0 ? (
            <p className="text-center text-gray-500 py-16">No open jobs right now.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {data.jobs.map(j => <ListingCard key={j.id} listing={j} kind="job" />)}
            </div>
          )
        )}

        {tab === 'internships' && (
          data.internships.length === 0 ? (
            <p className="text-center text-gray-500 py-16">No open internships right now.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {data.internships.map(i => <ListingCard key={i.id} listing={i} kind="internship" />)}
            </div>
          )
        )}

        {tab === 'reviews' && (
          data.reviews.length === 0 ? (
            <p className="text-center text-gray-500 py-16">
              {company ? `No one has reviewed ${company.name} yet.` : 'No company reviews yet.'}
            </p>
          ) : (
            <div className="space-y-4">
              {data.reviews.map(r => (
                <div key={r.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">{r.title}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {r.user_username} · {r.employment_status === 'current' ? 'Current employee' : 'Former employee'} ·{' '}
                        {new Date(r.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Stars rating={r.rating} />
                  </div>
                  <p className="text-sm text-gray-600 mt-3 whitespace-pre-line">{r.content}</p>
                  {(r.pros || r.cons) && (
                    <div className="grid sm:grid-cols-2 gap-3 mt-4">
                      {r.pros && (
                        <div className="bg-emerald-50/60 rounded-lg p-3">
                          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Pros</p>
                          <p className="text-sm text-gray-600 mt-1">{r.pros}</p>
                        </div>
                      )}
                      {r.cons && (
                        <div className="bg-red-50/60 rounded-lg p-3">
                          <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Cons</p>
                          <p className="text-sm text-gray-600 mt-1">{r.cons}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default RecruiterProfile;
