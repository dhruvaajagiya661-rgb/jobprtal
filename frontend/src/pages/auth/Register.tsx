import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { extractApiError } from '../../utils/errors';
import useSeo from '../../hooks/useSeo';

const Register: React.FC = () => {
  useSeo({
    title: 'Create an account',
    description: 'Create a free PortAL account as a student or a recruiter and start hiring or job hunting in minutes.',
  });
  const { register } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<'student' | 'recruiter'>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [designation, setDesignation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await register({
        email, password, role,
        company_name: role === 'recruiter' ? companyName : undefined,
        designation: role === 'recruiter' ? designation : undefined,
      });
      // Account created — send the user to the login page to sign in
      // with their new credentials (no auto-login).
      navigate('/login', { state: { registered: true } });
    } catch (err: unknown) {
      setError(extractApiError(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center py-16 px-4 relative overflow-hidden bg-gradient-to-br from-surface-50 via-accent-50/30 to-primary-50/30">
      <div className="absolute top-20 -right-20 w-72 h-72 bg-accent-400/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 -left-20 w-96 h-96 bg-primary-400/10 rounded-full blur-3xl"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent-500/5 rounded-full blur-3xl"></div>

      <div className="w-full max-w-md relative z-10 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-accent-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-xl shadow-primary-500/25">
            <span className="text-white font-bold text-xl">P</span>
          </div>
          <h2 className="text-3xl font-bold text-surface-900">Create an account</h2>
          <p className="text-surface-500 mt-2">Join PortAL and start your journey</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-primary-500/10 border border-white/50 p-8 md:p-10">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2.5 bg-red-50 text-red-600 text-sm p-3.5 rounded-xl border border-red-100 animate-fade-in">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            {/* Role Selection */}
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-3">I am a</label>
              <div className="grid grid-cols-2 gap-3">
                {(['student', 'recruiter'] as const).map(r => (
                  <button key={r} type="button" onClick={() => setRole(r)}
                    className={`p-4 rounded-2xl border-2 text-center transition-all duration-200 ${
                      role === r
                        ? 'border-primary-500 bg-primary-50 shadow-md'
                        : 'border-surface-200 text-surface-600 hover:border-surface-300 hover:bg-surface-50'
                    }`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 transition-all ${
                      role === r
                        ? 'bg-gradient-to-br from-primary-500 to-accent-500 text-white shadow-lg'
                        : 'bg-surface-100 text-surface-500'
                    }`}>
                      {r === 'student' ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      )}
                    </div>
                    <div className={`font-semibold text-sm capitalize ${role === r ? 'text-primary-700' : 'text-surface-600'}`}>{r}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="reg-email" className="block text-sm font-semibold text-surface-700 mb-2">Email</label>
              <input id="reg-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
                className="input-field" placeholder="you@example.com" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-password" className="block text-sm font-semibold text-surface-700 mb-2">Password</label>
                <input id="reg-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password"
                  className="input-field" placeholder="Min. 8 chars" />
              </div>
              <div>
                <label htmlFor="reg-confirm-password" className="block text-sm font-semibold text-surface-700 mb-2">Confirm</label>
                <input id="reg-confirm-password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required autoComplete="new-password"
                  className="input-field" placeholder="Repeat" />
              </div>
            </div>

            {role === 'recruiter' && (
              <div className="animate-fade-in-down space-y-4">
                <div>
                  <label htmlFor="reg-company" className="block text-sm font-semibold text-surface-700 mb-2">Company Name</label>
                  <input id="reg-company" type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} required
                    className="input-field" placeholder="Your company name" />
                </div>
                <div>
                  <label htmlFor="reg-designation" className="block text-sm font-semibold text-surface-700 mb-2">Designation</label>
                  <input id="reg-designation" type="text" value={designation} onChange={e => setDesignation(e.target.value)}
                    className="input-field" placeholder="e.g., HR Manager" />
                </div>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-primary-600 to-accent-500 hover:from-primary-700 hover:to-accent-600 text-white font-bold rounded-xl shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="spinner-gradient"></span>
                  Creating account...
                </span>
              ) : 'Create account'}
            </button>

            <p className="text-center text-sm text-surface-500 pt-2">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700 transition-colors link-hover">Sign in</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;
