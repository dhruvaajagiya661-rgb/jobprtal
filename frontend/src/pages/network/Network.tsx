import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { connectionsAPI } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { extractApiError } from '../../utils/errors';

interface Connection {
  id: number;
  from_user: number;
  from_user_email: string;
  from_user_username: string;
  to_user: number;
  to_user_email: string;
  to_user_username: string;
  status: string;
  message: string;
  created_at: string;
}

interface Suggestion {
  id: number;
  username: string;
  full_name: string;
  headline: string;
  is_student: boolean;
  is_recruiter: boolean;
}

type Tab = 'connections' | 'pending' | 'sent' | 'suggestions';

const TABS: { key: Tab; label: string }[] = [
  { key: 'connections', label: 'Connections' },
  { key: 'pending', label: 'Invitations' },
  { key: 'sent', label: 'Sent' },
  { key: 'suggestions', label: 'Suggestions' },
];

const Avatar: React.FC<{ name: string; to: string; size?: 'md' | 'lg' }> = ({
  name,
  to,
  size = 'md',
}) => (
  <Link
    to={to}
    className={`${
      size === 'lg' ? 'w-16 h-16 text-xl' : 'w-12 h-12'
    } rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white font-bold flex-shrink-0`}
  >
    {(name || '?')[0].toUpperCase()}
  </Link>
);

/** Recruiters get the recruiter-shaped profile (company, open roles, reviews);
 *  everyone else gets the general one. */
const profilePath = (person: { id: number; is_recruiter?: boolean }): string =>
  person.is_recruiter ? `/profile/recruiter/${person.id}` : `/profile/${person.id}`;

const EmptyState: React.FC<{ message: string; hint?: string }> = ({ message, hint }) => (
  <div className="col-span-full text-center py-16 bg-white rounded-xl border border-gray-100">
    <p className="text-gray-500">{message}</p>
    {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
  </div>
);

const Network: React.FC = () => {
  const { user: currentUser } = useAuth();
  const toast = useToast();

  const [connections, setConnections] = useState<Connection[]>([]);
  const [pending, setPending] = useState<Connection[]>([]);
  const [sent, setSent] = useState<Connection[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('connections');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Ids with a request in flight, so buttons disable instead of double-firing.
  const [busy, setBusy] = useState<Set<number>>(new Set());

  const withBusy = async (id: number, fn: () => Promise<void>) => {
    setBusy(prev => new Set(prev).add(id));
    try {
      await fn();
    } finally {
      setBusy(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const loadData = useCallback(async () => {
    setError('');
    try {
      const [connRes, pendingRes, sentRes, sugRes] = await Promise.all([
        connectionsAPI.list(),
        connectionsAPI.pending(),
        connectionsAPI.sent(),
        connectionsAPI.suggestions(),
      ]);
      const unwrap = (d: unknown) => Array.isArray(d) ? d : (d as Record<string, unknown>)?.results || [];
      setConnections(unwrap(connRes.data) as Connection[]);
      setPending(unwrap(pendingRes.data) as Connection[]);
      setSent(unwrap(sentRes.data) as Connection[]);
      setSuggestions(unwrap(sugRes.data) as Suggestion[]);
    } catch (err) {
      // Previously `catch { /* ignore */ }` — a failed load rendered as an
      // empty network with no indication anything had gone wrong.
      setError(extractApiError(err, 'Could not load your network. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAccept = (id: number) =>
    withBusy(id, async () => {
      try {
        await connectionsAPI.accept(id);
        toast.success('Invitation accepted');
        await loadData();
      } catch (err) {
        toast.error(extractApiError(err, 'Could not accept the invitation.'));
      }
    });

  const handleReject = (id: number) =>
    withBusy(id, async () => {
      try {
        await connectionsAPI.reject(id);
        await loadData();
      } catch (err) {
        toast.error(extractApiError(err, 'Could not ignore the invitation.'));
      }
    });

  const handleConnect = (userId: number) =>
    withBusy(userId, async () => {
      try {
        await connectionsAPI.sendRequest(userId);
        // Only drop the card once the server has actually accepted it. The old
        // code removed it optimistically, so a rejected request ("already
        // pending") looked like it had succeeded.
        setSuggestions(prev => prev.filter(s => s.id !== userId));
        toast.success('Invitation sent');
        const sentRes = await connectionsAPI.sent();
        setSent((Array.isArray(sentRes.data) ? sentRes.data : (sentRes.data?.results || [])) as Connection[]);
      } catch (err) {
        toast.error(extractApiError(err, 'Could not send the invitation.'));
      }
    });

  const handleRemove = (id: number) =>
    withBusy(id, async () => {
      if (!window.confirm('Remove this connection?')) return;
      try {
        await connectionsAPI.remove(id);
        await loadData();
      } catch (err) {
        toast.error(extractApiError(err, 'Could not remove the connection.'));
      }
    });

  const getOtherUser = (conn: Connection) =>
    conn.from_user === currentUser?.id
      ? { id: conn.to_user, email: conn.to_user_email, username: conn.to_user_username }
      : { id: conn.from_user, email: conn.from_user_email, username: conn.from_user_username };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const counts: Record<Tab, number> = {
    connections: connections.length,
    pending: pending.length,
    sent: sent.length,
    suggestions: suggestions.length,
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Network</h1>

      {error && (
        <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={loadData}
            className="text-sm font-semibold text-red-700 hover:text-red-900 flex-shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 border border-gray-100 text-center">
          <p className="text-3xl font-bold text-primary-600">{connections.length}</p>
          <p className="text-sm text-gray-500 mt-1">Connections</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 text-center">
          <p className="text-3xl font-bold text-amber-500">{pending.length}</p>
          <p className="text-sm text-gray-500 mt-1">Invitations</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 text-center">
          <p className="text-3xl font-bold text-sky-500">{sent.length}</p>
          <p className="text-sm text-gray-500 mt-1">Sent</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 text-center">
          <p className="text-3xl font-bold text-emerald-500">{suggestions.length}</p>
          <p className="text-sm text-gray-500 mt-1">Suggestions</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
            {counts[key] > 0 && <span className="ml-1 text-xs text-gray-400">({counts[key]})</span>}
          </button>
        ))}
      </div>

      {/* Connections */}
      {activeTab === 'connections' && (
        <div className="grid md:grid-cols-2 gap-4">
          {connections.length === 0 ? (
            <EmptyState
              message="No connections yet"
              hint="Send an invitation from the Suggestions tab to get started."
            />
          ) : (
            connections.map(conn => {
              const other = getOtherUser(conn);
              const name = other.username || other.email;
              return (
                <div
                  key={conn.id}
                  className="bg-white rounded-xl p-5 border border-gray-100 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={name} to={`/profile/${other.id}`} />
                    <div className="min-w-0">
                      <Link
                        to={`/profile/${other.id}`}
                        className="font-semibold text-gray-900 hover:text-primary-600 block truncate"
                      >
                        {name}
                      </Link>
                      <p className="text-xs text-gray-500 truncate">{other.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">

                    <button
                      onClick={() => handleRemove(conn.id)}
                      disabled={busy.has(conn.id)}
                      className="text-sm text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Received invitations */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {pending.length === 0 ? (
            <EmptyState message="No pending invitations" />
          ) : (
            pending.map(conn => {
              const other = getOtherUser(conn);
              const name = other.username || other.email;
              return (
                <div
                  key={conn.id}
                  className="bg-white rounded-xl p-5 border border-gray-100 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={name} to={`/profile/${other.id}`} />
                    <div className="min-w-0">
                      <Link
                        to={`/profile/${other.id}`}
                        className="font-semibold text-gray-900 hover:text-primary-600 block truncate"
                      >
                        {name}
                      </Link>
                      {conn.message && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">"{conn.message}"</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleReject(conn.id)}
                      disabled={busy.has(conn.id)}
                      className="text-sm text-gray-600 px-4 py-2 rounded-full border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Ignore
                    </button>
                    <button
                      onClick={() => handleAccept(conn.id)}
                      disabled={busy.has(conn.id)}
                      className="text-sm text-white px-4 py-2 rounded-full bg-primary-600 hover:bg-primary-700 font-semibold disabled:opacity-50"
                    >
                      Accept
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Invitations this user sent — the API already exposed these, but the
          page never showed them, so a sent request simply vanished. */}
      {activeTab === 'sent' && (
        <div className="space-y-4">
          {sent.length === 0 ? (
            <EmptyState
              message="No sent invitations"
              hint="Invitations you send stay here until they are accepted."
            />
          ) : (
            sent.map(conn => {
              const other = getOtherUser(conn);
              const name = other.username || other.email;
              return (
                <div
                  key={conn.id}
                  className="bg-white rounded-xl p-5 border border-gray-100 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={name} to={`/profile/${other.id}`} />
                    <div className="min-w-0">
                      <Link
                        to={`/profile/${other.id}`}
                        className="font-semibold text-gray-900 hover:text-primary-600 block truncate"
                      >
                        {name}
                      </Link>
                      <p className="text-xs text-gray-500">
                        Sent {new Date(conn.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full flex-shrink-0">
                    Pending
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Suggestions */}
      {activeTab === 'suggestions' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suggestions.length === 0 ? (
            <EmptyState message="No suggestions right now" />
          ) : (
            suggestions.map(s => {
              const name = s.full_name || s.username;
              return (
                <div key={s.id} className="bg-white rounded-xl p-5 border border-gray-100 text-center">
                  <div className="flex justify-center">
                    <Avatar name={name} to={profilePath(s)} size="lg" />
                  </div>
                  <Link
                    to={profilePath(s)}
                    className="block mt-3 font-semibold text-gray-900 hover:text-primary-600 truncate"
                  >
                    {name}
                  </Link>
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {s.headline || (s.is_student ? 'Student' : s.is_recruiter ? 'Recruiter' : 'Member')}
                  </p>
                  <button
                    onClick={() => handleConnect(s.id)}
                    disabled={busy.has(s.id)}
                    className="mt-4 w-full py-2 text-sm font-semibold text-primary-600 border border-primary-300 rounded-full hover:bg-primary-50 transition-colors disabled:opacity-50"
                  >
                    {busy.has(s.id) ? 'Sending…' : '+ Connect'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default Network;
