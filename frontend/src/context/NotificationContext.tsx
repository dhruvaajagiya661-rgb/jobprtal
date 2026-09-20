import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { notificationsAPI } from '../api/client';
import { useAuth } from './AuthContext';
import { wsBaseUrl } from '../config/api';

interface IncomingNotification {
  title?: string;
  message?: string;
  created_at?: string;
}

interface NotificationContextType {
  unreadCount: number;
  lastNotification: IncomingNotification | null;
  /** Bumps every time a new notification arrives over the WebSocket, so pages
   *  like the notifications list can refresh themselves without polling. */
  version: number;
  refreshUnreadCount: () => Promise<void>;
  dismissToast: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

const POLL_INTERVAL_MS = 30_000;
const BASE_RECONNECT_DELAY_MS = 3_000;
const MAX_RECONNECT_ATTEMPTS = 6;

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastNotification, setLastNotification] =
    useState<IncomingNotification | null>(null);
  const [version, setVersion] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const toastTimerRef = useRef<number | null>(null);

  const refreshUnreadCount = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }
    try {
      const r = await notificationsAPI.unreadCount();
      setUnreadCount(r.data.unread_count ?? 0);
    } catch {
      /* transient errors are ignored; polling will retry */
    }
  }, [isAuthenticated]);

  // Live badge count: refresh on auth change + poll periodically as a
  // fallback so the bell stays accurate on every page, even if the
  // WebSocket is unavailable (e.g. server restart).
  useEffect(() => {
    refreshUnreadCount();
    if (!isAuthenticated) return;
    const interval = setInterval(refreshUnreadCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshUnreadCount, isAuthenticated]);

  const dismissToast = useCallback(() => {
    setLastNotification(null);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  // WebSocket connection: connect when authenticated, reconnect on drop,
  // and show a toast + refresh the badge when a new notification arrives.
  useEffect(() => {
    if (!isAuthenticated) {
      socketRef.current?.close();
      socketRef.current = null;
      return;
    }

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      const token = localStorage.getItem('access_token');
      if (!token) {
        socketRef.current = null;
        return;
      }

      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(
        `${wsBaseUrl() || `${proto}://${window.location.host}`}/ws/notifications/?token=${token}`
      );
      socketRef.current = ws;

      ws.onopen = () => {
        // Connected: reset the backoff counter so a future drop starts fresh.
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as IncomingNotification;
          setLastNotification(data);
          setVersion(v => v + 1);
          refreshUnreadCount();
        } catch {
          /* ignore malformed frames */
        }
      };

      ws.onclose = () => {
        if (socketRef.current === ws) socketRef.current = null;
        if (!cancelled && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          // Exponential backoff so a persistently failing connection (e.g.
          // expired token without logout) doesn't hammer the server forever.
          const delay =
            BASE_RECONNECT_DELAY_MS *
            2 ** Math.min(reconnectAttemptsRef.current, 5);
          reconnectAttemptsRef.current += 1;
          reconnectTimerRef.current = window.setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      cancelled = true;
      reconnectAttemptsRef.current = 0;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [isAuthenticated, refreshUnreadCount]);

  // Auto-dismiss toast after 6 seconds.
  useEffect(() => {
    if (lastNotification) {
      toastTimerRef.current = window.setTimeout(dismissToast, 6000);
    }
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, [lastNotification, dismissToast]);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        lastNotification,
        version,
        refreshUnreadCount,
        dismissToast,
      }}
    >
      {children}

      {/* Toast for real-time notifications */}
      {lastNotification && (
        <div className="toast-container">
          <div className="toast-info" role="alert">
            <div className="w-9 h-9 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-surface-900 truncate">
                  {lastNotification.title || 'New notification'}
                </p>
                <button
                  onClick={dismissToast}
                  className="text-surface-400 hover:text-surface-600 transition-colors flex-shrink-0"
                  aria-label="Dismiss"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {lastNotification.message && (
                <p className="text-sm text-surface-500 mt-0.5 line-clamp-2">
                  {lastNotification.message}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      'useNotifications must be used within a NotificationProvider'
    );
  }
  return context;
};
