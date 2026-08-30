import React, { useState, useEffect, useRef, useCallback } from 'react';
import { notificationsAPI } from '../../api/client';
import { useNotifications } from '../../context/NotificationContext';
import { extractApiError } from '../../utils/errors';

interface Notification {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

const NotificationList: React.FC = () => {
  const { unreadCount, refreshUnreadCount, version } = useNotifications();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [error, setError] = useState('');

  // Bumped whenever a page-1 refresh starts, so an in-flight "load older"
  // result can be discarded if the list was refreshed underneath it.
  const refreshEpoch = useRef(0);

  // Merge page-1 data into the existing list: update fields on notifications
  // that are already shown (e.g. is_read toggling) and prepend any genuinely
  // new ones.  Preserves "Load older" progress across silent refreshes.
  const prependNewest = (prev: Notification[], incoming: Notification[]) => {
    const incomingById = new Map(incoming.map(n => [n.id, n]));
    // Replace existing entries with the fresh copy (carries updated is_read etc.)
    const merged = prev.map(n => incomingById.get(n.id) ?? n);
    // Prepend items that weren't in the previous list at all
    const existingIds = new Set(prev.map(n => n.id));
    const fresh = incoming.filter(n => !existingIds.has(n.id));
    return [...fresh, ...merged];
  };

  // Append older pages, skipping anything already shown but updating existing
  // entries in case their fields changed (e.g. is_read).
  const appendOlder = (prev: Notification[], incoming: Notification[]) => {
    const incomingById = new Map(incoming.map(n => [n.id, n]));
    const merged = prev.map(n => incomingById.get(n.id) ?? n);
    const existingIds = new Set(prev.map(n => n.id));
    const fresh = incoming.filter(n => !existingIds.has(n.id));
    return [...merged, ...fresh];
  };

  // Load the first page. `silent` keeps the existing list rendered (used for
  // refresh-on-new-notification and after mark-read) instead of flashing the
  // full-page spinner; loaded older pages are kept and merged by id.
  const loadFirstPage = useCallback(async (opts?: { silent?: boolean }) => {
    refreshEpoch.current += 1;
    const epoch = refreshEpoch.current;
    if (!opts?.silent) setInitialLoading(true);
    setError('');
    try {
      const r = await notificationsAPI.list();
      const data = r.data || {};
      if (refreshEpoch.current !== epoch) return; // superseded by a newer refresh
      setNotifications(prev => prependNewest(prev, data.results || []));
      // Keep pagination progress if the user already loaded older pages.
      setNextPage(prev => (data.next ? prev ?? 2 : null));
    } catch (err) {
      setError(extractApiError(err, 'Could not load notifications.'));
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => { loadFirstPage(); }, [loadFirstPage]);

  // New notification arrived over the WebSocket — refresh the list quietly.
  const prevVersion = useRef(version);
  useEffect(() => {
    if (version !== prevVersion.current) {
      prevVersion.current = version;
      loadFirstPage({ silent: true });
    }
  }, [version, loadFirstPage]);

  // Refresh when the tab regains focus so the list is never stale.
  useEffect(() => {
    const onFocus = () => loadFirstPage({ silent: true });
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadFirstPage]);

  const loadOlder = async () => {
    if (!nextPage || loadingMore) return;
    const page = nextPage;
    const epoch = refreshEpoch.current;
    setLoadingMore(true);
    setError('');
    try {
      const r = await notificationsAPI.list({ page });
      const data = r.data || {};
      // A page-1 refresh started while we were fetching — drop the stale page.
      if (refreshEpoch.current !== epoch) return;
      setNotifications(prev => appendOlder(prev, data.results || []));
      setNextPage(data.next ? page + 1 : null);
    } catch (err) {
      setError(extractApiError(err, 'Could not load more notifications.'));
    } finally {
      setLoadingMore(false);
    }
  };

  const handleMarkRead = async (id?: number) => {
    try {
      await notificationsAPI.markRead(id);
      await loadFirstPage({ silent: true });
      refreshUnreadCount();
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this notification?')) return;
    try {
      await notificationsAPI.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      refreshUnreadCount();
    } catch { /* ignore */ }
  };

  if (initialLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-500">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
              : "You're all caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={() => handleMarkRead()} className="btn-secondary text-sm py-2">
            Mark all as read
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 bg-red-50 text-red-600 text-sm p-4 rounded-xl border border-red-100">{error}</div>
      )}

      {notifications.length === 0 ? (
        <div className="text-center py-20">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900">No notifications</h3>
          <p className="text-gray-500 mt-1">New updates will appear here in real time.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {notifications.map(notif => (
              <div key={notif.id}
                className={`rounded-xl p-5 transition-all cursor-pointer ${
                  notif.is_read ? 'bg-white border border-gray-100' : 'bg-primary-50 border border-primary-100'
                }`}
                onClick={() => !notif.is_read && handleMarkRead(notif.id)}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-medium ${notif.is_read ? 'text-gray-700' : 'text-gray-900'}`}>{notif.title}</h3>
                      {!notif.is_read && <span className="w-2 h-2 bg-primary-500 rounded-full"></span>}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{notif.message}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    <span className="text-xs text-gray-400">
                      {new Date(notif.created_at).toLocaleDateString()}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDelete(notif.id); }}
                      title="Delete notification"
                      aria-label="Delete notification"
                      className="text-gray-300 hover:text-red-500 transition-colors p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {nextPage && (
            <div className="flex justify-center mt-6">
              <button
                onClick={loadOlder}
                disabled={loadingMore}
                className="btn-secondary text-sm"
              >
                {loadingMore ? 'Loading…' : 'Load older notifications'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default NotificationList;
