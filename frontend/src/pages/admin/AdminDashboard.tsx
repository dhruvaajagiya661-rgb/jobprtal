import React, { useState, useEffect, useMemo } from 'react';
import { adminAPI } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { extractApiError } from '../../utils/errors';
import useSeo from '../../hooks/useSeo';
import { mediaUrl } from '../../utils/mediaUrl';

/* ─────────────────────────── Types ─────────────────────────── */

interface Stats {
  total_users: number;
  total_students: number;
  total_recruiters: number;
  total_companies: number;
  total_jobs: number;
  total_internships: number;
  total_applications: number;
  total_career_paths: number;
  total_milestones: number;
  total_interview_questions: number;
  total_resources: number;
  unread_notifications: number;
}

interface NotificationItem {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface Student {
  id: number; name: string; email: string; username: string; active: boolean;
  skills: string[]; education: string | null; experience: string | null;
  resume: string | null; portfolio_link: string | null; github_username: string | null; joined: string | null;
}
interface Recruiter {
  id: number; name: string; email: string; active: boolean; company: string | null;
  industry: string | null; size: string | null; location: string | null;
  designation: string | null; joined: string | null;
}
interface Job {
  id: number; title: string; company: string; location: string; job_type: string;
  salary: string | null; experience_required: string | null; deadline: string | null;
  applications_count: number; is_active: boolean;
}
interface Internship {
  id: number; title: string; company: string; location: string; internship_type: string;
  stipend: string | null; duration: string | null; deadline: string | null;
  applications_count: number; is_active: boolean;
}
interface Application {
  id: number; student: string; student_email: string; position: string | null;
  type: string; status: string; applied_at: string | null; resume: string | null;
}
interface Company {
  id: number; name: string; industry: string | null; size: string | null;
  location: string | null; website: string | null; recruiter_count: number;
}
interface CareerPath {
  id: number; name: string; description: string | null; avg_salary_min: number;
  avg_salary_max: number; growth_outlook: string | null; milestones_count: number;
  is_active: boolean;
}

interface AnalyticsData {
  application_status: Record<string, number>;
  monthly_applications: { month: string; count: number }[];
  jobs_per_company: { company: string; count: number }[];
  top_skills: { name: string; count: number }[];
  active_jobs: number;
  closed_jobs: number;
  active_internships: number;
  closed_internships: number;
  active_students: number;
  active_recruiters: number;
  recent_applications: Application[];
}

interface AdminData {
  query: string;
  stats: Stats;
  notifications: NotificationItem[];
  analytics: AnalyticsData;
  students: Student[];
  recruiters: Recruiter[];
  jobs: Job[];
  internships: Internship[];
  applications: Application[];
  companies: Company[];
  career_paths: CareerPath[];
  milestones: { id: number; title: string; career_path: string; level: string; experience_years: string | null; salary_range: string | null; skills: string[] }[];
  interview_questions: { id: number; question: string; skill: string; career_path: string | null; difficulty: string; is_behavioral: boolean; created_at: string | null }[];
  learning_resources: { id: number; title: string; url: string; skill: string; resource_type: string; difficulty: string; is_free: boolean; description: string | null; created_at: string | null }[];
}

const STATUS_COLORS: Record<string, string> = {
  Accepted: 'bg-emerald-100 text-emerald-700',
  Shortlisted: 'bg-amber-100 text-amber-700',
  Rejected: 'bg-red-100 text-red-700',
  Applied: 'bg-primary-100 text-primary-700',
};

/* ──────────────── Shared filter option definitions ──────────── */

const studentFilters: FilterOption<Student>[] = [
  { label: 'Active', value: 'active', match: s => s.active },
  { label: 'Inactive', value: 'inactive', match: s => !s.active },
];
const recruiterFilters: FilterOption<Recruiter>[] = [
  { label: 'Active', value: 'active', match: r => r.active },
  { label: 'Inactive', value: 'inactive', match: r => !r.active },
];
const jobFilters: FilterOption<Job>[] = [
  { label: 'Active', value: 'active', match: j => j.is_active },
  { label: 'Closed', value: 'closed', match: j => !j.is_active },
];
const internshipFilters: FilterOption<Internship>[] = [
  { label: 'Active', value: 'active', match: i => i.is_active },
  { label: 'Closed', value: 'closed', match: i => !i.is_active },
];
const applicationFilters: FilterOption<Application>[] = [
  { label: 'Applied', value: 'Applied', match: a => a.status === 'Applied' },
  { label: 'Shortlisted', value: 'Shortlisted', match: a => a.status === 'Shortlisted' },
  { label: 'Rejected', value: 'Rejected', match: a => a.status === 'Rejected' },
  { label: 'Accepted', value: 'Accepted', match: a => a.status === 'Accepted' },
];

/* ─────────────────────── CSV export helper ─────────────────── */

function formatCell(v: string | number | null | undefined): string {
  return v == null || v === '' ? '—' : String(v);
}

function downloadCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ────────────────────── Generic data table ─────────────────── */

interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  value: (row: T) => string | number | null | undefined;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface FilterOption<T> {
  label: string;
  value: string;
  match: (row: T) => boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  emptyLabel: string;
  filters?: FilterOption<T>[];
  searchable?: boolean;
  exportName?: string;
  defaultPageSize?: number;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
}

function DataTable<T>({ columns, rows, rowKey, emptyLabel, filters, searchable, exportName, defaultPageSize = 10, onEdit, onDelete }: DataTableProps<T>) {
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [activeFilter, setActiveFilter] = useState('all');
  const [q, setQ] = useState('');
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const filtered = useMemo(() => {
    let out = rows;
    if (filters && activeFilter !== 'all') {
      const f = filters.find(x => x.value === activeFilter);
      if (f) out = out.filter(f.match);
    }
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      out = out.filter(row => columns.some(c => String(c.value(row) ?? '').toLowerCase().includes(needle)));
    }
    return out;
  }, [rows, filters, activeFilter, q, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find(c => c.key === sortKey);
    if (!col) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = col.value(a) ?? '';
      const vb = col.value(b) ?? '';
      if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va;
      return sortDir === 'asc'
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
    return arr;
  }, [filtered, sortKey, sortDir, columns]);

  useEffect(() => { setPage(1); }, [activeFilter, q, pageSize, rows]);

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const paged = sorted.slice(start, start + pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  return (
    <div>
      {/* Toolbar: filters + search + page size + export */}
      <div className="dash-toolbar">
        {filters && (
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={activeFilter === 'all'} onClick={() => setActiveFilter('all')}>
              All ({rows.length})
            </FilterChip>
            {filters.map(f => (
              <FilterChip key={f.value} active={activeFilter === f.value} onClick={() => setActiveFilter(f.value)}>
                {f.label} ({rows.filter(f.match).length})
              </FilterChip>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {searchable && (
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Filter rows…"
              aria-label="Filter rows"
              className="dash-control w-40 placeholder-surface-400"
            />
          )}
          <select
            value={pageSize}
            onChange={e => setPageSize(Number(e.target.value))}
            aria-label="Rows per page"
            className="dash-control"
          >
            {[10, 25, 50].map(n => <option key={n} value={n}>{n}/page</option>)}
          </select>
          {exportName && (
            <button
              onClick={() => downloadCSV(exportName, columns.map(c => c.label), sorted.map(row => columns.map(c => c.value(row))))}
              className="dash-control-solid"
              title="Download all filtered rows as CSV"
            >
              <span aria-hidden="true">⬇</span> Export CSV
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="dash-table">
          <thead>
            <tr>
              {columns.map(c => (
                c.sortable ? (
                  <th
                    key={c.key}
                    onClick={() => toggleSort(c.key)}
                    aria-sort={sortKey === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="dash-th-sort"
                  >
                    {c.label}
                    <span className="dash-sort-icon" aria-hidden="true">
                      {sortKey === c.key ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </th>
                ) : (
                  <th key={c.key}>{c.label}</th>
                )
              ))}
              {(onEdit || onDelete) && (
                <th key="__actions" className="text-right">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {paged.map(row => (
              <tr key={rowKey(row)} className="group/row">
                {columns.map(c => (
                  <td key={c.key} className={c.className ?? ''}>
                    {c.render ? c.render(row) : <span className="text-surface-600">{formatCell(c.value(row))}</span>}
                  </td>
                ))}
                {(onEdit || onDelete) && (
                  <td key="__actions" className="text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1 opacity-60 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(row)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                          title="Edit this record"
                          aria-label="Edit this record"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(row)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                          title="Delete this record"
                          aria-label="Delete this record"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {!paged.length && <EmptyRow colSpan={columns.length + ((onEdit || onDelete) ? 1 : 0)} label={emptyLabel} />}
          </tbody>
        </table>
      </div>

      {/* Pager */}
      {total > 0 && (
        <div className="dash-panel-foot">
          <span className="tabular-nums">
            Showing {start + 1}–{Math.min(start + pageSize, total)} of {total}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
              aria-label="Previous page"
              className="dash-control-btn !px-2.5"
            >
              <span aria-hidden="true">←</span>
            </button>
            <span className="px-1.5 font-semibold text-surface-700 tabular-nums">{safePage} / {pageCount}</span>
            <button
              disabled={safePage >= pageCount}
              onClick={() => setPage(safePage + 1)}
              aria-label="Next page"
              className="dash-control-btn !px-2.5"
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const FilterChip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button onClick={onClick} data-active={active} aria-pressed={active} className="dash-pill !px-2.5 !py-1 !text-[11px]">
    {children}
  </button>
);

/* ───────────────────── Column definitions ──────────────────── */

const studentColumns: Column<Student>[] = [
  {
    key: 'name', label: 'Student', sortable: true, value: s => s.name,
    render: s => (
      <div>
        <div className="font-medium text-surface-900">{s.name}</div>
        <div className="text-xs text-surface-400">{s.email}</div>
      </div>
    ),
  },
  {
    key: 'skills', label: 'Skills', value: s => s.skills.join(', '),
    render: s => s.skills.length ? <ChipRow>{s.skills.map(sk => <SkillChip key={sk}>{sk}</SkillChip>)}</ChipRow> : <span className="text-surface-300">—</span>,
  },
  { key: 'education', label: 'Education', value: s => s.education, render: s => <span className="text-surface-500 max-w-[180px] block truncate">{s.education || '—'}</span> },
  { key: 'experience', label: 'Experience', value: s => s.experience, render: s => <span className="text-surface-500 max-w-[180px] block truncate">{s.experience || '—'}</span> },
  {
    key: 'resume', label: 'Resume', value: s => s.resume,
    render: s => s.resume
      ? <a href={mediaUrl(s.resume) ?? s.resume} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline text-xs font-medium">View</a>
      : <span className="text-surface-300">—</span>,
  },
  {
    key: 'links', label: 'Links', value: s => [s.portfolio_link, s.github_username].join(' '),
    render: s => (
      s.portfolio_link || s.github_username ? (
        <div className="flex flex-col gap-0.5">
          {s.portfolio_link && <a href={s.portfolio_link} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline text-xs">Portfolio</a>}
          {s.github_username && <a href={`https://github.com/${s.github_username}`} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline text-xs">GitHub</a>}
        </div>
      ) : <span className="text-surface-300">—</span>
    ),
  },
  {
    key: 'status', label: 'Status', sortable: true, value: s => (s.active ? 'Active' : 'Inactive'),
    render: s => s.active ? <Badge className="bg-emerald-100 text-emerald-700">Active</Badge> : <Badge className="bg-surface-100 text-surface-500">Inactive</Badge>,
  },
  { key: 'joined', label: 'Joined', sortable: true, value: s => s.joined, render: s => <span className="text-surface-400 whitespace-nowrap">{s.joined}</span> },
];

const recruiterColumns: Column<Recruiter>[] = [
  {
    key: 'name', label: 'Recruiter', sortable: true, value: r => r.name,
    render: r => (
      <div>
        <div className="font-medium text-surface-900">{r.name}</div>
        <div className="text-xs text-surface-400">{r.email}</div>
      </div>
    ),
  },
  { key: 'company', label: 'Company', sortable: true, value: r => r.company, render: r => <span className="font-medium text-surface-700">{r.company || '—'}</span> },
  { key: 'industry', label: 'Industry', value: r => r.industry, render: r => <span className="text-surface-500">{r.industry || '—'}</span> },
  { key: 'location', label: 'Location', value: r => r.location, render: r => <span className="text-surface-500">{r.location || '—'}</span> },
  { key: 'designation', label: 'Designation', value: r => r.designation, render: r => r.designation ? <SkillChip>{r.designation}</SkillChip> : '—' },
  {
    key: 'status', label: 'Status', sortable: true, value: r => (r.active ? 'Active' : 'Inactive'),
    render: r => r.active ? <Badge className="bg-emerald-100 text-emerald-700">Active</Badge> : <Badge className="bg-surface-100 text-surface-500">Inactive</Badge>,
  },
  { key: 'joined', label: 'Joined', sortable: true, value: r => r.joined, render: r => <span className="text-surface-400 whitespace-nowrap">{r.joined}</span> },
];

const jobColumns: Column<Job>[] = [
  { key: 'title', label: 'Title', sortable: true, value: j => j.title, render: j => <span className="font-medium text-surface-900">{j.title}</span> },
  { key: 'company', label: 'Company', sortable: true, value: j => j.company, render: j => <span className="text-surface-700">{j.company}</span> },
  { key: 'location', label: 'Location', value: j => j.location, render: j => <span className="text-surface-500">{j.location}</span> },
  { key: 'job_type', label: 'Type', value: j => j.job_type, render: j => <SkillChip>{j.job_type}</SkillChip> },
  { key: 'salary', label: 'Salary', value: j => j.salary, render: j => <span className="text-surface-500">{j.salary || '—'}</span> },
  { key: 'experience_required', label: 'Experience', value: j => j.experience_required, render: j => <span className="text-surface-500">{j.experience_required || '—'}</span> },
  { key: 'deadline', label: 'Deadline', sortable: true, value: j => j.deadline, render: j => <span className="text-surface-400 whitespace-nowrap">{j.deadline || '—'}</span> },
  { key: 'applications_count', label: 'Applications', sortable: true, value: j => j.applications_count, render: j => <Badge className="bg-primary-100 text-primary-700">{j.applications_count}</Badge> },
  {
    key: 'is_active', label: 'Status', sortable: true, value: j => (j.is_active ? 'Active' : 'Closed'),
    render: j => j.is_active ? <Badge className="bg-emerald-100 text-emerald-700">Active</Badge> : <Badge className="bg-surface-100 text-surface-500">Closed</Badge>,
  },
];

const internshipColumns: Column<Internship>[] = [
  { key: 'title', label: 'Title', sortable: true, value: i => i.title, render: i => <span className="font-medium text-surface-900">{i.title}</span> },
  { key: 'company', label: 'Company', sortable: true, value: i => i.company, render: i => <span className="text-surface-700">{i.company}</span> },
  { key: 'location', label: 'Location', value: i => i.location, render: i => <span className="text-surface-500">{i.location}</span> },
  { key: 'internship_type', label: 'Type', value: i => i.internship_type, render: i => <SkillChip>{i.internship_type}</SkillChip> },
  { key: 'stipend', label: 'Stipend', value: i => i.stipend, render: i => <span className="text-surface-500">{i.stipend || '—'}</span> },
  { key: 'duration', label: 'Duration', value: i => i.duration, render: i => <span className="text-surface-500">{i.duration || '—'}</span> },
  { key: 'deadline', label: 'Deadline', sortable: true, value: i => i.deadline, render: i => <span className="text-surface-400 whitespace-nowrap">{i.deadline || '—'}</span> },
  { key: 'applications_count', label: 'Applications', sortable: true, value: i => i.applications_count, render: i => <Badge className="bg-primary-100 text-primary-700">{i.applications_count}</Badge> },
  {
    key: 'is_active', label: 'Status', sortable: true, value: i => (i.is_active ? 'Active' : 'Closed'),
    render: i => i.is_active ? <Badge className="bg-emerald-100 text-emerald-700">Active</Badge> : <Badge className="bg-surface-100 text-surface-500">Closed</Badge>,
  },
];

const applicationColumns: Column<Application>[] = [
  {
    key: 'student', label: 'Student', sortable: true, value: a => a.student,
    render: a => (
      <div>
        <div className="font-medium text-surface-900">{a.student}</div>
        <div className="text-xs text-surface-400">{a.student_email}</div>
      </div>
    ),
  },
  { key: 'position', label: 'Position', sortable: true, value: a => a.position, render: a => <span className="text-surface-700">{a.position || '—'}</span> },
  { key: 'type', label: 'Type', value: a => a.type, render: a => <SkillChip>{a.type}</SkillChip> },
  {
    key: 'status', label: 'Status', sortable: true, value: a => a.status,
    render: a => <Badge className={STATUS_COLORS[a.status] || 'bg-surface-100 text-surface-600'}>{a.status}</Badge>,
  },
  { key: 'applied_at', label: 'Applied', sortable: true, value: a => a.applied_at, render: a => <span className="text-surface-400 whitespace-nowrap">{a.applied_at}</span> },
  {
    key: 'resume', label: 'Resume', value: a => a.resume,
    render: a => a.resume
      ? <a href={mediaUrl(a.resume) ?? a.resume} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline text-xs font-medium">View</a>
      : <span className="text-surface-300">—</span>,
  },
];

const companyColumns: Column<Company>[] = [
  {
    key: 'name', label: 'Company', sortable: true, value: c => c.name,
    render: c => (
      <div>
        <div className="font-medium text-surface-900">{c.name}</div>
        {c.website && <div className="text-xs text-primary-600">{c.website.replace(/^https?:\/\//, '')}</div>}
      </div>
    ),
  },
  { key: 'industry', label: 'Industry', sortable: true, value: c => c.industry, render: c => <span className="text-surface-500">{c.industry || '—'}</span> },
  { key: 'size', label: 'Size', value: c => c.size, render: c => <span className="text-surface-500">{c.size || '—'}</span> },
  { key: 'location', label: 'Location', value: c => c.location, render: c => <span className="text-surface-500">{c.location || '—'}</span> },
  { key: 'recruiter_count', label: 'Recruiters', sortable: true, value: c => c.recruiter_count, render: c => <Badge className="bg-slate-100 text-slate-700">{c.recruiter_count}</Badge> },
];

const careerPathColumns: Column<CareerPath>[] = [
  {
    key: 'name', label: 'Path', sortable: true, value: p => p.name,
    render: p => (
      <div>
        <div className="font-medium text-surface-900">{p.name}</div>
        {p.description && <div className="text-xs text-surface-400 max-w-[260px] truncate" title={p.description}>{p.description}</div>}
      </div>
    ),
  },
  { key: 'salary', label: 'Salary Range', value: p => `${p.avg_salary_min} - ${p.avg_salary_max}`, render: p => <span className="text-surface-500">${p.avg_salary_min} - ${p.avg_salary_max}</span> },
  { key: 'growth', label: 'Growth', value: p => p.growth_outlook, render: p => p.growth_outlook ? <Badge className="bg-emerald-100 text-emerald-700">{p.growth_outlook}</Badge> : '—' },
  { key: 'milestones_count', label: 'Milestones', sortable: true, value: p => p.milestones_count, render: p => <Badge className="bg-primary-100 text-primary-700">{p.milestones_count}</Badge> },
  {
    key: 'is_active', label: 'Status', sortable: true, value: p => (p.is_active ? 'Active' : 'Inactive'),
    render: p => p.is_active ? <Badge className="bg-emerald-100 text-emerald-700">Active</Badge> : <Badge className="bg-surface-100 text-surface-500">Inactive</Badge>,
  },
];

const milestoneColumns: Column<{ id: number; title: string; career_path: string; level: string; experience_years: string | null; salary_range: string | null; skills: string[] }>[] = [
  { key: 'title', label: 'Title', sortable: true, value: m => m.title, render: m => <span className="font-medium text-surface-900">{m.title}</span> },
  { key: 'career_path', label: 'Career Path', sortable: true, value: m => m.career_path, render: m => <span className="text-surface-500">{m.career_path}</span> },
  { key: 'level', label: 'Level', value: m => m.level, render: m => <SkillChip>{m.level}</SkillChip> },
  { key: 'experience_years', label: 'Experience', value: m => m.experience_years, render: m => <span className="text-surface-500">{m.experience_years}</span> },
  { key: 'salary_range', label: 'Salary', value: m => m.salary_range, render: m => <span className="text-surface-500">{m.salary_range || '—'}</span> },
  {
    key: 'skills', label: 'Skills', value: m => m.skills.join(', '),
    render: m => m.skills.length ? <ChipRow>{m.skills.map(sk => <SkillChip key={sk}>{sk}</SkillChip>)}</ChipRow> : <span className="text-surface-300">—</span>,
  },
];

const questionColumns: Column<{ id: number; question: string; skill: string; career_path: string | null; difficulty: string; is_behavioral: boolean; created_at: string | null }>[] = [
  { key: 'question', label: 'Question', value: q => q.question, render: q => <span className="max-w-[340px] block truncate text-surface-700">{q.question}</span> },
  { key: 'skill', label: 'Skill', sortable: true, value: q => q.skill, render: q => <SkillChip>{q.skill}</SkillChip> },
  { key: 'career_path', label: 'Career Path', value: q => q.career_path, render: q => <span className="text-surface-500">{q.career_path || '—'}</span> },
  { key: 'difficulty', label: 'Difficulty', sortable: true, value: q => q.difficulty, render: q => <Badge className="bg-amber-100 text-amber-700">{q.difficulty}</Badge> },
  { key: 'type', label: 'Type', value: q => (q.is_behavioral ? 'Behavioral' : 'Technical'), render: q => q.is_behavioral ? <SkillChip>Behavioral</SkillChip> : <SkillChip>Technical</SkillChip> },
  { key: 'created_at', label: 'Created', sortable: true, value: q => q.created_at, render: q => <span className="text-surface-400 whitespace-nowrap">{q.created_at || '—'}</span> },
];

const resourceColumns: Column<{ id: number; title: string; url: string; skill: string; resource_type: string; difficulty: string; is_free: boolean; description: string | null; created_at: string | null }>[] = [
  {
    key: 'title', label: 'Title', sortable: true, value: r => r.title,
    render: r => (
      <div>
        <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary-600 hover:underline">{r.title}</a>
        {r.description && <div className="text-xs text-surface-400 max-w-[260px] truncate" title={r.description}>{r.description}</div>}
      </div>
    ),
  },
  { key: 'skill', label: 'Skill', sortable: true, value: r => r.skill, render: r => <SkillChip>{r.skill}</SkillChip> },
  { key: 'resource_type', label: 'Type', value: r => r.resource_type, render: r => <span className="text-surface-500">{r.resource_type}</span> },
  { key: 'difficulty', label: 'Difficulty', value: r => r.difficulty, render: r => <Badge className="bg-amber-100 text-amber-700">{r.difficulty}</Badge> },
  {
    key: 'is_free', label: 'Access', value: r => (r.is_free ? 'Free' : 'Paid'),
    render: r => r.is_free ? <Badge className="bg-emerald-100 text-emerald-700">Free</Badge> : <Badge className="bg-surface-100 text-surface-500">Paid</Badge>,
  },
  { key: 'created_at', label: 'Created', sortable: true, value: r => r.created_at, render: r => <span className="text-surface-400 whitespace-nowrap">{r.created_at || '—'}</span> },
];

/* ─────────────────── Edit form schema definitions ───────────── */

type EditFieldType = 'text' | 'textarea' | 'number' | 'checkbox' | 'select';

interface EditField {
  key: string;
  label: string;
  type: EditFieldType;
  options?: { value: string; label: string }[];
  placeholder?: string;
  fullWidth?: boolean;
  required?: boolean;
}

const JOB_TYPES = ['Full-time', 'Part-time', 'Remote', 'On-site'].map(v => ({ value: v, label: v }));
const APPLICATION_STATUSES = ['Applied', 'Shortlisted', 'Rejected', 'Accepted'].map(v => ({ value: v, label: v }));
const MILESTONE_LEVELS = [
  { value: 'entry', label: 'Entry Level' },
  { value: 'mid', label: 'Mid Level' },
  { value: 'senior', label: 'Senior' },
  { value: 'lead', label: 'Lead / Manager' },
  { value: 'principal', label: 'Principal / Architect' },
];
const DIFFICULTIES = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];
const RESOURCE_TYPES = [
  { value: 'course', label: 'Online Course' },
  { value: 'tutorial', label: 'Tutorial' },
  { value: 'article', label: 'Article' },
  { value: 'video', label: 'Video' },
  { value: 'book', label: 'Book' },
  { value: 'documentation', label: 'Documentation' },
];

// Field keys must match the backend AdminUpdateAPIView schema whitelist.
const EDIT_SCHEMAS: Record<string, EditField[]> = {
  student: [
    { key: 'active', label: 'Account Active', type: 'checkbox' },
    { key: 'education', label: 'Education', type: 'textarea', fullWidth: true },
    { key: 'experience', label: 'Experience', type: 'textarea', fullWidth: true },
    { key: 'github_username', label: 'GitHub Username', type: 'text' },
    { key: 'portfolio_link', label: 'Portfolio Link', type: 'text' },
  ],
  recruiter: [
    { key: 'active', label: 'Account Active', type: 'checkbox' },
    { key: 'designation', label: 'Designation', type: 'text', required: true },
  ],
  job: [
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'location', label: 'Location', type: 'text', required: true },
    { key: 'job_type', label: 'Job Type', type: 'select', options: JOB_TYPES },
    { key: 'salary', label: 'Salary', type: 'text' },
    { key: 'experience_required', label: 'Experience Required', type: 'text' },
    { key: 'deadline', label: 'Deadline (YYYY-MM-DD)', type: 'text', placeholder: '2026-12-31' },
    { key: 'is_active', label: 'Active / Open', type: 'checkbox' },
  ],
  internship: [
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'location', label: 'Location', type: 'text', required: true },
    { key: 'internship_type', label: 'Internship Type', type: 'select', options: JOB_TYPES },
    { key: 'stipend', label: 'Stipend', type: 'text' },
    { key: 'duration', label: 'Duration', type: 'text' },
    { key: 'deadline', label: 'Deadline (YYYY-MM-DD)', type: 'text', placeholder: '2026-12-31' },
    { key: 'is_active', label: 'Active / Open', type: 'checkbox' },
  ],
  application: [
    { key: 'status', label: 'Status', type: 'select', options: APPLICATION_STATUSES, required: true },
  ],
  company: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'industry', label: 'Industry', type: 'text' },
    { key: 'size', label: 'Size', type: 'text' },
    { key: 'location', label: 'Location', type: 'text' },
    { key: 'website', label: 'Website', type: 'text' },
  ],
  career_path: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea', fullWidth: true },
    { key: 'avg_salary_min', label: 'Avg Salary Min ($)', type: 'number' },
    { key: 'avg_salary_max', label: 'Avg Salary Max ($)', type: 'number' },
    { key: 'growth_outlook', label: 'Growth Outlook', type: 'text' },
    { key: 'is_active', label: 'Active', type: 'checkbox' },
  ],
  milestone: [
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'level', label: 'Level', type: 'select', options: MILESTONE_LEVELS },
    { key: 'experience_years', label: 'Experience', type: 'text' },
    { key: 'salary_range', label: 'Salary Range', type: 'text' },
  ],
  question: [
    { key: 'question', label: 'Question', type: 'textarea', fullWidth: true, required: true },
    { key: 'difficulty', label: 'Difficulty', type: 'select', options: DIFFICULTIES },
    { key: 'is_behavioral', label: 'Behavioral question', type: 'checkbox' },
  ],
  resource: [
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'url', label: 'URL', type: 'text', required: true },
    { key: 'resource_type', label: 'Type', type: 'select', options: RESOURCE_TYPES },
    { key: 'difficulty', label: 'Difficulty', type: 'select', options: DIFFICULTIES },
    { key: 'is_free', label: 'Free', type: 'checkbox' },
    { key: 'description', label: 'Description', type: 'textarea', fullWidth: true },
  ],
};

const MODEL_LABELS: Record<string, string> = {
  student: 'Student',
  recruiter: 'Recruiter',
  job: 'Job',
  internship: 'Internship',
  application: 'Application',
  company: 'Company',
  career_path: 'Career Path',
  milestone: 'Milestone',
  question: 'Interview Question',
  resource: 'Learning Resource',
};

// Row values may be display labels (e.g. "Entry Level") while the backend
// expects raw values (e.g. "entry"); prefer the raw value, fall back to the
// label match, then to the raw string.
function initialSelectValue(options: { value: string; label: string }[], raw: unknown): string {
  if (raw == null) return '';
  const byValue = options.find(o => o.value === raw);
  if (byValue) return byValue.value;
  const byLabel = options.find(o => o.label === raw);
  return byLabel ? byLabel.value : String(raw);
}

// Row objects don't declare an index signature; this bridges them to the
// generic edit-form record type without loosening any other typing.
const asRecord = (row: object): Record<string, unknown> => row as Record<string, unknown>;

/* ───────────────────────── Main component ──────────────────── */

const AdminDashboard: React.FC = () => {
  useSeo({ title: 'Admin', noIndex: true });
  const { user } = useAuth();
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'students' | 'recruiters' | 'jobs' | 'internships' | 'applications' | 'companies' | 'careers'>('all');
  const [pendingDelete, setPendingDelete] = useState<{ model: string; id: number; label: string; extra?: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingEdit, setPendingEdit] = useState<{ model: string; id: number; label: string; record: Record<string, unknown> } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const fetchData = (q?: string) => {
    setLoading(true);
    adminAPI.dashboard(q ? { q } : undefined)
      .then(r => setData(r.data))
      .catch(err => setError(extractApiError(err, 'Failed to load admin dashboard data')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData(query.trim() || undefined);
  };

  const requestDelete = (model: string, id: number, label: string, extra?: string) => {
    setPendingDelete({ model, id, label, extra });
    setDeleteError(null);
  };

  const confirmDelete = () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    adminAPI.deleteItem(pendingDelete.model, pendingDelete.id)
      .then(() => {
        const deleted = pendingDelete.label;
        setPendingDelete(null);
        setFlash({ kind: 'success', text: `Deleted "${deleted}"` });
        fetchData(data?.query || undefined);
      })
      .catch(err => setDeleteError(extractApiError(err, 'Failed to delete. Please try again.')))
      .finally(() => setDeleting(false));
  };

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(t);
  }, [flash]);

  const requestEdit = (model: string, id: number, label: string, record: Record<string, unknown>) => {
    setPendingEdit({ model, id, label, record });
    setSaveError(null);
  };

  const submitEdit = (fields: Record<string, unknown>) => {
    if (!pendingEdit || saving) return;
    setSaving(true);
    setSaveError(null);
    adminAPI.updateItem(pendingEdit.model, pendingEdit.id, fields)
      .then(() => {
        const edited = pendingEdit.label;
        setPendingEdit(null);
        setFlash({ kind: 'success', text: `Updated "${edited}"` });
        fetchData(data?.query || undefined);
      })
      .catch(err => {
        const serverMsg = extractApiError(err, '');
        setSaveError(serverMsg ? `Save failed: ${serverMsg}` : 'Failed to save changes. Please try again.');
      })
      .finally(() => setSaving(false));
  };

  const stats = useMemo(() => {
    if (!data) return [];
    const s = data.stats;
    return [
      { label: 'Total Users', value: s.total_users, icon: '👥', accent: 'from-indigo-500 to-purple-600' },
      { label: 'Students', value: s.total_students, icon: '🎓', accent: 'from-sky-500 to-primary-600' },
      { label: 'Recruiters', value: s.total_recruiters, icon: '💼', accent: 'from-emerald-500 to-teal-600' },
      { label: 'Companies', value: s.total_companies, icon: '🏢', accent: 'from-amber-500 to-orange-600' },
      { label: 'Jobs', value: s.total_jobs, icon: '📋', accent: 'from-rose-500 to-pink-600' },
      { label: 'Internships', value: s.total_internships, icon: '🖥️', accent: 'from-violet-500 to-fuchsia-600' },
      { label: 'Applications', value: s.total_applications, icon: '📄', accent: 'from-cyan-500 to-sky-600' },
      { label: 'Career Paths', value: s.total_career_paths, icon: '🗺️', accent: 'from-lime-500 to-emerald-600' },
      { label: 'Milestones', value: s.total_milestones, icon: '🎯', accent: 'from-slate-500 to-surface-600' },
      { label: 'Interview Qs', value: s.total_interview_questions, icon: '❓', accent: 'from-red-500 to-rose-600' },
      { label: 'Resources', value: s.total_resources, icon: '📚', accent: 'from-teal-500 to-emerald-600' },
    ];
  }, [data]);

  if (loading && !data) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
        <div className="spinner-gradient !w-11 !h-11 !border-[3px]"></div>
        <p className="text-sm text-surface-400 font-medium animate-pulse">Loading the control center…</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="card-elevated max-w-md w-full p-10 text-center animate-scale-in">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-surface-900 mb-2">Something went wrong</h2>
          <p className="text-surface-500 text-sm mb-6">{error}</p>
          <button onClick={() => { setError(null); fetchData(); }} className="btn-primary">Try again</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const tabs = [
    { key: 'all' as const, label: 'Overview', count: data.stats.total_users },
    { key: 'students' as const, label: 'Students', count: data.students.length },
    { key: 'recruiters' as const, label: 'Recruiters', count: data.recruiters.length },
    { key: 'jobs' as const, label: 'Jobs', count: data.jobs.length },
    { key: 'internships' as const, label: 'Internships', count: data.internships.length },
    { key: 'applications' as const, label: 'Applications', count: data.applications.length },
    { key: 'companies' as const, label: 'Companies', count: data.companies.length },
    { key: 'careers' as const, label: 'Career Content', count: data.career_paths.length },
  ];

  const an = data.analytics;
  const statusTotal = Object.values(an.application_status).reduce((a, b) => a + b, 0);
  const appStatusColors: Record<string, string> = {
    Applied: 'track-fill-indigo',
    Shortlisted: 'track-fill-amber',
    Rejected: 'track-fill-violet',
    Accepted: 'track-fill-emerald',
  };

  return (
    <div className="dash-shell py-8 dash-stack">
      {/* Admin hero. Same mesh + grain + hairline-grid identity as PageHero, so
          the control center reads as part of the same product rather than a
          bolted-on console — only the copy and the badges are admin-specific. */}
      <div className="relative overflow-hidden rounded-3xl mesh-hero mesh-animate grain text-white">
        <div className="absolute inset-0 grid-lines"></div>
        <div className="absolute -top-20 -left-12 w-72 h-72 bg-primary-500/20 rounded-full blur-3xl animate-float"></div>
        <div
          className="absolute -bottom-24 right-0 w-80 h-80 bg-accent-500/20 rounded-full blur-3xl animate-float"
          style={{ animationDelay: '-2.5s' }}
        ></div>

        <div className="relative z-10 p-8 sm:p-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-white/75 text-[11px] font-bold uppercase tracking-[0.14em] backdrop-blur">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Super Admin
            </span>
            <span className="inline-flex items-center px-3.5 py-1.5 rounded-full bg-amber-400/15 border border-amber-300/25 text-amber-200 text-[11px] font-bold uppercase tracking-[0.14em] backdrop-blur">
              Control Center
            </span>
          </div>

          <h1 className="mt-5 text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.05]">
            Admin{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-300 via-accent-300 to-emerald-300">
              Dashboard
            </span>
          </h1>
          <p className="mt-4 text-base md:text-lg text-white/60 leading-relaxed max-w-xl">
            Complete platform overview — signed in as{' '}
            <span className="font-semibold text-white/90">{user?.email}</span>
          </p>

          <div className="flex flex-wrap gap-2.5 mt-7">
            <PulsePill label="Active Students" value={an.active_students} color="bg-sky-400" />
            <PulsePill label="Active Recruiters" value={an.active_recruiters} color="bg-emerald-400" />
            <PulsePill label="Open Jobs" value={an.active_jobs} color="bg-rose-400" />
            <PulsePill label="Open Internships" value={an.active_internships} color="bg-violet-400" />
          </div>
        </div>
      </div>

      {/* Transient success/error flash */}
      {flash && (
        <div
          role="status"
          aria-live="polite"
          className={`animate-fade-in-down px-4 py-3 rounded-2xl text-sm font-semibold flex items-center gap-2.5 border ${flash.kind === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}
        >
          <span aria-hidden="true" className="text-base leading-none">{flash.kind === 'success' ? '✓' : '⚠'}</span>
          <span>{flash.text}</span>
        </div>
      )}

      {/* Notifications strip */}
      <div className="dash-panel dash-panel-body reveal" style={{ '--i': 0 } as React.CSSProperties}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h2 className="dash-title flex items-center gap-2.5">
            <span aria-hidden="true" className="text-lg leading-none">🔔</span>
            Recent notifications
            {data.stats.unread_notifications > 0 && (
              <span className="chip bg-red-50 text-red-600 ring-1 ring-red-200">
                {data.stats.unread_notifications} unread
              </span>
            )}
          </h2>
          <a href="/admin/" className="text-sm font-semibold text-primary-600 hover:text-primary-700 link-hover">
            Django admin →
          </a>
        </div>
        {data.notifications.length === 0 ? (
          <p className="text-sm text-surface-400">No notifications yet. They'll appear when students apply or recruiters post jobs.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {data.notifications.map((n, i) => (
              <div
                key={n.id}
                style={{ '--i': i } as React.CSSProperties}
                className={`reveal rounded-xl border p-3.5 transition-colors ${n.is_read ? 'border-surface-200/70 bg-surface-50 hover:bg-surface-100/70' : 'border-primary-200/70 bg-primary-50/70 hover:bg-primary-50'}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${n.is_read ? 'bg-surface-300' : 'bg-red-500 animate-pulse'}`}></span>
                  <span className="font-bold text-sm text-surface-900 truncate">{n.title}</span>
                  {!n.is_read && (
                    <span className="ml-auto shrink-0 px-1.5 py-0.5 rounded bg-red-100 text-red-600 text-[10px] font-bold tracking-wider">NEW</span>
                  )}
                </div>
                <p className="text-xs text-surface-500 mt-1.5 line-clamp-2 leading-relaxed">{n.message}</p>
                <p className="text-[11px] text-surface-400 mt-1.5 tabular-nums">{n.created_at}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="dash-stat-flow">
        {stats.map((stat, i) => (
          <div key={stat.label} style={{ '--i': i } as React.CSSProperties} className="reveal dash-stat">
            <div className={`dash-stat-icon bg-gradient-to-br ${stat.accent}`} aria-hidden="true">
              {stat.icon}
            </div>
            <div className="dash-stat-body">
              <p className="dash-stat-value">{stat.value}</p>
              <p className="dash-stat-label">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Analytics / charts ── */}
      <div className="grid md:grid-cols-2 gap-6">
        <ChartCard icon="📈" title="Applications — last 6 months" subtitle={`${an.monthly_applications.reduce((a, m) => a + m.count, 0)} total applications`}>
          <MonthlyBarChart data={an.monthly_applications} />
        </ChartCard>

        <ChartCard icon="🎯" title="Application status" subtitle={`${statusTotal} total applications`}>
          {statusTotal === 0 ? (
            <p className="text-sm text-surface-400 py-6 text-center">No applications yet.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(an.application_status).map(([status, count]) => (
                <StatusBar key={status} label={status} count={count} total={statusTotal} color={appStatusColors[status] || 'track-fill-sky'} />
              ))}
            </div>
          )}
        </ChartCard>

        <ChartCard icon="🏢" title="Jobs by company" subtitle="Top companies by open/listed jobs">
          <HBarList
            items={an.jobs_per_company.map(c => ({ label: c.company, count: c.count }))}
            maxItems={5}
            color="from-rose-500 to-pink-500"
            emptyText="No jobs posted yet."
          />
        </ChartCard>

        <ChartCard icon="🛠️" title="Most in-demand skills" subtitle="Skills required across all job listings">
          <div className="flex flex-wrap gap-2 pt-1">
            {an.top_skills.length === 0 && <p className="text-sm text-surface-400 py-6 text-center w-full">No skills data yet.</p>}
            {an.top_skills.map(s => (
              <div
                key={s.name}
                className="flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-full bg-primary-50 border border-primary-100 transition-colors hover:bg-primary-100"
              >
                <span className="text-xs font-semibold text-primary-700">{s.name}</span>
                <span className="text-[10px] font-bold text-primary-600 bg-white/80 rounded-full px-1.5 py-0.5 tabular-nums">
                  {s.count}
                </span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Search */}
      <div className="dash-panel dash-panel-body">
        <form onSubmit={onSearch} className="flex flex-wrap gap-3 items-center">
          <label htmlFor="admin-search" className="sr-only">Search the platform</label>
          <input
            id="admin-search"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search students, recruiters, jobs, companies…"
            className="input-field flex-1 min-w-[280px]"
          />
          <button type="submit" className="btn-primary">Search</button>
          {data.query && (
            <span className="text-sm text-surface-500">
              Showing results for "<strong className="text-surface-800">{data.query}</strong>"
            </span>
          )}
        </form>

        <div className="h-px bg-surface-100 my-5"></div>

        <div className="flex flex-wrap gap-2">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              data-active={activeTab === tab.key}
              aria-pressed={activeTab === tab.key}
              className="dash-pill !text-sm !px-4 !py-2"
            >
              {tab.label}{' '}
              <span className={`tabular-nums ${activeTab === tab.key ? 'text-white/50' : 'text-surface-400'}`}>
                ({tab.count})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Table sections ── */}
      {(activeTab === 'all' || activeTab === 'students') && (
        <TableSection title="🎓 All Students" count={data.students.length} query={data.query}>
          <DataTable columns={studentColumns} rows={data.students} rowKey={s => s.id} emptyLabel="students" filters={studentFilters} searchable exportName="students.csv" onEdit={s => requestEdit('student', s.id, s.name, asRecord(s))} onDelete={s => requestDelete('student', s.id, s.name, 'This permanently deletes their account, applications and saved jobs.')} />
        </TableSection>
      )}

      {(activeTab === 'all' || activeTab === 'recruiters') && (
        <TableSection title="💼 All Recruiters" count={data.recruiters.length} query={data.query}>
          <DataTable columns={recruiterColumns} rows={data.recruiters} rowKey={r => r.id} emptyLabel="recruiters" filters={recruiterFilters} searchable exportName="recruiters.csv" onEdit={r => requestEdit('recruiter', r.id, r.name, asRecord(r))} onDelete={r => requestDelete('recruiter', r.id, r.name, 'This permanently deletes their account.')} />
        </TableSection>
      )}

      {(activeTab === 'all' || activeTab === 'jobs') && (
        <TableSection title="📋 All Jobs" count={data.jobs.length} query={data.query}>
          <DataTable columns={jobColumns} rows={data.jobs} rowKey={j => j.id} emptyLabel="jobs" filters={jobFilters} searchable exportName="jobs.csv" onEdit={j => requestEdit('job', j.id, j.title, asRecord(j))} onDelete={j => requestDelete('job', j.id, j.title, 'All applications for this job will also be deleted.')} />
        </TableSection>
      )}

      {(activeTab === 'all' || activeTab === 'internships') && (
        <TableSection title="🖥️ All Internships" count={data.internships.length} query={data.query}>
          <DataTable columns={internshipColumns} rows={data.internships} rowKey={i => i.id} emptyLabel="internships" filters={internshipFilters} searchable exportName="internships.csv" onEdit={i => requestEdit('internship', i.id, i.title, asRecord(i))} onDelete={i => requestDelete('internship', i.id, i.title, 'All applications for this internship will also be deleted.')} />
        </TableSection>
      )}

      {(activeTab === 'all' || activeTab === 'applications') && (
        <TableSection title="📄 All Applications" count={data.applications.length} query={data.query}>
          <DataTable columns={applicationColumns} rows={data.applications} rowKey={a => a.id} emptyLabel="applications" filters={applicationFilters} searchable exportName="applications.csv" onEdit={a => requestEdit('application', a.id, `${a.student} → ${a.position || a.type}`, asRecord(a))} onDelete={a => requestDelete('application', a.id, `${a.student} → ${a.position || a.type}`, 'This removes the application record.')} />
        </TableSection>
      )}

      {(activeTab === 'all' || activeTab === 'companies') && (
        <TableSection title="🏢 All Companies" count={data.companies.length} query={data.query}>
          <DataTable
            columns={companyColumns}
            rows={data.companies}
            rowKey={c => c.id}
            emptyLabel="companies"
            searchable
            exportName="companies.csv"
            onEdit={c => requestEdit('company', c.id, c.name, asRecord(c))}
            onDelete={c => requestDelete('company', c.id, c.name, 'All jobs and internships posted under this company will also be deleted.')}
          />
        </TableSection>
      )}

      {(activeTab === 'all' || activeTab === 'careers') && (
        <>
          <TableSection title="🗺️ All Career Paths" count={data.career_paths.length} query={data.query}>
            <DataTable columns={careerPathColumns} rows={data.career_paths} rowKey={p => p.id} emptyLabel="career paths" searchable exportName="career-paths.csv" onEdit={p => requestEdit('career_path', p.id, p.name, asRecord(p))} onDelete={p => requestDelete('career_path', p.id, p.name, 'Its milestones and linked questions will also be removed.')} />
          </TableSection>
          <TableSection title="🎯 All Career Milestones" count={data.milestones.length} query={data.query}>
            <DataTable columns={milestoneColumns} rows={data.milestones} rowKey={m => m.id} emptyLabel="milestones" searchable exportName="milestones.csv" onEdit={m => requestEdit('milestone', m.id, m.title, asRecord(m))} onDelete={m => requestDelete('milestone', m.id, m.title)} />
          </TableSection>
          <TableSection title="❓ All Interview Questions" count={data.interview_questions.length} query={data.query}>
            <DataTable columns={questionColumns} rows={data.interview_questions} rowKey={q => q.id} emptyLabel="interview questions" searchable exportName="interview-questions.csv" onEdit={q => requestEdit('question', q.id, q.question.length > 42 ? `${q.question.slice(0, 42)}…` : q.question, asRecord(q))} onDelete={q => requestDelete('question', q.id, q.question.length > 42 ? `${q.question.slice(0, 42)}…` : q.question)} />
          </TableSection>
          <TableSection title="📚 All Learning Resources" count={data.learning_resources.length} query={data.query}>
            <DataTable columns={resourceColumns} rows={data.learning_resources} rowKey={r => r.id} emptyLabel="learning resources" searchable exportName="learning-resources.csv" onEdit={r => requestEdit('resource', r.id, r.title, asRecord(r))} onDelete={r => requestDelete('resource', r.id, r.title)} />
          </TableSection>
        </>
      )}

      {/* Edit record modal */}
      {pendingEdit && (
        <EditRecordModal
          key={`${pendingEdit.model}-${pendingEdit.id}`}
          model={pendingEdit.model}
          label={pendingEdit.label}
          record={pendingEdit.record}
          busy={saving}
          error={saveError}
          onSave={submitEdit}
          onCancel={() => setPendingEdit(null)}
        />
      )}

      {/* Delete confirmation modal */}
      {pendingDelete && (
        <DeleteConfirmModal
          label={pendingDelete.label}
          extra={pendingDelete.extra}
          busy={deleting}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
};

/* ────────────────────── Presentational bits ────────────────── */

const PulsePill: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white/[0.07] backdrop-blur-xl border border-white/10 transition-colors hover:bg-white/[0.12]">
    <span className={`w-1.5 h-1.5 rounded-full ${color} animate-pulse`}></span>
    <span className="text-xs text-white/55">{label}</span>
    <span className="text-sm font-extrabold text-white tabular-nums">{value}</span>
  </div>
);

const ChartCard: React.FC<{ icon?: string; title: string; subtitle?: string; children: React.ReactNode }> = ({ icon, title, subtitle, children }) => (
  <div className="dash-panel dash-panel-body flex flex-col">
    <div className="flex items-start gap-2.5">
      {icon && <span aria-hidden="true" className="text-lg leading-none mt-0.5">{icon}</span>}
      <div className="min-w-0">
        <h3 className="dash-title !text-base">{title}</h3>
        {subtitle && <p className="dash-subtitle !mt-0.5 !text-xs">{subtitle}</p>}
      </div>
    </div>
    <div className="mt-5 flex-1">{children}</div>
  </div>
);

const MonthlyBarChart: React.FC<{ data: { month: string; count: number }[] }> = ({ data }) => {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex items-end gap-2 h-44">
      {data.map(d => (
        <div key={d.month} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full group">
          <span className="text-xs font-bold text-surface-700 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
            {d.count}
          </span>
          <div
            className="w-full max-w-[42px] rounded-lg bg-gradient-to-t from-primary-600 to-primary-400 shadow-sm shadow-primary-500/20 transition-all duration-300 group-hover:from-primary-700 group-hover:to-accent-400"
            style={{ height: `${Math.max((d.count / max) * 100, 3)}%` }}
            title={`${d.month}: ${d.count}`}
          ></div>
          <span className="text-[10px] font-medium text-surface-400 whitespace-nowrap">{d.month}</span>
        </div>
      ))}
    </div>
  );
};

const StatusBar: React.FC<{ label: string; count: number; total: number; color: string }> = ({ label, count, total, color }) => {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-medium text-surface-700">{label}</span>
        <span className="text-surface-400">{count} · {pct}%</span>
      </div>
      <div className="track !h-2">
        <div className={`track-fill ${color}`} style={{ width: `${pct}%` }}></div>
      </div>
    </div>
  );
};

const HBarList: React.FC<{ items: { label: string; count: number }[]; maxItems: number; color: string; emptyText: string }> = ({ items, maxItems, color, emptyText }) => {
  const shown = items.slice(0, maxItems);
  const max = Math.max(...shown.map(i => i.count), 1);
  if (shown.length === 0) return <p className="text-sm text-surface-400 py-6 text-center">{emptyText}</p>;
  return (
    <div className="space-y-3 pt-1">
      {shown.map(item => (
        <div key={item.label}>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-medium text-surface-700 truncate max-w-[70%]">{item.label}</span>
            <span className="text-surface-400">{item.count}</span>
          </div>
          <div className="track !h-2">
            <div className={`track-fill bg-gradient-to-r ${color}`} style={{ width: `${(item.count / max) * 100}%` }}></div>
          </div>
        </div>
      ))}
    </div>
  );
};

const SkillChip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="chip-tag">{children}</span>
);

/* Wraps a run of chips. Without this a cell holding more skills than fit on one
   line overlaps the line above, because a bare chip only carried a right margin. */
const ChipRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="chip-row">{children}</div>
);

const Badge: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${className}`}>{children}</span>
);

const TableSection: React.FC<{ title: string; count: number; query: string; children: React.ReactNode }> = ({ title, count, query, children }) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="dash-panel overflow-hidden">
      <div className="dash-panel-head-dense">
        <h2 className="dash-title !text-base flex items-center gap-2 min-w-0">
          <span className="truncate">{title}</span>
          <span className="text-surface-400 font-semibold tabular-nums shrink-0">({count})</span>
        </h2>
        <div className="flex items-center gap-3 shrink-0">
          {query && <span className="text-xs text-surface-400 hidden sm:inline">filtered by "{query}"</span>}
          <button
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={open ? 'Collapse section' : 'Expand section'}
            className="btn-icon text-surface-400 hover:text-surface-700"
          >
            <svg className={`w-4 h-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>
      {open && <div className="expand-in">{children}</div>}
    </div>
  );
};

const EmptyRow: React.FC<{ colSpan: number; label: string }> = ({ colSpan, label }) => (
  <tr>
    <td colSpan={colSpan} className="!px-5 py-12 text-center text-surface-400 text-sm">
      No {label} found.
    </td>
  </tr>
);

const DeleteConfirmModal: React.FC<{
  label: string;
  extra?: string;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ label, extra, busy, error, onConfirm, onCancel }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={busy ? undefined : onCancel}></div>
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-surface-900">Delete this record?</h3>
            <p className="text-sm text-surface-500 mt-1 break-words">
              <span className="font-medium text-surface-700">"{label}"</span> will be permanently deleted. This action cannot be undone.
            </p>
            {extra && <p className="text-xs text-red-500 mt-2">{extra}</p>}
            {error && <p className="text-xs text-red-600 mt-2 font-medium">{error}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-sm font-medium text-surface-600 hover:bg-surface-100 transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20 transition-colors disabled:opacity-60 inline-flex items-center gap-2"
          >
            {busy && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>}
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

const FieldInput: React.FC<{ field: EditField; value: string | boolean; onChange: (v: string | boolean) => void }> = ({ field, value, onChange }) => {
  const inputCls = "px-3 py-2 rounded-xl border border-surface-200 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 text-sm w-full";

  if (field.type === 'checkbox') {
    return (
      <label className={`flex items-center gap-2 ${field.fullWidth ? 'sm:col-span-2' : ''}`}>
        <input
          type="checkbox"
          checked={!!value}
          onChange={e => onChange(e.target.checked)}
          className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
        />
        <span className="text-sm font-medium text-surface-700">{field.label}</span>
      </label>
    );
  }

  return (
    <div className={field.fullWidth ? 'sm:col-span-2' : ''}>
      <label className="block text-xs font-semibold text-surface-500 mb-1">{field.label}</label>
      {field.type === 'select' && field.options ? (
        <select value={String(value)} onChange={e => onChange(e.target.value)} className={inputCls}>
          {field.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea value={String(value)} onChange={e => onChange(e.target.value)} rows={3} className={inputCls} />
      ) : field.type === 'number' ? (
        <input type="number" value={String(value)} onChange={e => onChange(e.target.value)} className={inputCls} />
      ) : (
        <input type="text" value={String(value)} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} className={inputCls} />
      )}
    </div>
  );
};

const EditRecordModal: React.FC<{
  model: string;
  label: string;
  record: Record<string, unknown>;
  busy: boolean;
  error: string | null;
  onSave: (fields: Record<string, unknown>) => void;
  onCancel: () => void;
}> = ({ model, label, record, busy, error, onSave, onCancel }) => {
  const schema = EDIT_SCHEMAS[model] ?? [];
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    const init: Record<string, string | boolean> = {};
    schema.forEach(f => {
      const raw = record[f.key];
      if (f.type === 'checkbox') init[f.key] = !!raw;
      else if (f.type === 'select' && f.options) init[f.key] = initialSelectValue(f.options, raw);
      else init[f.key] = raw == null ? '' : String(raw);
    });
    setForm(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, label]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  const set = (key: string, value: string | boolean) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);
    const payload: Record<string, unknown> = {};
    for (const f of schema) {
      const value = form[f.key];
      if (f.type === 'number') {
        if (value === '' || value == null) {
          setFieldError(`"${f.label}" must be a number.`);
          return;
        }
        const num = Number(value);
        if (Number.isNaN(num)) {
          setFieldError(`"${f.label}" must be a number.`);
          return;
        }
        payload[f.key] = num;
      } else if (f.required && String(value ?? '').trim() === '') {
        setFieldError(`"${f.label}" is required.`);
        return;
      } else {
        payload[f.key] = value ?? '';
      }
    }
    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={busy ? undefined : onCancel}></div>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-5">
          <div className="min-w-0">
            <h3 className="font-semibold text-surface-900 text-lg">Edit {MODEL_LABELS[model] ?? 'Record'}</h3>
            <p className="text-sm text-surface-500 mt-0.5 break-words">"{label}"</p>
          </div>
          <button
            onClick={onCancel}
            disabled={busy}
            className="text-surface-400 hover:text-surface-600 transition-colors p-1 shrink-0"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {schema.map(f => (
              <FieldInput key={f.key} field={f} value={form[f.key] ?? ''} onChange={v => set(f.key, v)} />
            ))}
          </div>
          {(fieldError || error) && (
            <p className="text-xs text-red-600 font-medium">{fieldError || error}</p>
          )}
          <div className="flex justify-end gap-2 pt-4 border-t border-surface-100">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="px-4 py-2 rounded-xl text-sm font-medium text-surface-600 hover:bg-surface-100 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-colors disabled:opacity-60 inline-flex items-center gap-2"
            >
              {busy && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>}
              {busy ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminDashboard;
