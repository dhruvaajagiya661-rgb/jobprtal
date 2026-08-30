import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { extractApiError } from '../../utils/errors';
import useSeo from '../../hooks/useSeo';

// Both roles sign in from this same page. The account type is detected
// automatically from the server on login, and the user is routed to their
// own dashboard (student or recruiter) accordingly.
const Login: React.FC = () => {
  useSeo({
    title: 'Sign in',
    description: 'Sign in to your PortAL account to apply for roles, track applications and message recruiters.',
  });
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // A route guard that turned an anonymous visitor away stores the page they
  // were actually trying to open. Honour it, otherwise a click on something
  // like "Skill Gap Analysis" silently ends on the dashboard instead.
  const redirectTo = (location.state as { from?: string } | null)?.from;
  // Set by the Register page after a successful signup.
  const justRegistered = (location.state as { registered?: boolean } | null)?.registered;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loggedIn = await login(email, password);
      if (redirectTo) {
        // Finish the journey the visitor started before being asked to sign in.
        navigate(redirectTo, { replace: true });
      } else if (loggedIn.is_superuser) navigate('/admin-portal', { replace: true });
      else if (loggedIn.is_recruiter) navigate('/recruiter/dashboard', { replace: true });
      else if (loggedIn.is_student) navigate('/student/dashboard', { replace: true });
      else navigate('/', { replace: true });
    } catch (err: unknown) {
      setError(extractApiError(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center py-16 px-4 relative overflow-hidden bg-gradient-to-br from-surface-50 via-primary-50/30 to-accent-50/30">
      {/* Decorative background elements */}
      <div className="absolute top-20 -left-20 w-72 h-72 bg-primary-400/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 -right-20 w-96 h-96 bg-accent-400/10 rounded-full blur-3xl"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl"></div>

      <div className="w-full max-w-md relative z-10 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-accent-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-xl shadow-primary-500/25">
            <span className="text-white font-bold text-xl">P</span>
          </div>
          <h2 className="text-3xl font-bold text-surface-900">Welcome back</h2>
          <p className="text-surface-500 mt-2">Sign in to your PortAL account</p>
          {redirectTo && (
            <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-50 border border-primary-200 text-primary-700 text-sm font-medium animate-fade-in">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Sign in to continue to that page
            </div>
          )}
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-primary-500/10 border border-white/50 p-8 md:p-10">
          <form onSubmit={handleSubmit} className="space-y-5">
            {justRegistered && !error && (
              <div className="flex items-center gap-2.5 bg-green-50 text-green-700 text-sm p-3.5 rounded-xl border border-green-100 animate-fade-in">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Registration successful! Please sign in with your email and password.
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2.5 bg-red-50 text-red-600 text-sm p-3.5 rounded-xl border border-red-100 animate-fade-in">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <div>
              <label htmlFor="login-email" className="block text-sm font-semibold text-surface-700 mb-2">Email</label>
              <input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
                className="input-field" placeholder="you@example.com" />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-semibold text-surface-700 mb-2">Password</label>
              <input id="login-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
                className="input-field" placeholder="Enter your password" />
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white font-bold rounded-xl shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="spinner-gradient"></span>
                  Signing in...
                </span>
              ) : 'Sign in'}
            </button>

            <p className="text-center text-sm text-surface-500 pt-2">
              Don't have an account?{' '}
              <Link to="/register" className="font-semibold text-primary-600 hover:text-primary-700 transition-colors link-hover">Register</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
