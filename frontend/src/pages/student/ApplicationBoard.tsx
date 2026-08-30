import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { applicationsAPI } from '../../api/client';
import { extractApiError } from '../../utils/errors';

interface Application {
  id: number;
  job: { id: number; title: string; company: { name: string }; salary: string; location: string } | null;
  internship: { id: number; title: string; company: { name: string }; stipend: string; location: string } | null;
  status: string;
  applied_at: string;
  updated_at: string;
  resume: string;
}

interface BoardData {
  columns: Record<string, Application[]>;
  total: number;
}

const COLUMNS: { key: string; label: string; color: string; bgColor: string; dotColor: string }[] = [
  { key: 'Applied', label: 'Applied', color: 'text-amber-700', bgColor: 'bg-amber-50', dotColor: 'bg-amber-500' },
  { key: 'Shortlisted', label: 'Shortlisted', color: 'text-blue-700', bgColor: 'bg-blue-50', dotColor: 'bg-blue-500' },
  { key: 'Accepted', label: 'Accepted', color: 'text-emerald-700', bgColor: 'bg-emerald-50', dotColor: 'bg-emerald-500' },
  { key: 'Rejected', label: 'Rejected', color: 'text-red-700', bgColor: 'bg-red-50', dotColor: 'bg-red-500' },
];

const ApplicationBoard: React.FC = () => {
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const dragCounter = useRef<Record<string, number>>({});

  const fetchBoard = useCallback(() => {
    setLoading(true);
    setError('');
    applicationsAPI
      .board()
      .then(r => setBoardData(r.data))
      .catch(err => setError(extractApiError(err, 'Could not load your application board.')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  // --- HTML5 Drag & Drop handlers ---

  const handleDragStart = (e: React.DragEvent, appId: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(appId));
    // Slight delay so the drag image captures the original style
    requestAnimationFrame(() => setDraggingId(appId));
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverColumn(null);
    dragCounter.current = {};
  };

  const handleDragEnter = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    dragCounter.current[colKey] = (dragCounter.current[colKey] || 0) + 1;
    setDragOverColumn(colKey);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeave = (e: React.DragEvent, colKey: string) => {
    dragCounter.current[colKey] = (dragCounter.current[colKey] || 0) - 1;
    if (dragCounter.current[colKey] <= 0) {
      dragCounter.current[colKey] = 0;
      setDragOverColumn(prev => (prev === colKey ? null : prev));
    }
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    const appId = Number(e.dataTransfer.getData('text/plain'));
    if (!appId || !boardData) return;

    // Find the card's current status
    let sourceStatus: string | null = null;
    for (const [status, apps] of Object.entries(boardData.columns)) {
      if (apps.some(a => a.id === appId)) {
        sourceStatus = status;
        break;
      }
    }
    if (!sourceStatus || sourceStatus === targetStatus) {
      setDraggingId(null);
      setDragOverColumn(null);
      dragCounter.current = {};
      return;
    }

    // Optimistic UI update
    const app = boardData.columns[sourceStatus].find(a => a.id === appId)!;
    setBoardData(prev => {
      if (!prev) return prev;
      const next = { ...prev, columns: {} as Record<string, Application[]> };
      for (const [key, apps] of Object.entries(prev.columns)) {
        next.columns[key] = key === sourceStatus
          ? apps.filter(a => a.id !== appId)
          : key === targetStatus
            ? [{ ...app, status: targetStatus }, ...apps]
            : [...apps];
      }
      return next;
    });
    setDraggingId(null);
    setDragOverColumn(null);
    dragCounter.current = {};

    // Persist to server
    setUpdating(true);
    try {
      await applicationsAPI.bulkUpdateStatus([appId], targetStatus);
    } catch {
      // Revert on failure
      fetchBoard();
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-50 rounded-2xl mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-gray-500 mb-6">{error}</p>
        <button onClick={fetchBoard} className="btn-primary">Try Again</button>
      </div>
    );
  }

  if (!boardData) return null;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Application Tracker</h1>
          <p className="text-gray-500 mt-1">
            Drag and drop cards to update your application status
            {updating && <span className="ml-2 text-xs text-primary-600 animate-pulse">Saving…</span>}
          </p>
        </div>
        <div className="flex gap-3 mt-4 md:mt-0">
          <Link to="/student/applications" className="btn-secondary text-sm py-2 px-4">
            📋 List View
          </Link>
          <button onClick={fetchBoard} className="btn-secondary text-sm py-2 px-4">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {COLUMNS.map(col => (
          <div key={col.key} className={`${col.bgColor} rounded-xl p-4 flex items-center gap-3`}>
            <div className={`w-3 h-3 rounded-full ${col.dotColor}`}></div>
            <div>
              <p className={`text-sm font-semibold ${col.color}`}>{col.label}</p>
              <p className="text-2xl font-bold text-gray-900">{(boardData.columns[col.key] || []).length}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {COLUMNS.map(col => {
          const apps = boardData.columns[col.key] || [];
          const isOver = dragOverColumn === col.key;

          return (
            <div
              key={col.key}
              onDragEnter={e => handleDragEnter(e, col.key)}
              onDragOver={handleDragOver}
              onDragLeave={e => handleDragLeave(e, col.key)}
              onDrop={e => handleDrop(e, col.key)}
              className={`flex flex-col rounded-2xl border-2 transition-all duration-200 ${
                isOver
                  ? 'border-primary-400 bg-primary-50/50 shadow-lg shadow-primary-500/10'
                  : 'border-gray-100 bg-gray-50/50'
              }`}
            >
              {/* Column header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`}></div>
                  <h2 className={`text-sm font-bold ${col.color}`}>{col.label}</h2>
                </div>
                <span className="text-xs font-medium text-gray-400 bg-white px-2 py-0.5 rounded-full">
                  {apps.length}
                </span>
              </div>

              {/* Cards container */}
              <div className="p-3 flex-1 min-h-[200px] space-y-3 overflow-y-auto max-h-[calc(100vh-320px)]">
                {apps.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-10 text-center">
                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mb-2">
                      <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <p className="text-xs text-gray-400">No applications</p>
                  </div>
                ) : (
                  apps.map(app => {
                    const title = app.job?.title || app.internship?.title || 'Position';
                    const company = app.job?.company?.name || app.internship?.company?.name || '';
                    const detail = app.job?.salary || app.internship?.stipend || '';
                    const location = app.job?.location || app.internship?.location || '';
                    const isDragging = draggingId === app.id;

                    return (
                      <div
                        key={app.id}
                        draggable
                        onDragStart={e => handleDragStart(e, app.id)}
                        onDragEnd={handleDragEnd}
                        className={`bg-white rounded-xl border border-gray-100 p-4 cursor-grab active:cursor-grabbing transition-all duration-200 ${
                          isDragging
                            ? 'opacity-50 scale-95 shadow-none'
                            : 'hover:shadow-md hover:-translate-y-0.5 hover:border-primary-200'
                        }`}
                      >
                        {/* Card header */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 text-sm leading-tight truncate">{title}</h3>
                            <p className="text-xs text-gray-500 mt-0.5">{company}</p>
                          </div>
                          <div className="ml-2 flex-shrink-0 cursor-grab">
                            <svg className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                              <circle cx="9" cy="6" r="1.5" />
                              <circle cx="15" cy="6" r="1.5" />
                              <circle cx="9" cy="12" r="1.5" />
                              <circle cx="15" cy="12" r="1.5" />
                              <circle cx="9" cy="18" r="1.5" />
                              <circle cx="15" cy="18" r="1.5" />
                            </svg>
                          </div>
                        </div>

                        {/* Detail chips */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {detail && (
                            <span className="text-[11px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-md">
                              {detail}
                            </span>
                          )}
                          {location && (
                            <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                              📍 {location}
                            </span>
                          )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-50">
                          <span className="text-[11px] text-gray-400">
                            Applied {new Date(app.applied_at).toLocaleDateString()}
                          </span>
                          <Link
                            to={app.job ? `/jobs/${app.job.id}` : app.internship ? `/internships/${app.internship.id}` : '#'}
                            className="text-[11px] font-medium text-primary-600 hover:text-primary-700"
                          >
                            View →
                          </Link>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ApplicationBoard;
