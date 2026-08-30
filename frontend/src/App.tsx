import React, { lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import RequireRole from './components/RequireRole';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

import NotFound from './pages/NotFound';

/** Shown while a lazily-loaded page chunk is in flight. */
const RouteFallback: React.FC = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="spinner-gradient !w-10 !h-10 !border-[3px]"></div>
  </div>
);

// Route-level code splitting: each page becomes its own chunk, fetched on
// first navigation. Keeps the initial bundle to the landing experience
// instead of shipping all 29 pages to every visitor.
const JobList = lazy(() => import('./pages/jobs/JobList'));
const JobDetail = lazy(() => import('./pages/jobs/JobDetail'));
const InternshipList = lazy(() => import('./pages/internships/InternshipList'));
const InternshipDetail = lazy(() => import('./pages/internships/InternshipDetail'));
const StudentDashboard = lazy(() => import('./pages/student/Dashboard'));
const StudentProfile = lazy(() => import('./pages/student/Profile'));
const MyApplications = lazy(() => import('./pages/student/MyApplications'));
const ApplicationBoard = lazy(() => import('./pages/student/ApplicationBoard'));
const SavedJobs = lazy(() => import('./pages/student/SavedJobs'));
const RecruiterDashboard = lazy(() => import('./pages/recruiter/Dashboard'));
const RecruiterProfile = lazy(() => import('./pages/recruiter/Profile'));
const ManageJobs = lazy(() => import('./pages/recruiter/ManageJobs'));
const ManageInternships = lazy(() => import('./pages/recruiter/ManageInternships'));
const Applicants = lazy(() => import('./pages/recruiter/Applicants'));
const CompanyProfile = lazy(() => import('./pages/recruiter/CompanyProfile'));
const PostJob = lazy(() => import('./pages/recruiter/PostJob'));
const PostInternship = lazy(() => import('./pages/recruiter/PostInternship'));
const SavedCandidates = lazy(() => import('./pages/recruiter/SavedCandidates'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const NotificationList = lazy(() => import('./pages/notifications/NotificationList'));
const NewsFeed = lazy(() => import('./pages/feed/NewsFeed'));
const Network = lazy(() => import('./pages/network/Network'));
const PublicProfile = lazy(() => import('./pages/profile/PublicProfile'));
const PublicRecruiterProfile = lazy(() => import('./pages/profile/RecruiterProfile'));
const CareerPathList = lazy(() => import('./pages/careers/CareerPathList'));
const CareerPathDetail = lazy(() => import('./pages/careers/CareerPathDetail'));
const InterviewPrep = lazy(() => import('./pages/careers/InterviewPrep'));
const SkillGap = lazy(() => import('./pages/careers/SkillGap'));

// Public site pages (about, contact, legal). Lazily loaded like everything
// else -- they are linked from the footer, not needed on first paint.
const About = lazy(() => import('./pages/site/About'));
const Contact = lazy(() => import('./pages/site/Contact'));
const Privacy = lazy(() => import('./pages/site/Privacy'));
const Terms = lazy(() => import('./pages/site/Terms'));

// Job alerts
const JobAlerts = lazy(() => import('./pages/jobs/JobAlerts'));

// Notification settings
const NotificationSettings = lazy(() => import('./pages/notifications/NotificationSettings'));

// Route guards. All four delegate to RequireRole, which sends signed-out
// visitors to /login carrying their intended destination and shows a real
// explanation on a role mismatch instead of silently redirecting to "/".
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <RequireRole role="any">{children}</RequireRole>
);

const StudentRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <RequireRole role="student">{children}</RequireRole>
);

const RecruiterRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <RequireRole role="recruiter">{children}</RequireRole>
);

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <RequireRole role="admin">{children}</RequireRole>
);

const App: React.FC = () => {
  const location = useLocation();
  return (
    // Keyed by pathname so the boundary resets when the user navigates away
    // from a crashed page instead of staying stuck on the fallback.
    <ErrorBoundary key={location.pathname}>
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/jobs" element={<JobList />} />
        <Route path="/jobs/:id" element={<JobDetail />} />
        <Route path="/internships" element={<InternshipList />} />
        <Route path="/internships/:id" element={<InternshipDetail />} />
        {/* Company & legal */}
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/notifications" element={<ProtectedRoute><NotificationList /></ProtectedRoute>} />
        <Route path="/notifications/settings" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />

        {/* Social routes — these pages and their APIs already existed but were
            never routed, so the feed, network and public profiles were
            unreachable from the running app. */}
        <Route path="/feed" element={<ProtectedRoute><NewsFeed /></ProtectedRoute>} />
        <Route path="/network" element={<ProtectedRoute><Network /></ProtectedRoute>} />
        <Route path="/profile/recruiter/:id" element={<PublicRecruiterProfile />} />
        <Route path="/profile/:id" element={<PublicProfile />} />
        {/* Student routes */}
        <Route path="/student/dashboard" element={<StudentRoute><StudentDashboard /></StudentRoute>} />
        <Route path="/student/profile" element={<StudentRoute><StudentProfile /></StudentRoute>} />
        <Route path="/student/applications" element={<StudentRoute><MyApplications /></StudentRoute>} />
        <Route path="/student/applications/board" element={<StudentRoute><ApplicationBoard /></StudentRoute>} />
        <Route path="/student/saved-jobs" element={<StudentRoute><SavedJobs /></StudentRoute>} />
        
        {/* Recruiter routes */}
        <Route path="/recruiter/dashboard" element={<RecruiterRoute><RecruiterDashboard /></RecruiterRoute>} />
        <Route path="/recruiter/profile" element={<RecruiterRoute><RecruiterProfile /></RecruiterRoute>} />
        
        {/* Admin routes — unique admin-only page (path avoids the server-rendered
            /admin/* namespace so hard refreshes reach the SPA, not Django admin) */}
        <Route path="/admin-portal" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/recruiter/jobs" element={<RecruiterRoute><ManageJobs /></RecruiterRoute>} />
        <Route path="/recruiter/internships" element={<RecruiterRoute><ManageInternships /></RecruiterRoute>} />
        <Route path="/recruiter/post-job" element={<RecruiterRoute><PostJob /></RecruiterRoute>} />
        <Route path="/recruiter/post-internship" element={<RecruiterRoute><PostInternship /></RecruiterRoute>} />
        <Route path="/recruiter/saved-candidates" element={<RecruiterRoute><SavedCandidates /></RecruiterRoute>} />
        <Route path="/recruiter/applicants" element={<RecruiterRoute><Applicants /></RecruiterRoute>} />
        <Route path="/recruiter/company" element={<RecruiterRoute><CompanyProfile /></RecruiterRoute>} />
        
        {/* Career routes */}
        <Route path="/careers/paths" element={<CareerPathList />} />
        <Route path="/careers/paths/:id" element={<CareerPathDetail />} />
        <Route path="/careers/interview-prep" element={<InterviewPrep />} />
        <Route path="/careers/skill-gap" element={<StudentRoute><SkillGap /></StudentRoute>} />
        
        {/* Job alerts */}
        <Route path="/job-alerts" element={<ProtectedRoute><JobAlerts /></ProtectedRoute>} />
        
        {/* Catch-all 404 */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
    </Suspense>
    </ErrorBoundary>
  );
};

export default App;
