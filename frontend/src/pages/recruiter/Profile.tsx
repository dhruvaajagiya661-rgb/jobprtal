import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { recruiterAPI } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { extractApiError } from '../../utils/errors';

interface CompanyData {
  id: number | null;
  name: string;
  description: string;
  industry: string;
  size: string;
  website: string;
  location: string;
  logo?: string | null;
}

interface RecruiterProfileData {
  id: number;
  company: CompanyData | null;
  designation: string;
}

const RecruiterProfile: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<RecruiterProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    recruiterAPI
      .profile()
      .then(r => setProfile(r.data))
      .catch(err => setError(extractApiError(err, 'Could not load your profile. Please try again.')))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );

  const company = profile?.company ?? null;
  const initial = (user?.username || 'U')[0].toUpperCase();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-500">View and manage your recruiter profile</p>
        </div>
        <Link to="/recruiter/company" className="btn-primary text-sm mt-4 md:mt-0">
          Edit Company Profile
        </Link>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 text-red-600 text-sm p-4 rounded-xl border border-red-100">
          {error}
        </div>
      )}

      {/* Header card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-20 h-20 bg-gradient-to-br from-primary-400 to-accent-500 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
            <span className="text-white font-bold text-2xl">{initial}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900">{user?.username}</h2>
            <p className="text-sm text-gray-500 truncate">{user?.email}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="px-2.5 py-1 bg-primary-50 text-primary-700 rounded-full text-xs font-semibold">
                Recruiter
              </span>
              {profile?.designation && (
                <span className="px-2.5 py-1 bg-surface-50 text-gray-600 rounded-full text-xs font-semibold">
                  {profile.designation}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Company card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-gray-900">Company</h3>
          <Link to="/recruiter/company" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
            {company ? 'Edit' : 'Set up'}
          </Link>
        </div>

        {company ? (
          <div className="flex flex-col sm:flex-row gap-5">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-accent-500 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
              {company.logo ? (
                <img src={company.logo} alt={company.name} className="w-full h-full object-cover rounded-2xl" />
              ) : (
                <span className="text-white font-bold text-xl">
                  {(company.name || 'C')[0].toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <h4 className="text-lg font-bold text-gray-900">{company.name}</h4>
              {company.industry && (
                <p className="text-sm text-gray-500">
                  <span className="font-medium text-gray-700">Industry:</span> {company.industry}
                </p>
              )}
              {company.size && (
                <p className="text-sm text-gray-500">
                  <span className="font-medium text-gray-700">Size:</span> {company.size}
                </p>
              )}
              {company.location && (
                <p className="text-sm text-gray-500">
                  <span className="font-medium text-gray-700">Location:</span> {company.location}
                </p>
              )}
              {company.website && (
                <a href={company.website} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium inline-block">
                  {company.website}
                </a>
              )}
              {company.description && (
                <p className="text-sm text-gray-500 whitespace-pre-wrap pt-1">{company.description}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-14 h-14 bg-surface-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-surface-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h4 className="text-base font-semibold text-gray-900 mb-1">No company set up yet</h4>
            <p className="text-sm text-gray-500 mb-4">Add your company details so students know who you represent.</p>
            <Link to="/recruiter/company" className="btn-primary text-sm inline-block">
              Set Up Company
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecruiterProfile;
