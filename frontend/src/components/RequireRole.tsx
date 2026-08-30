import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export type RequiredRole = 'any' | 'student' | 'recruiter' | 'admin';

const ROLE_COPY: Record<Exclude<RequiredRole, 'any'>, { noun: string; blurb: string }> = {
  student: {
    noun: 'student',
    blurb: 'Skill tracking, applications and career planning live on student accounts.',
  },
  recruiter: {
    noun: 'recruiter',
    blurb: 'Job posting and applicant management live on recruiter accounts.',
  },
  admin: {
    noun: 'administrator',
    blurb: 'This area is restricted to portal administrators.',
  },
};

const GuardSpinner: React.FC = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="spinner-gradient !w-10 !h-10 !border-[3px]"></div>
  </div>
);

/**
 * Shown when someone IS signed in but holds the wrong account type.
 * Previously these users were silently bounced to "/" — the click appeared to
 * do nothing, or (after signing in) dropped them on their dashboard with no
 * explanation of why the page they asked for never opened.
 */
const WrongRole: React.FC<{ role: Exclude<RequiredRole, 'any'>; homePath: string }> = ({
  role,
  homePath,
}) => {
  const copy = ROLE_COPY[role];
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="card-elevated max-w-lg w-full p-10 text-center animate-scale-in">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary-500/25">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-surface-900 mb-3">
          This page needs a {copy.noun} account
        </h1>
        <p className="text-surface-500 leading-relaxed mb-8">{copy.blurb}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to={homePath} className="btn-primary">Go to my dashboard</Link>
          <Link to="/careers/paths" className="btn-secondary">Browse career paths</Link>
        </div>
      </div>
    </div>
  );
};

/**
 * Route guard. Two distinct failure modes, two distinct outcomes:
 *
 *  - Not signed in  -> send to /login and REMEMBER where they were heading,
 *                      so signing in completes the original journey instead of
 *                      dumping them on the role dashboard.
 *  - Wrong role     -> explain it. Never a silent redirect.
 *
 * `replace` is used throughout so the guard never stacks history entries the
 * back button has to fight through.
 */
const RequireRole: React.FC<{ role?: RequiredRole; children: React.ReactNode }> = ({
  role = 'any',
  children,
}) => {
  const { isAuthenticated, isStudent, isRecruiter, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <GuardSpinner />;

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname + location.search }}
        replace
      />
    );
  }

  const homePath = isAdmin
    ? '/admin-portal'
    : isRecruiter
      ? '/recruiter/dashboard'
      : isStudent
        ? '/student/dashboard'
        : '/';

  if (role === 'student' && !isStudent) return <WrongRole role="student" homePath={homePath} />;
  if (role === 'recruiter' && !isRecruiter) return <WrongRole role="recruiter" homePath={homePath} />;
  if (role === 'admin' && !isAdmin) return <WrongRole role="admin" homePath={homePath} />;

  return <>{children}</>;
};

export default RequireRole;
