import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { notificationsAPI } from '../../api/client';

interface DropdownNotification {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

const Navbar: React.FC = () => {
  const { user, isAuthenticated, isStudent, isRecruiter, isAdmin, logout } = useAuth();
  const { unreadCount: notifCount, refreshUnreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<DropdownNotification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const closeMenus = useCallback(() => {
    setNotifOpen(false);
    setUserMenuOpen(false);
  }, []);

  // Close dropdowns when clicking outside of them.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notifRef.current &&
        !notifRef.current.contains(event.target as Node) &&
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        closeMenus();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeMenus]);

  // Close dropdowns on navigation.
  useEffect(() => {
    closeMenus();
    setMobileOpen(false);
  }, [location.pathname, closeMenus]);

  const handleLogout = () => {
    logout();
    closeMenus();
    navigate('/');
  };

  const fetchRecentNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const r = await notificationsAPI.recent();
      setNotifications(Array.isArray(r.data) ? r.data : (r.data?.results || []));
    } catch {
      /* transient errors are ignored */
    } finally {
      setNotifLoading(false);
    }
  }, []);

  const toggleNotifications = () => {
    const next = !notifOpen;
    setUserMenuOpen(false);
    setNotifOpen(next);
    // Always refetch on open so new notifications (WebSocket or other tabs)
    // show up instead of a stale cached list.
    if (next) {
      fetchRecentNotifications();
    }
  };

  const toggleUserMenu = () => {
    const next = !userMenuOpen;
    setNotifOpen(false);
    setUserMenuOpen(next);
  };

  const handleNotifClick = async (n: DropdownNotification) => {
    if (!n.is_read) {
      try {
        await notificationsAPI.markRead(n.id);
        setNotifications(prev =>
          prev.map(item => (item.id === n.id ? { ...item, is_read: true } : item))
        );
        refreshUnreadCount();
      } catch { /* ignore */ }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markRead();
      setNotifications(prev => prev.map(item => ({ ...item, is_read: true })));
      refreshUnreadCount();
    } catch { /* ignore */ }
  };

  const profilePath = isStudent
    ? '/student/profile'
    : isRecruiter
      ? '/recruiter/profile'
      : '/admin-portal';
  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'glass shadow-lg' : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 md:h-20 items-center">
          <Link to="/" className="flex items-center space-x-2 group">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/25 group-hover:shadow-primary-500/40 transition-all duration-300 group-hover:scale-105">
              <span className="text-white font-bold text-base">P</span>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">PortAL</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-1">
            <Link to="/jobs" className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
              isActive('/jobs') ? 'bg-primary-50 text-primary-600' : 'text-surface-600 hover:text-primary-600 hover:bg-surface-50'
            }`}>
              Jobs
            </Link>
            <Link to="/internships" className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
              isActive('/internships') ? 'bg-primary-50 text-primary-600' : 'text-surface-600 hover:text-primary-600 hover:bg-surface-50'
            }`}>
              Internships
            </Link>
            <Link to="/careers/paths" className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
              isActive('/careers') ? 'bg-primary-50 text-primary-600' : 'text-surface-600 hover:text-primary-600 hover:bg-surface-50'
            }`}>
              Career Paths
            </Link>

            {isAuthenticated ? (
              <div className="flex items-center space-x-2 ml-4 pl-4 border-l border-surface-200">
                <Link to="/network" className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                  isActive('/network') ? 'bg-primary-50 text-primary-600' : 'text-surface-600 hover:text-primary-600 hover:bg-surface-50'
                }`}>
                  Network
                </Link>
                <Link to="/feed" className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                  isActive('/feed') ? 'bg-primary-50 text-primary-600' : 'text-surface-600 hover:text-primary-600 hover:bg-surface-50'
                }`}>
                  Feed
                </Link>
                {isStudent && (
                  <Link to="/student/dashboard" className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                    isActive('/student') ? 'bg-primary-50 text-primary-600' : 'text-surface-600 hover:text-primary-600 hover:bg-surface-50'
                  }`}>
                    Dashboard
                  </Link>
                )}
                {isRecruiter && (
                  <Link to="/recruiter/dashboard" className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                    isActive('/recruiter') ? 'bg-primary-50 text-primary-600' : 'text-surface-600 hover:text-primary-600 hover:bg-surface-50'
                  }`}>
                    Dashboard
                  </Link>
                )}
                {isStudent && (
                  <Link to="/job-alerts" className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                    isActive('/job-alerts') ? 'bg-primary-50 text-primary-600' : 'text-surface-600 hover:text-primary-600 hover:bg-surface-50'
                  }`}>
                    Alerts
                  </Link>
                )}
                {isAdmin && (
                  <Link to="/admin-portal" className={`px-3 py-2 text-sm font-medium rounded-xl transition-all ${
                    isActive('/admin-portal') ? 'bg-purple-50 text-purple-700' : 'text-purple-600 hover:text-purple-700 hover:bg-purple-50'
                  }`}>
                    Admin
                  </Link>
                )}

                {/* Notification bell + dropdown */}
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={toggleNotifications}
                    className={`relative p-2.5 rounded-xl transition-all ${
                      notifOpen
                        ? 'bg-primary-50 text-primary-600'
                        : 'text-surface-500 hover:text-primary-600 hover:bg-surface-50'
                    }`}
                    aria-label="Notifications"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {notifCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-gradient-to-br from-red-500 to-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg animate-bounce-in">
                        {notifCount > 9 ? '9+' : notifCount}
                      </span>
                    )}
                  </button>

                  {notifOpen && (
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-surface-200 shadow-2xl shadow-primary-500/10 overflow-hidden animate-fade-in-down z-50">
                      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
                        <div>
                          <h3 className="text-sm font-bold text-surface-900">Notifications</h3>
                          <p className="text-xs text-surface-400">
                            {notifCount > 0
                              ? `${notifCount} unread`
                              : 'You\'re all caught up'}
                          </p>
                        </div>
                        {notifCount > 0 && (
                          <button
                            onClick={handleMarkAllRead}
                            className="text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>

                      <div className="max-h-80 overflow-y-auto">
                        {notifLoading ? (
                          <div className="flex items-center justify-center py-10">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                          </div>
                        ) : notifications.length === 0 ? (
                          <div className="text-center py-10 px-6">
                            <div className="w-12 h-12 bg-surface-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                              <svg className="w-6 h-6 text-surface-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                              </svg>
                            </div>
                            <p className="text-sm font-medium text-surface-700">No notifications yet</p>
                            <p className="text-xs text-surface-400 mt-1">Updates will appear here.</p>
                          </div>
                        ) : (
                          <ul className="divide-y divide-surface-50">
                            {notifications.map(n => (
                              <li key={n.id}>
                                <button
                                  onClick={() => handleNotifClick(n)}
                                  className={`w-full text-left px-5 py-3.5 transition-colors ${
                                    n.is_read ? 'bg-white hover:bg-surface-50' : 'bg-primary-50/60 hover:bg-primary-50'
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${n.is_read ? 'bg-transparent' : 'bg-primary-500'}`}></div>
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-sm font-semibold truncate ${n.is_read ? 'text-surface-600' : 'text-surface-900'}`}>
                                        {n.title}
                                      </p>
                                      {n.message && (
                                        <p className="text-xs text-surface-500 mt-0.5 line-clamp-2">{n.message}</p>
                                      )}
                                      <p className="text-[11px] text-surface-400 mt-1">{timeAgo(n.created_at)}</p>
                                    </div>
                                  </div>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <Link
                        to="/notifications"
                        className="block w-full text-center text-sm font-semibold text-primary-600 hover:text-primary-700 hover:bg-primary-50 py-3 border-t border-surface-100 transition-colors"
                      >
                        View all notifications
                      </Link>
                      <Link
                        to="/notifications/settings"
                        className="block w-full text-center text-xs font-medium text-surface-400 hover:text-primary-600 py-2.5 border-t border-surface-100 transition-colors"
                      >
                        Notification settings
                      </Link>
                    </div>
                  )}
                </div>

                {/* Avatar + profile menu */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={toggleUserMenu}
                    className={`flex items-center gap-2 pl-1 pr-2 py-1.5 rounded-xl transition-all ${
                      userMenuOpen ? 'bg-surface-100' : 'hover:bg-surface-100'
                    }`}
                    aria-label="Account menu"
                  >
                    <div className="w-9 h-9 bg-gradient-to-br from-primary-400 to-accent-500 rounded-full flex items-center justify-center shadow-md cursor-pointer transition-transform duration-200">
                      <span className="text-white font-bold text-sm">
                        {(user?.username || 'U')[0].toUpperCase()}
                      </span>
                    </div>
                    <svg className={`w-4 h-4 text-surface-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-white border border-surface-200 shadow-2xl shadow-primary-500/10 overflow-hidden animate-fade-in-down z-50">
                      <div className="px-5 py-4 border-b border-surface-100">
                        <p className="text-sm font-bold text-surface-900 truncate">
                          {user?.username || 'User'}
                        </p>
                        <p className="text-xs text-surface-400 truncate mt-0.5">{user?.email}</p>
                        <span className="inline-block mt-2 px-2 py-0.5 bg-primary-50 text-primary-700 rounded-full text-[11px] font-semibold capitalize">
                          {isAdmin ? 'Admin' : isStudent ? 'Student' : isRecruiter ? 'Recruiter' : 'Member'}
                        </span>
                      </div>
                      <div className="py-1.5">
                        <Link
                          to={profilePath}
                          className="flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-surface-700 hover:bg-surface-50 hover:text-primary-600 transition-colors"
                        >
                          <svg className="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          My Profile
                        </Link>
                        <Link
                          to={isStudent ? '/student/dashboard' : isRecruiter ? '/recruiter/dashboard' : '/admin-portal'}
                          className="flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-surface-700 hover:bg-surface-50 hover:text-primary-600 transition-colors"
                        >
                          <svg className="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                          </svg>
                          Dashboard
                        </Link>
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors text-left"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-3 ml-4 pl-4 border-l border-surface-200">
                <Link to="/login" className="text-sm font-medium text-surface-600 hover:text-primary-600 px-4 py-2 transition-colors">
                  Login
                </Link>
                <Link to="/register" className="btn-primary text-sm py-2 px-5 shadow-lg shadow-primary-500/20">
                  Get Started
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2.5 text-surface-500 hover:text-surface-700 hover:bg-surface-100 rounded-xl transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-5 animate-fade-in-down">
            <div className="flex flex-col space-y-1 bg-surface-50 rounded-2xl p-4">
              <MobileNavLink to="/jobs" label="Jobs" onClick={() => setMobileOpen(false)} />
              <MobileNavLink to="/internships" label="Internships" onClick={() => setMobileOpen(false)} />
              <MobileNavLink to="/careers/paths" label="Career Paths" onClick={() => setMobileOpen(false)} />

              {isAuthenticated ? (
                <>
                  <div className="divider-gradient my-2"></div>
                  <MobileNavLink to="/network" label="Network" onClick={() => setMobileOpen(false)} />
                  <MobileNavLink to="/feed" label="Feed" onClick={() => setMobileOpen(false)} />
                  <MobileNavLink to={isStudent ? '/student/dashboard' : isRecruiter ? '/recruiter/dashboard' : '/admin-portal'} label="Dashboard" onClick={() => setMobileOpen(false)} />
                  {isStudent && <MobileNavLink to="/job-alerts" label="Job Alerts" onClick={() => setMobileOpen(false)} />}
                  <MobileNavLink to={profilePath} label="My Profile" onClick={() => setMobileOpen(false)} />
                  <MobileNavLink to="/notifications" label={`Notifications${notifCount > 0 ? ` (${notifCount})` : ''}`} onClick={() => setMobileOpen(false)} />

                  <button onClick={() => { handleLogout(); setMobileOpen(false); }} className="px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 rounded-xl transition-all text-left">Logout</button>
                </>
              ) : (
                <>
                  <div className="divider-gradient my-2"></div>
                  <MobileNavLink to="/login" label="Login" onClick={() => setMobileOpen(false)} />
                  <MobileNavLink to="/register" label="Get Started" onClick={() => setMobileOpen(false)} />
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

const MobileNavLink: React.FC<{ to: string; label: string; onClick: () => void }> = ({ to, label, onClick }) => (
  <Link to={to} onClick={onClick} className="px-4 py-3 text-sm font-medium text-surface-600 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all">
    {label}
  </Link>
);

export default Navbar;
