import axios from 'axios';

const API_BASE = '/api';

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: add JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Single-flight token refresh: concurrent 401s share one refresh call so they
// don't race and invalidate each other's rotated tokens.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) {
    throw new Error('No refresh token');
  }

  const response = await axios.post(`${API_BASE}/auth/token/refresh/`, {
    refresh: refreshToken,
  });

  const { access, refresh } = response.data;
  localStorage.setItem('access_token', access);
  // ROTATE_REFRESH_TOKENS is enabled: the server issues a new refresh token
  // and blacklists the old one, so we must store the rotated token.
  if (refresh) {
    localStorage.setItem('refresh_token', refresh);
  }
  return access;
}

// Decode the JWT `exp` claim (seconds since epoch) without a library.
// JWT payloads are base64url (uses '-'/'_' and may omit padding), so convert
// back to standard base64 before atob.
function getTokenExpiry(): number | null {
  const token = localStorage.getItem('access_token');
  if (!token) return null;
  try {
    let base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    // Re-add padding stripped by base64url so atob never throws, which would
    // otherwise make us refresh on every request (throttle churn).
    base64 += '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(base64));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

// Proactively refresh before the access token actually expires so requests
// never hit a 401 mid-session. `force` bypasses the "still valid" early return
// (used by the response interceptor after a real 401).
let refreshing = false;

export async function refreshTokenIfNeeded(force = false): Promise<string | null> {
  const expiry = getTokenExpiry();
  if (!force && expiry && expiry - Date.now() > 60_000) {
    return localStorage.getItem('access_token');
  }
  if (!refreshing) {
    refreshing = true;
    refreshPromise = refreshAccessToken().finally(() => {
      refreshing = false;
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// Request interceptor: add JWT token, refreshing it first if it's about to expire
apiClient.interceptors.request.use(
  async (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      try {
        const fresh = await refreshTokenIfNeeded();
        config.headers.Authorization = `Bearer ${fresh ?? token}`;
      } catch {
        // Refresh failed; still send the request so the response interceptor
        // can handle the 401 (which will redirect to login if truly expired).
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && error.config && !originalRequest._retry) {
      originalRequest._retry = true;

      // No session ever existed (anonymous visitor hit an auth-only endpoint,
      // e.g. recording a practice attempt while logged out): don't attempt a
      // refresh and never redirect to /login — just let the caller's .catch()
      // handle it quietly.
      if (!localStorage.getItem('refresh_token')) {
        return Promise.reject(error);
      }

      try {
        // Use the same single-flight helper so concurrent 401s share one
        // refresh instead of racing and blacklisting each other's tokens.
        const access = await refreshTokenIfNeeded(true);
        originalRequest.headers.Authorization = `Bearer ${access}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (email: string, password: string) =>
    apiClient.post('/auth/login/', { email, password }),

  register: (data: {
    email: string;
    password: string;
    username?: string;
    role: 'student' | 'recruiter';
    company_name?: string;
    designation?: string;
  }) => apiClient.post('/auth/register/', data),

  me: () => apiClient.get('/auth/me/'),

  logout: (refresh: string) =>
    apiClient.post('/auth/logout/', { refresh }),

  refresh: (refresh: string) =>
    apiClient.post('/auth/token/refresh/', { refresh }),
};

// Jobs API
export const jobsAPI = {
  list: (params?: Record<string, string>) =>
    apiClient.get('/v1/jobs/', { params }),
  detail: (id: number) => apiClient.get(`/v1/jobs/${id}/`),
  featured: () => apiClient.get('/v1/jobs/featured/'),
};

// Skills API (used by the student profile editor)
export const skillsAPI = {
  list: () => apiClient.get('/v1/skills/'),
};

// Internships API
export const internshipsAPI = {
  list: (params?: Record<string, string>) =>
    apiClient.get('/v1/internships/', { params }),
  detail: (id: number) => apiClient.get(`/v1/internships/${id}/`),
  featured: () => apiClient.get('/v1/internships/featured/'),
};

// Applications API
export const applicationsAPI = {
  apply: (data: FormData) =>
    apiClient.post('/v1/applications/apply/', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  myApplications: () => apiClient.get('/v1/applications/my_applications/'),
  withdraw: (applicationId: number) =>
    apiClient.delete('/v1/applications/withdraw/', {
      data: { application_id: applicationId },
    }),
  board: () => apiClient.get('/v1/applications/board/'),
  bulkUpdateStatus: (applicationIds: number[], status: string) =>
    apiClient.post('/v1/applications/bulk_update_status/', {
      application_ids: applicationIds,
      status,
    }),
};

// Student API
export const studentAPI = {
  dashboard: () => apiClient.get('/v1/students/dashboard/'),
  profile: () => apiClient.get('/v1/students/me/'),
  updateProfile: (data: FormData) =>
    apiClient.patch('/v1/students/me/', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  // JSON patch for quick profile edits (skills, links, resume, projects)
  updateProfileJson: (data: Record<string, unknown>) =>
    apiClient.patch('/v1/students/me/', data),
  applications: () => apiClient.get('/v1/students/applications/'),
  savedJobs: () => apiClient.get('/v1/students/saved_jobs/'),
  saveJob: (jobId: number) =>
    apiClient.post('/v1/students/save_job/', { job_id: jobId }),
  unsaveJob: (jobId: number) =>
    apiClient.post('/v1/students/unsave_job/', { job_id: jobId }),

  // Resume intelligence. parseResume is read-only — it returns what it found;
  // nothing is written to the profile until applyParsedSkills confirms it.
  // Omit `file` to re-analyse the resume already stored on the profile.
  parseResume: (file?: File) => {
    const data = new FormData();
    if (file) data.append('resume', file);
    return apiClient.post('/v1/students/parse_resume/', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  applyParsedSkills: (skillIds: number[]) =>
    apiClient.post('/v1/students/apply_parsed_skills/', { skill_ids: skillIds }),
};

// Recruiter API
export const recruiterAPI = {
  dashboard: () => apiClient.get('/v1/recruiters/dashboard/'),
  profile: () => apiClient.get('/v1/recruiters/me/'),
  company: () => apiClient.get('/v1/recruiters/company/'),
  updateCompany: (data: FormData) =>
    apiClient.patch('/v1/recruiters/company/', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  jobs: () => apiClient.get('/v1/recruiters/jobs/'),
  internships: () => apiClient.get('/v1/recruiters/internships/'),
  createJob: (data: Record<string, unknown>) =>
    apiClient.post('/v1/recruiters/create_job/', data),
  updateJob: (data: Record<string, unknown>) =>
    apiClient.patch('/v1/recruiters/update_job/', data),
  deleteJob: (jobId: number) =>
    apiClient.delete('/v1/recruiters/delete_job/', { data: { job_id: jobId } }),
  // Owner-scoped detail reads. The public /jobs/:id/ and /internships/:id/
  // endpoints only serve active postings, so a closed one cannot be read back
  // for editing or duplication — these are scoped by ownership instead.
  jobDetail: (jobId: number) =>
    apiClient.get('/v1/recruiters/job_detail/', { params: { job_id: jobId } }),
  internshipDetail: (internshipId: number) =>
    apiClient.get('/v1/recruiters/internship_detail/', {
      params: { internship_id: internshipId },
    }),
  createInternship: (data: Record<string, unknown>) =>
    apiClient.post('/v1/recruiters/create_internship/', data),
  updateInternship: (data: Record<string, unknown>) =>
    apiClient.patch('/v1/recruiters/update_internship/', data),
  deleteInternship: (internshipId: number) =>
    apiClient.delete('/v1/recruiters/delete_internship/', {
      data: { internship_id: internshipId },
    }),
  analytics: () => apiClient.get('/v1/recruiters/analytics/'),
  // Talent pool
  savedCandidates: () => apiClient.get('/v1/recruiters/saved_candidates/'),
  saveCandidate: (studentId: number, notes?: string) =>
    apiClient.post('/v1/recruiters/save_candidate/', {
      student_id: studentId,
      ...(notes !== undefined ? { notes } : {}),
    }),
  unsaveCandidate: (studentId: number) =>
    apiClient.delete('/v1/recruiters/unsave_candidate/', {
      data: { student_id: studentId },
    }),
  applicants: (params?: {
    job_id?: number;
    internship_id?: number;
    search?: string;
    skill?: string;
    status?: string;
  }) => apiClient.get('/v1/recruiters/applicants/', { params }),
  updateApplicationStatus: (applicationId: number, status: string) =>
    apiClient.post('/v1/recruiters/update_application_status/', {
      application_id: applicationId,
      status,
    }),
};

// Notifications API
export const notificationsAPI = {
  list: (params?: Record<string, string | number>) =>
    apiClient.get('/v1/notifications/list_notifications/', { params }),
  unreadCount: () => apiClient.get('/v1/notifications/unread_count/'),
  markRead: (notificationId?: number) =>
    apiClient.post('/v1/notifications/mark_read/', {
      notification_id: notificationId,
    }),
  recent: () => apiClient.get('/v1/notifications/recent/'),
  deleteNotification: (id: number) =>
    apiClient.delete('/v1/notifications/delete_notification/', {
      data: { notification_id: id },
    }),
};

// Admin API (superuser only)
export const adminAPI = {
  dashboard: (params?: Record<string, string>) =>
    apiClient.get('/v1/admin/dashboard/', { params }),
  deleteItem: (model: string, id: number) =>
    apiClient.delete('/v1/admin/delete/', { data: { model, id } }),
  updateItem: (model: string, id: number, fields: Record<string, unknown>) =>
    apiClient.patch('/v1/admin/update/', { model, id, fields }),
};

// Chat API
export const chatAPI = {
  conversations: () => apiClient.get('/v1/messages/conversations/'),
  chatWith: (userId: number) =>
    apiClient.get('/v1/messages/chat_with/', { params: { user_id: userId } }),
  send: (receiverId: number, content: string) =>
    apiClient.post('/v1/messages/send/', { receiver: receiverId, content }),
  unreadCount: () => apiClient.get('/v1/messages/unread_count/'),
  deleteMessage: (messageId: number) =>
    apiClient.delete('/v1/messages/delete_message/', {
      data: { message_id: messageId },
    }),
};

// Careers API
export const careersAPI = {
  paths: () => apiClient.get('/v1/career-paths/'),
  pathDetail: (id: number) => apiClient.get(`/v1/career-paths/${id}/`),
  recommended: () => apiClient.get('/v1/career-paths/recommended/'),
  interviewHub: () => apiClient.get('/v1/interview-prep/hub/'),
  interviewBySkill: (skillId: number, difficulty?: string) =>
    apiClient.get('/v1/interview-prep/by_skill/', {
      params: { skill_id: skillId, difficulty },
    }),
  interviewByPath: (pathId: number, difficulty?: string) =>
    apiClient.get('/v1/interview-prep/by_path/', {
      params: { path_id: pathId, difficulty },
    }),
  practice: (skillIds?: number[], count?: number, difficulty?: string) =>
    apiClient.get('/v1/interview-prep/practice/', {
      params: { skill_ids: skillIds, count, difficulty },
    }),
  quiz: (skillIds: number[], count?: number, difficulty?: string) =>
    apiClient.get('/v1/interview-prep/quiz/', {
      params: { skill_ids: skillIds, count, difficulty },
    }),
  mock: (skillIds: number[], count?: number) =>
    apiClient.get('/v1/interview-prep/mock/', {
      params: { skill_ids: skillIds, count },
    }),
  search: (q: string) =>
    apiClient.get('/v1/interview-prep/search/', { params: { q } }),
  recordAttempt: (questionId: number, correct: boolean, mode?: string) =>
    apiClient.post('/v1/interview-prep/record_attempt/', {
      question_id: questionId,
      correct,
      mode: mode || 'practice',
    }),
  progress: () => apiClient.get('/v1/interview-prep/progress/'),
  bookmark: (questionId: number) =>
    apiClient.post('/v1/interview-prep/bookmark/', { question_id: questionId }),
  bookmarks: () => apiClient.get('/v1/interview-prep/bookmarks/'),
  skillGap: () => apiClient.get('/v1/skill-gap/analyze/'),
  roadmap: () => apiClient.get('/v1/skill-gap/roadmap/'),
  setSkillStatus: (skillName: string, status: string) =>
    apiClient.post('/v1/skill-gap/set_status/', {
      skill_name: skillName,
      status,
    }),
  learningPath: (skillName: string) =>
    apiClient.get('/v1/skill-gap/learning_path/', {
      params: { skill_name: skillName },
    }),
};

// Feed / Posts API
export const feedAPI = {
  list: (params?: Record<string, string>) =>
    apiClient.get('/v1/feed/', { params }),
  retrieve: (id: number) => apiClient.get(`/v1/feed/${id}/`),
  create: (data: Record<string, unknown>) =>
    apiClient.post('/v1/feed/', data),
  delete: (id: number) => apiClient.delete(`/v1/feed/${id}/`),
  like: (id: number, reaction?: string) =>
    apiClient.post(`/v1/feed/${id}/like/`, { reaction: reaction || 'like' }),
  comment: (id: number, content: string, parentId?: number) =>
    apiClient.post(`/v1/feed/${id}/comment/`, { content, parent: parentId }),
  toggleSave: (id: number) => apiClient.post(`/v1/feed/${id}/toggle_save/`),
  trending: () => apiClient.get('/v1/feed/trending/'),
  myPosts: () => apiClient.get('/v1/feed/my_posts/'),
  saved: () => apiClient.get('/v1/feed/saved/'),
};

// Connections / Network API
export const connectionsAPI = {
  list: () => apiClient.get('/v1/connections/list_connections/'),
  pending: () => apiClient.get('/v1/connections/pending/'),
  sent: () => apiClient.get('/v1/connections/sent/'),
  sendRequest: (toUserId: number, message?: string) =>
    apiClient.post('/v1/connections/send_request/', { to_user_id: toUserId, message }),
  accept: (id: number) => apiClient.post(`/v1/connections/${id}/accept/`),
  reject: (id: number) => apiClient.post(`/v1/connections/${id}/reject/`),
  remove: (id: number) => apiClient.delete(`/v1/connections/${id}/remove/`),
  suggestions: () => apiClient.get('/v1/connections/suggestions/'),
};

// Endorsements API
export const endorsementsAPI = {
  endorse: (endorseeId: number, skillId: number) =>
    apiClient.post('/v1/endorsements/endorse/', { endorsee_id: endorseeId, skill_id: skillId }),
  userEndorsements: (userId?: number) =>
    apiClient.get('/v1/endorsements/user_endorsements/', { params: { user_id: userId } }),
};

// Recommendations API
export const recommendationsAPI = {
  request: (recommendeeId: number, relationship?: string) =>
    apiClient.post('/v1/recommendations/request_recommendation/', { recommendee_id: recommendeeId, relationship }),
  give: (recommendeeId: number, relationship: string, content: string) =>
    apiClient.post('/v1/recommendations/give/', { recommendee_id: recommendeeId, relationship, content }),
  userRecommendations: (userId?: number) =>
    apiClient.get('/v1/recommendations/user_recommendations/', { params: { user_id: userId } }),
};

// Profile views API
export const profileViewsAPI = {
  views: (userId: number) => apiClient.get(`/v1/profile-views/views/${userId}/`),
  recordView: (viewedId: number) =>
    apiClient.post('/v1/profile-views/record_view/', { viewed_id: viewedId }),
};

// Public profile API — safe, read-only view of ANY user by id (students and
// recruiters alike). Deliberately excludes email, resume and other private
// fields; see network.api.public_profile_payload.
export const publicProfileAPI = {
  get: (userId: number) => apiClient.get(`/v1/public-profiles/${userId}/`),
};

// Public recruiter profile — no auth required, so signed-out visitors
// following a recruiter's name from a job listing land on a real page.
export const publicRecruiterAPI = {
  get: (recruiterId: number) => apiClient.get(`/v1/recruiters/public/${recruiterId}/`),
};

// Follow API
export const followAPI = {
  toggle: (followedId: number) =>
    apiClient.post('/v1/follows/toggle/', { followed_id: followedId }),
};

// Courses / Learning API
export const coursesAPI = {
  list: (params?: Record<string, string>) =>
    apiClient.get('/v1/courses/', { params }),
  retrieve: (id: number) => apiClient.get(`/v1/courses/${id}/`),
  enroll: (id: number) => apiClient.post(`/v1/courses/${id}/enroll/`),
  unenroll: (id: number) => apiClient.post(`/v1/courses/${id}/unenroll/`),
  myCourses: () => apiClient.get('/v1/courses/my_courses/'),
  completeLesson: (courseId: number, lessonId: number) =>
    apiClient.post(`/v1/courses/${courseId}/complete_lesson/`, { lesson_id: lessonId }),
  progress: () => apiClient.get('/v1/courses/progress/'),
};

// Company Pages API
export const companyPagesAPI = {
  list: (params?: Record<string, string>) =>
    apiClient.get('/v1/company-pages/', { params }),
  retrieve: (id: number) => apiClient.get(`/v1/company-pages/${id}/`),
  follow: (id: number) => apiClient.post(`/v1/company-pages/${id}/follow/`),
  review: (id: number, data: Record<string, unknown>) =>
    apiClient.post(`/v1/company-pages/${id}/review/`, data),
  reviews: (id: number) => apiClient.get(`/v1/company-pages/${id}/reviews/`),
};

// Job Alerts API
export const jobAlertsAPI = {
  list: () => apiClient.get('/v1/job-alerts/'),
  create: (data: Record<string, unknown>) =>
    apiClient.post('/v1/job-alerts/', data),
  delete: (id: number) => apiClient.delete(`/v1/job-alerts/${id}/`),
  toggle: (id: number) => apiClient.post(`/v1/job-alerts/${id}/toggle/`),
};

// Public site API: home page counters and the contact form. Neither needs auth.
export interface PlatformStats {
  jobs: number;
  internships: number;
  companies: number;
  students: number;
  recruiters: number;
  categories: { id: number; name: string; count: number }[];
  generated_at: string;
}

export const platformAPI = {
  stats: () => apiClient.get<PlatformStats>('/v1/platform/stats/'),
  contact: (data: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }) => apiClient.post<{ detail: string }>('/v1/platform/contact/', data),
};

export default apiClient;
