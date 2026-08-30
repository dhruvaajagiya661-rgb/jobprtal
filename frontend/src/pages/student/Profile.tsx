import React, { useState, useEffect, useRef } from 'react';
import { studentAPI, skillsAPI } from '../../api/client';
import ResumeInsights from '../../components/student/ResumeInsights';
import PhotoCrop from '../../components/ui/PhotoCrop';
import { useAuth } from '../../context/AuthContext';
import { extractApiError } from '../../utils/errors';
import {
  computeCompletion,
  completionFromProfile,
} from '../../utils/profileCompletion';

interface Skill {
  id: number;
  name: string;
}

interface Project {
  id: number;
  title: string;
  description: string;
  link: string;
}

interface StudentProfileData {
  id: number;
  profile_photo: string | null;
  resume: string | null;
  skills: Skill[];
  education: string;
  experience: string;
  portfolio_link: string | null;
  github_link: string | null;
  github_username: string | null;
  linkedin_link: string | null;
  projects: Project[];
}

const StudentProfile: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<StudentProfileData | null>(null);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    education: '',
    experience: '',
    portfolio_link: '',
    github_username: '',
    github_link: '',
    linkedin_link: '',
    skillIds: [] as number[],
    projects: [] as Project[],
  });
  const [busyPatch, setBusyPatch] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoUrlRef = useRef<string | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeError, setResumeError] = useState('');

  const fetchProfile = () => {
    setLoading(true);
    setError('');
    studentAPI
      .profile()
      .then(r => {
        const p = r.data as StudentProfileData;
        setProfile(p);
        setForm({
          education: p.education || '',
          experience: p.experience || '',
          portfolio_link: p.portfolio_link || '',
          github_username: p.github_username || '',
          github_link: p.github_link || '',
          linkedin_link: p.linkedin_link || '',
          skillIds: (p.skills || []).map(s => s.id),
          projects: p.projects || [],
        });
      })
      .catch(err => setError(extractApiError(err, 'Could not load your profile. Please try again.')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProfile();
    skillsAPI
      .list()
      .then(r => setAllSkills(r.data || []))
      .catch(() => {});
    // Revoke any object URL we created so we don't leak blob URLs.
    return () => {
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    };
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const toggleSkill = (id: number) => {
    setForm(prev => ({
      ...prev,
      skillIds: prev.skillIds.includes(id)
        ? prev.skillIds.filter(s => s !== id)
        : [...prev.skillIds, id],
    }));
  };

  const updateProject = (
    id: number,
    field: keyof Pick<Project, 'title' | 'description' | 'link'>,
    value: string
  ) => {
    setForm(prev => ({
      ...prev,
      projects: prev.projects.map(p =>
        p.id === id ? { ...p, [field]: value } : p
      ),
    }));
  };

  const addProject = () => {
    setForm(prev => ({
      ...prev,
      projects: [
        ...prev.projects,
        { id: Date.now(), title: '', description: '', link: '' },
      ],
    }));
  };

  const removeProject = (id: number) => {
    setForm(prev => ({
      ...prev,
      projects: prev.projects.filter(p => p.id !== id),
    }));
  };

  // --- Quick delete helpers (view mode) ---
  const patchProfile = async (data: Record<string, unknown>) => {
    setBusyPatch(true);
    setError('');
    try {
      await studentAPI.updateProfileJson(data);
      fetchProfile();
    } catch (err) {
      setError(extractApiError(err, 'Failed to update profile. Please try again.'));
    } finally {
      setBusyPatch(false);
    }
  };

  const deleteProject = (project: Project) => {
    if (!window.confirm(`Delete project "${project.title || 'Untitled'}"?`)) return;
    const projects = (profile?.projects || []).filter(p => p.id !== project.id);
    patchProfile({ projects });
  };

  const removeSkill = (skill: Skill) => {
    if (!window.confirm(`Remove skill "${skill.name}"?`)) return;
    const skillIds = (profile?.skills || [])
      .filter(s => s.id !== skill.id)
      .map(s => s.id);
    patchProfile({ skill_ids: skillIds });
  };

  const clearLink = (
    field: 'portfolio_link' | 'github_link' | 'linkedin_link',
    label: string
  ) => {
    if (!window.confirm(`Remove ${label} link?`)) return;
    patchProfile({ [field]: '' });
  };

  const removeResume = () => {
    if (!window.confirm('Remove your resume?')) return;
    patchProfile({ resume: null });
  };

  const [cropFile, setCropFile] = useState<File | null>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCropFile(file);
    }
  };

  const handleCropDone = (blob: Blob) => {
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    const url = URL.createObjectURL(blob);
    photoUrlRef.current = url;
    const croppedFile = new File([blob], 'profile-photo.jpg', { type: 'image/jpeg' });
    setPhotoFile(croppedFile);
    setPhotoPreview(url);
    setCropFile(null);
  };

  const handleResumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/rtf',
    ];
    const allowedExts = ['pdf', 'doc', 'docx', 'txt', 'rtf'];
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (file.size > 10 * 1024 * 1024) {
      setResumeError('Resume must be under 10 MB.');
      return;
    }
    // Some browsers report application/octet-stream for .doc/.docx files, so
    // fall back to the file extension when the MIME type is generic.
    const typeOk =
      allowedTypes.includes(file.type) ||
      file.type === '' ||
      file.type === 'application/octet-stream';
    if (!typeOk || !allowedExts.includes(ext)) {
      setResumeError('Only PDF, DOC, DOCX, TXT or RTF files are allowed.');
      return;
    }
    setResumeError('');
    setResumeFile(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('education', form.education);
      formData.append('experience', form.experience);
      formData.append('portfolio_link', form.portfolio_link);
      formData.append('github_username', form.github_username);
      formData.append('github_link', form.github_link);
      formData.append('linkedin_link', form.linkedin_link);
      form.skillIds.forEach(id => formData.append('skill_ids', String(id)));
      if (photoFile) formData.append('profile_photo', photoFile);
      if (resumeFile) formData.append('resume', resumeFile);
      await studentAPI.updateProfile(formData);
      // Projects are a JSON list, so they go through a separate JSON patch.
      await studentAPI.updateProfileJson({ projects: form.projects });
      setEditing(false);
      setPhotoFile(null);
      setResumeFile(null);
      fetchProfile();
    } catch (err) {
      setError(extractApiError(err, 'Failed to save changes. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );

  const photoSrc = photoPreview || profile?.profile_photo || null;
  const initial = (user?.username || 'U')[0].toUpperCase();
  const skillCount = profile?.skills?.length ?? 0;
  const resumeFileName = profile?.resume ? profile.resume.split('/').pop() : '';

  // View-mode completion from the saved profile.
  const completion = completionFromProfile(profile);

  // Edit-mode completion live-updates as the form changes.
  const editCompletion = computeCompletion({
    hasPhoto: !!photoFile || !!profile?.profile_photo,
    hasResume: !!resumeFile || !!profile?.resume,
    hasSkills: form.skillIds.length > 0,
    hasEducation: !!form.education.trim(),
    hasExperience: !!form.experience.trim(),
    hasLinks: !!(form.portfolio_link.trim() || form.github_link.trim() || form.linkedin_link.trim()),
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-500">View and manage your student profile</p>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="btn-primary text-sm mt-4 md:mt-0">
            Edit Profile
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 bg-red-50 text-red-600 text-sm p-4 rounded-xl border border-red-100">
          {error}
        </div>
      )}

      {/* Header card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="relative">
            {photoSrc ? (
              <img
                src={photoSrc}
                alt="Profile"
                className="w-20 h-20 rounded-2xl object-cover shadow-lg border-2 border-white"
              />
            ) : (
              <div className="w-20 h-20 bg-gradient-to-br from-primary-400 to-accent-500 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-2xl">{initial}</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900">{user?.username}</h2>
            <p className="text-sm text-gray-500 truncate">{user?.email}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="px-2.5 py-1 bg-primary-50 text-primary-700 rounded-full text-xs font-semibold">
                Student
              </span>
              {skillCount > 0 && (
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">
                  {skillCount} skill{skillCount !== 1 ? 's' : ''}
                </span>
              )}
              {profile?.resume && (
                <span className="px-2.5 py-1 bg-red-50 text-red-600 rounded-full text-xs font-semibold">
                  Resume ✓
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Profile completion */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Profile Completion</h3>
          <span className={`text-sm font-bold ${completion.percent === 100 ? 'text-emerald-600' : 'text-primary-600'}`}>
            {completion.percent}%
          </span>
        </div>
        <div className="h-2.5 bg-surface-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              completion.percent === 100
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                : 'bg-gradient-to-r from-primary-500 to-accent-500'
            }`}
            style={{ width: `${completion.percent}%` }}
          ></div>
        </div>
        {completion.missing.length > 0 ? (
          <p className="text-xs text-gray-400 mt-3">
            Missing: <span className="text-gray-600 font-medium">{completion.missing.join(', ')}</span>
          </p>
        ) : (
          <p className="text-xs text-emerald-600 font-medium mt-3">
            🎉 Your profile is complete! You're all set for applications.
          </p>
        )}
      </div>

      {!editing ? (
        <div className="space-y-6">
          {/* Resume-driven skill discovery. Sits above the skill list because
              it's the fastest way to fill that list in. */}
          <ResumeInsights
            hasStoredResume={!!profile?.resume}
            onSkillsAdded={() => fetchProfile()}
          />

          {/* Skills */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Skills</h3>
            {profile?.skills?.length ? (
              <div className="flex flex-wrap gap-2">
                {profile.skills.map(s => (
                  <span key={s.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium">
                    {s.name}
                    <button
                      type="button"
                      onClick={() => removeSkill(s)}
                      disabled={busyPatch}
                      title="Remove skill"
                      aria-label={`Remove skill ${s.name}`}
                      className="text-primary-400 hover:text-red-500 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                No skills added yet.{' '}
                <button onClick={() => setEditing(true)} className="text-primary-600 hover:text-primary-700 font-medium">
                  Add skills
                </button>
              </p>
            )}
          </div>

          {/* Education & Experience */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Education</h3>
              <p className="text-sm text-gray-500 whitespace-pre-wrap">
                {profile?.education || 'Not specified'}
              </p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Experience</h3>
              <p className="text-sm text-gray-500 whitespace-pre-wrap">
                {profile?.experience || 'Not specified'}
              </p>
            </div>
          </div>

          {/* Projects */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Projects</h3>
              <button onClick={() => setEditing(true)} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                Add project
              </button>
            </div>
            {profile?.projects?.length ? (
              <div className="space-y-3">
                {profile.projects.map(p => (
                  <div key={p.id} className="flex items-start justify-between gap-3 p-4 rounded-xl bg-surface-50 border border-gray-100">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-gray-900">{p.title || 'Untitled project'}</h4>
                        {p.link && (
                          <a href={p.link} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-primary-600 hover:text-primary-700 font-medium flex-shrink-0">
                            ↗
                          </a>
                        )}
                      </div>
                      {p.description && (
                        <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap">{p.description}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteProject(p)}
                      disabled={busyPatch}
                      title="Delete project"
                      aria-label="Delete project"
                      className="text-gray-300 hover:text-red-500 transition-colors p-1 flex-shrink-0"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                No projects added yet.{' '}
                <button onClick={() => setEditing(true)} className="text-primary-600 hover:text-primary-700 font-medium">
                  Add your first project
                </button>
              </p>
            )}
          </div>

          {/* Links */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Links</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {profile?.portfolio_link && (
                <div className="flex items-center gap-2 group">
                  <a href={profile.portfolio_link} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 text-sm text-primary-600 hover:text-primary-700 font-medium min-w-0">
                    <span className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 010 5.656l-4 4a4 4 0 01-5.656-5.656l1.5-1.5" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 010-5.656l4-4a4 4 0 015.656 5.656l-1.5 1.5" /></svg>
                    </span>
                    Portfolio
                  </a>
                  <button
                    type="button"
                    onClick={() => clearLink('portfolio_link', 'portfolio')}
                    disabled={busyPatch}
                    title="Remove portfolio link"
                    aria-label="Remove portfolio link"
                    className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}
              {profile?.github_link && (
                <div className="flex items-center gap-2 group">
                  <a href={profile.github_link} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 text-sm text-primary-600 hover:text-primary-700 font-medium min-w-0">
                    <span className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
                    </span>
                    GitHub {profile.github_username ? `(${profile.github_username})` : ''}
                  </a>
                  <button
                    type="button"
                    onClick={() => clearLink('github_link', 'GitHub')}
                    disabled={busyPatch}
                    title="Remove GitHub link"
                    aria-label="Remove GitHub link"
                    className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}
              {profile?.linkedin_link && (
                <div className="flex items-center gap-2 group">
                  <a href={profile.linkedin_link} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 text-sm text-primary-600 hover:text-primary-700 font-medium min-w-0">
                    <span className="w-8 h-8 bg-sky-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-sky-600" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" /></svg>
                    </span>
                    LinkedIn
                  </a>
                  <button
                    type="button"
                    onClick={() => clearLink('linkedin_link', 'LinkedIn')}
                    disabled={busyPatch}
                    title="Remove LinkedIn link"
                    aria-label="Remove LinkedIn link"
                    className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}
              {!profile?.portfolio_link && !profile?.github_link && !profile?.linkedin_link && (
                <p className="text-sm text-gray-400">No links added yet.</p>
              )}
            </div>
          </div>

          {/* Resume */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Resume</h3>
              <div className="flex items-center gap-3">
                {profile?.resume && (
                  <button
                    type="button"
                    onClick={removeResume}
                    disabled={busyPatch}
                    className="text-sm text-red-500 hover:text-red-600 font-medium"
                  >
                    Remove
                  </button>
                )}
                <button onClick={() => setEditing(true)} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                  {profile?.resume ? 'Replace' : 'Upload'}
                </button>
              </div>
            </div>
            {profile?.resume ? (
              <a href={profile.resume} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-50 hover:bg-primary-50 transition-colors group">
                <span className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-gray-900 truncate">{resumeFileName}</span>
                  <span className="text-xs text-gray-400">Click to view or download</span>
                </span>
                <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-600 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </a>
            ) : (
              <div className="text-center py-8">
                <div className="w-14 h-14 bg-surface-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-surface-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-700 mb-1">No resume uploaded</p>
                <p className="text-xs text-gray-400 mb-4">Add your resume to complete your profile and apply faster.</p>
                <button onClick={() => setEditing(true)} className="btn-secondary text-sm">Upload resume</button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-6">
          {/* Live completion while editing */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Profile Completion</label>
              <span className="text-sm font-bold text-primary-600">{editCompletion.percent}%</span>
            </div>
            <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  editCompletion.percent === 100
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                    : 'bg-gradient-to-r from-primary-500 to-accent-500'
                }`}
                style={{ width: `${editCompletion.percent}%` }}
              ></div>
            </div>
          </div>

          {/* Profile photo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Profile Photo</label>
            <div className="flex items-center gap-4">
              {photoSrc ? (
                <img src={photoSrc} alt="Profile preview" className="w-16 h-16 rounded-2xl object-cover shadow" />
              ) : (
                <div className="w-16 h-16 bg-gradient-to-br from-primary-400 to-accent-500 rounded-2xl flex items-center justify-center shadow">
                  <span className="text-white font-bold text-xl">{initial}</span>
                </div>
              )}
              <label className="cursor-pointer">
                <span className="btn-secondary text-sm py-2 inline-block">Choose photo</span>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </label>
            </div>
          </div>

          {/* Resume upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Resume</label>
            <div className="flex flex-wrap items-center gap-3">
              {profile?.resume && (
                <a href={profile.resume} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {resumeFileName}
                </a>
              )}
              <label className="cursor-pointer">
                <span className="btn-secondary text-sm py-2 inline-block">
                  {profile?.resume ? 'Replace resume' : 'Upload resume'}
                </span>
                <input type="file" accept=".pdf,.doc,.docx,.txt,.rtf" className="hidden" onChange={handleResumeChange} />
              </label>
              {resumeFile && (
                <span className="text-sm text-gray-600 font-medium">{resumeFile.name}</span>
              )}
            </div>
            {resumeError && <p className="text-xs text-red-500 mt-1.5">{resumeError}</p>}
            <p className="text-xs text-gray-400 mt-1.5">PDF, DOC, DOCX, TXT or RTF — up to 10 MB.</p>
          </div>

          {/* Skills picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Skills ({form.skillIds.length} selected)
            </label>
            {allSkills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {allSkills.map(s => {
                  const selected = form.skillIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSkill(s.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                        selected
                          ? 'bg-primary-600 text-white border-primary-600 shadow-md shadow-primary-500/25'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-600'
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No skills available to select.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Education</label>
            <textarea name="education" value={form.education} onChange={handleChange} rows={3}
              className="input-field" placeholder="e.g., B.Tech in Computer Science, XYZ University (2022-2026)" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Experience</label>
            <textarea name="experience" value={form.experience} onChange={handleChange} rows={3}
              className="input-field" placeholder="e.g., Intern at Acme Corp - built REST APIs with Django" />
          </div>

          {/* Projects */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Projects ({form.projects.length})
            </label>
            {form.projects.length === 0 && (
              <p className="text-sm text-gray-400 mb-3">
                No projects yet — add one to showcase your work.
              </p>
            )}
            <div className="space-y-3">
              {form.projects.map(p => (
                <div key={p.id} className="rounded-xl border border-gray-200 p-4 space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={p.title}
                      onChange={e => updateProject(p.id, 'title', e.target.value)}
                      className="input-field"
                      placeholder="Project title"
                    />
                    <input
                      type="url"
                      value={p.link}
                      onChange={e => updateProject(p.id, 'link', e.target.value)}
                      className="input-field"
                      placeholder="https://project-link.com"
                    />
                  </div>
                  <textarea
                    value={p.description}
                    onChange={e => updateProject(p.id, 'description', e.target.value)}
                    rows={2}
                    className="input-field"
                    placeholder="Short description of what you built, your role, and the tech used"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeProject(p.id)}
                      className="text-sm text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Remove project
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={addProject} className="mt-3 btn-secondary text-sm">
              + Add project
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Portfolio Link</label>
              <input type="url" name="portfolio_link" value={form.portfolio_link} onChange={handleChange}
                className="input-field" placeholder="https://yourportfolio.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">GitHub Username</label>
              <input type="text" name="github_username" value={form.github_username} onChange={handleChange}
                className="input-field" placeholder="your-github-username" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">GitHub Link</label>
              <input type="url" name="github_link" value={form.github_link} onChange={handleChange}
                className="input-field" placeholder="https://github.com/username" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">LinkedIn Link</label>
              <input type="url" name="linkedin_link" value={form.linkedin_link} onChange={handleChange}
                className="input-field" placeholder="https://linkedin.com/in/username" />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3.5 rounded-xl border border-red-100">{error}</div>
          )}

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setPhotoFile(null); setPhotoPreview(null); setResumeFile(null); setResumeError(''); fetchProfile(); }}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {cropFile && (
        <PhotoCrop
          file={cropFile}
          onCrop={handleCropDone}
          onCancel={() => setCropFile(null)}
        />
      )}
    </div>
  );
};

export default StudentProfile;
