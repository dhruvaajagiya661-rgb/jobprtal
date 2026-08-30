import React from 'react';
import { Link } from 'react-router-dom';
import useSeo from '../hooks/useSeo';

const NotFound: React.FC = () => {
  useSeo({
    title: 'Page not found',
    description: 'That page does not exist. Head back to the job and internship listings.',
    noIndex: true,
  });
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-lg animate-fade-in-up">
        <div className="text-8xl font-extrabold bg-gradient-to-r from-primary-600 via-accent-500 to-primary-400 bg-clip-text text-transparent mb-4">
          404
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-surface-900 mb-3">
          Page not found
        </h1>
        <p className="text-surface-600 mb-8 leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
          Let's get you back on track.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="btn-primary px-6 py-3 shadow-lg shadow-primary-500/20"
          >
            Go to Homepage
          </Link>
          <Link
            to="/jobs"
            className="btn-ghost px-6 py-3 text-primary-600 border border-primary-200 hover:bg-primary-50"
          >
            Browse Jobs
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
