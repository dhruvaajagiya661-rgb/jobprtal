import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  connectionsAPI,
  endorsementsAPI,
  recommendationsAPI,
  profileViewsAPI,
  followAPI,
  publicProfileAPI,
} from '../../api/client';

interface ProfileData {
  id: number;
  username: string;
  full_name: string;
  is_student: boolean;
  is_recruiter: boolean;
  is_self: boolean;
  connection_status: 'none' | 'connected' | 'pending_sent' | 'pending_received';
  is_following: boolean;
  recruiter_profile?: {
    designation: string;
    company?: { id: number; name: string; logo: string | null; industry: string; location: string } | null;
  };
  student_profile?: {
    skills: { id: number; name: string }[];
    education: string;
    experience: string;
    portfolio_link: string;
    github_link: string;
    linkedin_link: string;
    projects: { title: string; description: string; link: string }[];
    profile_photo?: string;
  };
}

interface Endorsement {
  skill: string;
  skill_id: number;
  count: number;
  endorsers: { id: number; email: string; username: string }[];
}

interface Recommendation {
  id: number;
  recommender_email: string;
  relationship: string;
  content: string;
  created_at: string;
}

const PublicProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [endorsements, setEndorsements] = useState<Endorsement[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>('none');
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState<'about' | 'experience' | 'skills' | 'recommendations'>('about');
  const [loading, setLoading] = useState(true);

  const userId = parseInt(id || '0');

  useEffect(() => {
    if (!userId) return;

    // Record profile view
    if (currentUser && currentUser.id !== userId) {
      profileViewsAPI.recordView(userId).catch(() => {});
    }

    // Fetch the profile actually being viewed. This used to call
    // studentAPI.profile() — the *caller's own* profile — and render
    // "Profile not found" for everyone else, so every profile link in the
    // app was a dead end.
    Promise.all([
      publicProfileAPI.get(userId).then(r => {
        setProfile(r.data);
        setConnectionStatus(r.data.connection_status || 'none');
        setIsFollowing(Boolean(r.data.is_following));
      }).catch(() => setProfile(null)),
      endorsementsAPI.userEndorsements(userId).then(r => setEndorsements(r.data)).catch(() => {}),
      recommendationsAPI.userRecommendations(userId).then(r => setRecommendations(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [userId, currentUser]);

  const handleConnect = async () => {
    if (connectionStatus !== 'none') return;
    try {
      await connectionsAPI.sendRequest(userId);
      setConnectionStatus('pending_sent');
    } catch {
      // Already connected / already pending — reflect reality rather than
      // leaving the button claiming the invite went out.
      setConnectionStatus('pending_sent');
    }
  };

  const handleFollow = async () => {
    const res = await followAPI.toggle(userId);
    setIsFollowing(res.data.following);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Profile not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Cover Photo / Header */}
      <div className="bg-gradient-to-r from-primary-600 to-accent-600 rounded-t-2xl h-48 relative">
        <div className="absolute -bottom-16 left-8">
          <div className="w-32 h-32 rounded-full border-4 border-white bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-4xl font-bold shadow-xl">
            {(profile.full_name || profile.username)[0].toUpperCase()}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-b-2xl shadow-sm border border-gray-100 pt-20 pb-8 px-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{profile.full_name || profile.username}</h1>
            <p className="text-gray-500 mt-1">
              {profile.recruiter_profile
                ? [profile.recruiter_profile.designation, profile.recruiter_profile.company?.name]
                    .filter(Boolean)
                    .join(' at ')
                : profile.is_student
                  ? 'Student'
                  : 'Member'}
            </p>
            {profile.student_profile?.education && (
              <p className="text-gray-600 text-sm mt-2">{profile.student_profile.education}</p>
            )}
            {profile.student_profile?.skills && profile.student_profile.skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {profile.student_profile.skills.map(s => (
                  <span key={s.id} className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded-full text-xs font-medium">{s.name}</span>
                ))}
              </div>
            )}
          </div>
          {currentUser && currentUser.id !== userId && (
            <div className="flex gap-2">
              <button onClick={handleConnect}
                disabled={connectionStatus !== 'none'}
                className={`px-5 py-2 rounded-full font-semibold text-sm transition-colors ${
                  connectionStatus !== 'none'
                    ? 'bg-gray-100 text-gray-500 cursor-default'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}>
                {connectionStatus === 'connected'
                  ? 'Connected'
                  : connectionStatus === 'pending_sent'
                    ? 'Pending'
                    : connectionStatus === 'pending_received'
                      ? 'Respond in My Network'
                      : 'Connect'}
              </button>
              <button onClick={handleFollow}
                className={`px-5 py-2 rounded-full font-semibold text-sm border transition-colors ${
                  isFollowing ? 'bg-gray-100 text-gray-700 border-gray-300' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}>
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mt-6 bg-gray-100 rounded-xl p-1 mb-6">
        {(['about', 'experience', 'skills', 'recommendations'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${
              activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {/* About Tab */}
      {activeTab === 'about' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
          {profile.student_profile?.experience && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Experience</h3>
              <p className="text-gray-600 text-sm whitespace-pre-wrap">{profile.student_profile.experience}</p>
            </div>
          )}
          {profile.student_profile?.portfolio_link && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Portfolio</h3>
              <a href={profile.student_profile.portfolio_link} target="_blank" rel="noopener noreferrer" className="text-primary-600 text-sm hover:underline">{profile.student_profile.portfolio_link}</a>
            </div>
          )}
          {profile.student_profile?.github_link && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">GitHub</h3>
              <a href={profile.student_profile.github_link} target="_blank" rel="noopener noreferrer" className="text-primary-600 text-sm hover:underline">{profile.student_profile.github_link}</a>
            </div>
          )}
          {profile.student_profile?.linkedin_link && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">LinkedIn</h3>
              <a href={profile.student_profile.linkedin_link} target="_blank" rel="noopener noreferrer" className="text-primary-600 text-sm hover:underline">{profile.student_profile.linkedin_link}</a>
            </div>
          )}
          {profile.student_profile?.projects && profile.student_profile.projects.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Projects</h3>
              {profile.student_profile.projects.map((p, i) => (
                <div key={i} className="mb-3 p-3 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900">{p.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">{p.description}</p>
                  {p.link && <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-primary-600 text-xs hover:underline mt-1 inline-block">{p.link}</a>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Skills Tab */}
      {activeTab === 'skills' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Skills & Endorsements</h3>
          {endorsements.length === 0 ? (
            <p className="text-gray-400 text-sm">No endorsements yet.</p>
          ) : (
            <div className="space-y-4">
              {endorsements.map(e => (
                <div key={e.skill_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="font-medium text-gray-900">{e.skill}</span>
                    <span className="text-sm text-gray-500 ml-2">· {e.count} endorsement{e.count !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex -space-x-2">
                    {e.endorsers.slice(0, 5).map(endorser => (
                      <div key={endorser.id} className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold border-2 border-white" title={endorser.username || endorser.email}>
                        {(endorser.username || endorser.email)[0].toUpperCase()}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recommendations Tab */}
      {activeTab === 'recommendations' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Recommendations</h3>
          {recommendations.length === 0 ? (
            <p className="text-gray-400 text-sm">No recommendations yet.</p>
          ) : (
            <div className="space-y-4">
              {recommendations.map(r => (
                <div key={r.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
                      {r.recommender_email[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{r.recommender_email}</p>
                      <p className="text-xs text-gray-500">{r.relationship}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700">{r.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Experience Tab */}
      {activeTab === 'experience' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Experience & Education</h3>
          {profile.student_profile?.education ? (
            <p className="text-gray-600 text-sm whitespace-pre-wrap">{profile.student_profile.education}</p>
          ) : (
            <p className="text-gray-400 text-sm">No experience added yet.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default PublicProfile;
