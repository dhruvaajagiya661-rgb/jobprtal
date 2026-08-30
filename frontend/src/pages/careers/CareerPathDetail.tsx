import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { careersAPI } from '../../api/client';

interface Milestone {
  id: number;
  title: string;
  level: string;
  description: string;
  order: number;
  skills_required: { id: number; name: string }[];
  experience_years: string;
  salary_range: string;
}

interface CareerPath {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  avg_salary_min: number;
  avg_salary_max: number;
  growth_outlook: string;
  milestones: Milestone[];
}

const levelColors: Record<string, string> = {
  entry: 'bg-green-100 text-green-700',
  mid: 'bg-blue-100 text-blue-700',
  senior: 'bg-purple-100 text-purple-700',
  lead: 'bg-orange-100 text-orange-700',
  principal: 'bg-red-100 text-red-700',
};

const CareerPathDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [path, setPath] = useState<CareerPath | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    careersAPI.pathDetail(Number(id)).then(r => setPath(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;
  if (!path) return <div className="text-center py-20"><p className="text-gray-500">Career path not found</p></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link to="/careers/paths" className="inline-flex items-center text-sm text-gray-500 hover:text-primary-600 mb-6">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Career Paths
      </Link>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-8">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${path.color}15` }}>
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: path.color }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{path.name}</h1>
            <p className="text-gray-500 mt-2">{path.description}</p>
            <div className="flex flex-wrap gap-4 mt-4 text-sm">
              <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg">💰 ${path.avg_salary_min?.toLocaleString()} - ${path.avg_salary_max?.toLocaleString()}</span>
              {path.growth_outlook && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-lg">📈 {path.growth_outlook}</span>}
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-6">Career Milestones</h2>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>

        <div className="space-y-8">
          {path.milestones?.map((milestone, idx) => (
            <div key={milestone.id} className="relative pl-16">
              {/* Timeline dot */}
              <div className="absolute left-5 top-1 w-7 h-7 rounded-full bg-white border-2 border-primary-500 flex items-center justify-center">
                <span className="text-xs font-bold text-primary-600">{idx + 1}</span>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{milestone.title}</h3>
                  <span className={`badge ${levelColors[milestone.level] || 'bg-gray-100 text-gray-600'}`}>
                    {milestone.level}
                  </span>
                </div>
                <p className="text-gray-600 text-sm">{milestone.description}</p>
                <div className="flex items-center gap-4 mt-3 text-sm text-gray-400">
                  <span>⏱ {milestone.experience_years}</span>
                  {milestone.salary_range && <span>💰 {milestone.salary_range}</span>}
                </div>
                {milestone.skills_required?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {milestone.skills_required.map(s => (
                      <span key={s.id} className="px-2.5 py-1 bg-primary-50 text-primary-700 rounded-lg text-xs font-medium">{s.name}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CareerPathDetail;
