import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { internshipsAPI, applicationsAPI } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { extractApiError } from '../../utils/errors';
import useSeo from '../../hooks/useSeo';

interface InternshipDetail {
  id: number;
  title: string;
  company: { id: number; name: string; location: string };
  recruiter: { id: number; name: string; designation: string } | null;
  category: { id: number; name: string };
  internship_type: string;
  description: string;
  requirements: string;
  location: string;
  stipend: string;
  duration: string;
  skills_required: { id: number; name: string }[];
  preferred_skills: { id: number; name: string }[];
  deadline: string;
  openings: number;
  created_at: string;
  is_active: boolean;
  has_applied: boolean;
}

const InternshipDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isStudent } = useAuth();
  const [internship, setInternship] = useState<InternshipDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState('');

  useSeo({
    title: internship
      ? `${internship.title} at ${internship.company?.name ?? 'PortAL'}`
      : 'Internship',
    description: internship
      ? `${internship.title} internship at ${internship.company?.name} in ${internship.location}. ${internship.duration}. Apply on PortAL.`
      : undefined,
  });

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    internshipsAPI.detail(Number(id)).then(r => {
      setInternship(r.data);
      setApplied(r.data.has_applied);
    }).catch(() => navigate('/internships')).finally(() => setLoading(false));
  }, [id, navigate]);

  const handleApply = async () => {
    if (!resumeFile) { setError('Please upload your resume'); return; }
    setApplying(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('internship_id', String(id));
      formData.append('resume', resumeFile);
      await applicationsAPI.apply(formData);
      setApplied(true);
    } catch (err: unknown) {
      setError(extractApiError(err, 'Application failed'));
    } finally { setApplying(false); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;
  if (!internship) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link to="/internships" className="inline-flex items-center text-sm text-gray-500 hover:text-primary-600 mb-6">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Internships
      </Link>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-8 border-b border-gray-100">
          <div className="flex flex-col md:flex-row md:items-start gap-4">
            <div className="w-16 h-16 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
              </svg>
            </div>
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{internship.title}</h1>
              <p className="text-lg text-gray-500 mt-1">{internship.company?.name} • {internship.location}</p>
              {internship.recruiter && (
                <p className="text-sm text-gray-400 mt-1">
                  Posted by{' '}
                  <Link
                    to={`/profile/recruiter/${internship.recruiter.id}`}
                    className="font-medium text-primary-600 hover:text-primary-700"
                  >
                    {internship.recruiter.name}
                  </Link>
                  {internship.recruiter.designation && ` · ${internship.recruiter.designation}`}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="badge-success">{internship.internship_type}</span>
                <span className="badge bg-green-100 text-green-700">{internship.stipend}</span>
                <span className="badge bg-gray-100 text-gray-600">{internship.duration}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Description</h2>
              <p className="text-gray-600 leading-relaxed whitespace-pre-line">{internship.description}</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Requirements</h2>
              <p className="text-gray-600 leading-relaxed whitespace-pre-line">{internship.requirements}</p>
            </section>
            {internship.skills_required?.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Required Skills</h2>
                <div className="flex flex-wrap gap-2">
                  {internship.skills_required.map(s => (
                    <span key={s.id} className="px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium">{s.name}</span>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="space-y-6">
            {isAuthenticated && isStudent && (
              <div className="bg-gray-50 rounded-xl p-6">
                {applied ? (
                  <div className="text-center">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="font-medium text-green-700">Applied Successfully!</p>
                  </div>
                ) : (
                  <>
                    <h3 className="font-semibold text-gray-900 mb-3">Apply Now</h3>
                    {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
                    <input type="file" accept=".pdf,.doc,.docx" onChange={e => setResumeFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 mb-3" />
                    <button onClick={handleApply} disabled={applying} className="btn-primary w-full">
                      {applying ? 'Applying...' : 'Apply Now'}
                    </button>
                  </>
                )}
              </div>
            )}
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Category</span><span className="font-medium">{internship.category?.name}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Openings</span><span className="font-medium">{internship.openings}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Deadline</span><span className="font-medium">{internship.deadline}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Duration</span><span className="font-medium">{internship.duration}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InternshipDetail;
