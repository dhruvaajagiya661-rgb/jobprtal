import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { chatAPI, publicProfileAPI, refreshTokenIfNeeded } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { extractApiError } from '../../utils/errors';
import { useToast } from '../../context/ToastContext';

interface Conversation {
  partner_id: number;
  partner_name: string;
  partner_email: string;
  last_message: string;
  last_timestamp: string | null;
  unread_count: number;
}

interface ChatMessage {
  id: number;
  sender: number;
  sender_name: string;
  receiver: number;
  receiver_name: string;
  content: string;
  timestamp: string;
  is_read: boolean;
}

// REST and WebSocket messages both arrive as ISO-8601 (e.g.
// "2026-08-09T14:35:22.123Z"); the naive "YYYY-MM-DD HH:MM:SS" branch is
// only kept as a fallback for older records.
function parseTimestamp(ts: string): Date {
  if (ts.includes('T')) return new Date(ts);
  const [datePart, timePart] = ts.split(' ');
  if (!timePart) return new Date(datePart);
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm, ss] = timePart.split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, ss || 0);
}

function formatClock(ts: string): string {
  const d = parseTimestamp(ts);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDay(ts: string): string {
  const d = parseTimestamp(ts);
  if (isNaN(d.getTime())) return '';
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Label for a thread whose name may not have resolved yet (fresh deep link). */
function partnerLabel(c: { partner_name: string; partner_id: number }): string {
  return c.partner_name || `User #${c.partner_id}`;
}

const Spinner: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-spin rounded-full border-b-2 border-primary-600 ${className}`}></div>
);

const Chat: React.FC = () => {
  const toast = useToast();
  const { userId: userIdParam } = useParams<{ userId?: string }>();
  const location = useLocation();
  const { user } = useAuth();

  // Callers can open a thread with the message box already filled in — the
  // recruiter's applicants list does this so the student gets the context of
  // which application is being discussed. It's a draft, not a sent message.
  const prefill =
    (location.state as { prefill?: string } | null)?.prefill?.trim() || '';

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convsLoading, setConvsLoading] = useState(true);
  const [active, setActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [socketState, setSocketState] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load the conversation list once.
  useEffect(() => {
    let cancelled = false;
    chatAPI
      .conversations()
      .then(r => { if (!cancelled) setConversations(r.data || []); })
      .catch(err => { if (!cancelled) setError(extractApiError(err, 'Could not load conversations.')); })
      .finally(() => { if (!cancelled) setConvsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const openConversation = useCallback(async (conv: Conversation) => {
    setActive(conv);
    setMessages([]);
    setMsgsLoading(true);
    setError('');
    try {
      // chat_with() also marks the partner's messages as read server-side.
      const r = await chatAPI.chatWith(conv.partner_id);
      setMessages((r.data || []) as ChatMessage[]);
      setConversations(prev =>
        prev.map(c => (c.partner_id === conv.partner_id ? { ...c, unread_count: 0 } : c))
      );
    } catch (err) {
      setError(extractApiError(err, 'Could not load messages.'));
    } finally {
      setMsgsLoading(false);
    }
  }, []);

  // Deep link: /chat/:userId opens (or creates) a thread for that partner.
  useEffect(() => {
    if (!userIdParam) return;
    const pid = Number(userIdParam);
    if (!pid || pid === user?.id) return;
    const existing = conversations.find(c => c.partner_id === pid);
    if (active?.partner_id === pid) return;
    if (existing) {
      openConversation(existing);
      return;
    }
    // No prior thread — open it anyway; chat_with returns [] for strangers.
    // The header used to read "User #42" because nothing resolved the name;
    // fetch the public profile so a first-time thread is properly labelled.
    let cancelled = false;
    const stub: Conversation = {
      partner_id: pid,
      partner_name: '',
      partner_email: '',
      last_message: '',
      last_timestamp: null,
      unread_count: 0,
    };
    openConversation(stub);
    publicProfileAPI
      .get(pid)
      .then(r => {
        if (cancelled) return;
        const name = r.data?.full_name || r.data?.username;
        if (!name) return;
        setActive(prev => (prev && prev.partner_id === pid ? { ...prev, partner_name: name } : prev));
      })
      .catch(() => { /* header falls back to the id */ });
    return () => { cancelled = true; };
  }, [userIdParam, conversations, user?.id, active?.partner_id, openConversation]);

  // Real-time WebSocket for the active thread (JWT via ?token=, per ws_auth).
  useEffect(() => {
    if (!user || !active) return;
    let disposed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    const room = `${Math.min(user.id, active.partner_id)}_${Math.max(user.id, active.partner_id)}`;
    const wsBase = window.location.protocol === 'https:' ? 'wss' : 'ws';

    let attempts = 0;
    const connect = async () => {
      if (disposed) return;
      try {
        let token = localStorage.getItem('access_token') || '';
        try {
          const fresh = await refreshTokenIfNeeded();
          if (fresh) token = fresh;
        } catch { /* fall through with the stored token */ }
        const s = new WebSocket(
          `${wsBase}://${window.location.host}/ws/chat/${room}/?token=${encodeURIComponent(token)}`
        );
        socket = s;
        setSocketState('connecting');
        s.onopen = () => { if (!disposed) { attempts = 0; setSocketState('connected'); } };
        s.onclose = () => {
          if (disposed) return;
          setSocketState('disconnected');
          // Reconnect with exponential backoff (fresh token each attempt),
          // giving up after a few consecutive failures so an expired session
          // doesn't spin forever.
          attempts += 1;
          if (attempts < 6 && reconnectTimer === null) {
            const delay = Math.min(3000 * Math.pow(2, attempts - 1), 30000);
            reconnectTimer = window.setTimeout(connect, delay);
          }
        };
        s.onerror = () => s.close();
        s.onmessage = (e) => {
          const data = JSON.parse(e.data);
          // A message was deleted (by either participant) — drop it from the view.
          if (data.deleted_message_id != null) {
            setMessages(prev => prev.filter(m => m.id !== data.deleted_message_id));
            return;
          }
          if (data.message_id == null) return;
          const mine = data.sender_email === user.email;
          const msg: ChatMessage = {
            id: data.message_id,
            sender: mine ? user.id : active.partner_id,
            sender_name: mine ? user.username : partnerLabel(active),
            receiver: mine ? active.partner_id : user.id,
            receiver_name: mine ? partnerLabel(active) : user.username,
            content: data.message,
            timestamp: data.timestamp,
            // WS payloads carry no read state; REST refetches do. Default to
            // unread so the ✓ indicator is only shown from server truth.
            is_read: false,
          };
          setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
          if (!mine) {
            // Mark incoming messages as read server-side.
            chatAPI.chatWith(active.partner_id).catch(() => {});
          }
        };
      } catch {
        // Socket setup failed (e.g. token refresh error) — retry with backoff.
        if (!disposed) {
          attempts += 1;
          if (attempts < 6 && reconnectTimer === null) {
            const delay = Math.min(3000 * Math.pow(2, attempts - 1), 30000);
            reconnectTimer = window.setTimeout(connect, delay);
          }
        }
      }
    };

    connect();
    return () => {
      disposed = true;
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      if (socket) socket.close();
    };
  }, [user, active]);

  // Seed the composer from navigation state. Guarded on `input` being empty so
  // it can't wipe out text the user has already started typing.
  useEffect(() => {
    if (!prefill || !userIdParam) return;
    setInput(prev => (prev ? prev : prefill));
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill, userIdParam]);

  // Keep the newest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, msgsLoading]);

  const filtered = conversations.filter(c =>
    partnerLabel(c).toLowerCase().includes(search.toLowerCase()) ||
    c.partner_email.toLowerCase().includes(search.toLowerCase())
  );

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || !active || sending) return;
    setSending(true);
    setError('');
    try {
      const r = await chatAPI.send(active.partner_id, text);
      const msg = r.data as ChatMessage;
      setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
      // A brand-new thread has no row in the sidebar yet — map() alone left it
      // missing until a full reload. Upsert, and float the thread to the top
      // to match the server's newest-first ordering.
      setConversations(prev => {
        const stamp = new Date().toISOString();
        const known = prev.some(c => c.partner_id === active.partner_id);
        const updated = known
          ? prev.map(c =>
              c.partner_id === active.partner_id
                ? { ...c, last_message: text, last_timestamp: stamp, unread_count: 0 }
                : c
            )
          : [...prev, { ...active, last_message: text, last_timestamp: stamp, unread_count: 0 }];
        return updated.sort(
          (a, b) => (b.last_timestamp || '').localeCompare(a.last_timestamp || '')
        );
      });
      setInput('');
      inputRef.current?.focus();
    } catch (err) {
      setError(extractApiError(err, 'Failed to send message.'));
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this message?')) return;
    setDeletingId(id);
    setError('');
    try {
      await chatAPI.deleteMessage(id);
      setMessages(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      toast.error(extractApiError(err, 'Failed to delete message.'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        <p className="text-gray-500">Chat with students and recruiters in real time</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col sm:flex-row h-[calc(100vh-10rem)] min-h-[480px]">
        {/* ---------- Conversation list ---------- */}
        <aside className={`w-full sm:w-72 lg:w-80 border-r border-gray-100 flex flex-col ${active ? 'hidden sm:flex' : 'flex'}`}>
          <div className="p-4 border-b border-gray-100">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search conversations…"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {convsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner className="h-7 w-7" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-14 px-6">
                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-700">
                  {conversations.length === 0 ? 'No conversations yet' : 'No matches found'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {conversations.length === 0
                    ? 'Messages with recruiters and students will appear here.'
                    : 'Try a different name or email.'}
                </p>
              </div>
            ) : (
              filtered.map(c => (
                <button
                  key={c.partner_id}
                  onClick={() => openConversation(c)}
                  className={`w-full text-left px-4 py-3.5 border-b border-gray-50 transition-colors ${
                    active?.partner_id === c.partner_id ? 'bg-primary-50/70' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-semibold text-sm">
                        {partnerLabel(c)[0]?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-gray-900 truncate">{partnerLabel(c)}</span>
                        {c.last_timestamp && (
                          <span className="text-[11px] text-gray-400 flex-shrink-0">{formatClock(c.last_timestamp)}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="text-xs text-gray-500 truncate">{c.last_message || 'No messages yet'}</span>
                        {c.unread_count > 0 && (
                          <span className="w-5 h-5 bg-primary-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
                            {c.unread_count > 9 ? '9+' : c.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* ---------- Message thread ---------- */}
        <section className={`flex-1 flex flex-col min-w-0 ${active ? 'flex' : 'hidden sm:flex'}`}>
          {!active ? (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
              <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900">Your messages</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-xs">
                Select a conversation to start chatting. Recruiters can message applicants straight from the applicants list.
              </p>
            </div>
          ) : (
            <>
              <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                <button
                  onClick={() => setActive(null)}
                  className="sm:hidden p-2 -ml-1 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50"
                  aria-label="Back to conversations"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-semibold text-sm">{partnerLabel(active)[0]?.toUpperCase() || '?'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-semibold text-gray-900 truncate">{partnerLabel(active)}</h2>
                  <p className="text-xs text-gray-400 truncate">{active.partner_email || 'Direct message'}</p>
                </div>
                <span className={`flex items-center gap-1.5 text-xs font-medium ${socketState === 'connected' ? 'text-emerald-600' : 'text-gray-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${socketState === 'connected' ? 'bg-emerald-500' : socketState === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-gray-300'}`}></span>
                  {socketState === 'connected' ? 'Connected' : socketState === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
                </span>
              </header>

              <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-gray-50/50">
                {msgsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Spinner className="h-7 w-7" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-sm text-gray-400">No messages yet — say hello 👋</p>
                  </div>
                ) : (
                  messages.map((m, i) => {
                    const mine = m.sender === user?.id;
                    const prev = messages[i - 1];
                    const showDay = !prev || formatDay(prev.timestamp) !== formatDay(m.timestamp);
                    return (
                      <React.Fragment key={m.id}>
                        {showDay && (
                          <div className="flex justify-center py-2">
                            <span className="px-3 py-1 bg-white text-[11px] font-medium text-gray-400 rounded-full border border-gray-100">
                              {formatDay(m.timestamp)}
                            </span>
                          </div>
                        )}
                        <div className={`flex ${mine ? 'justify-end' : 'justify-start'} group`}>
                          <div className={`max-w-[80%] sm:max-w-[70%] flex items-end gap-1.5 ${mine ? 'flex-row-reverse' : ''}`}>
                            <button
                              type="button"
                              onClick={() => handleDelete(m.id)}
                              disabled={deletingId === m.id}
                              title="Delete message"
                              aria-label="Delete message"
                              className={`p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded-lg hover:bg-gray-100 ${
                                mine ? 'opacity-0 group-hover:opacity-100 focus:opacity-100' : 'hidden'
                              }`}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                            <div className={`px-3.5 py-2.5 rounded-2xl shadow-sm ${
                              mine ? 'bg-primary-600 text-white rounded-br-md' : 'bg-white border border-gray-100 rounded-bl-md'
                            }`}>
                              <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                              <p className={`mt-1 text-[10px] flex items-center justify-end gap-1 ${mine ? 'text-white/60' : 'text-gray-400'}`}>
                                {formatClock(m.timestamp)}
                                {mine && m.is_read && <span title="Read">✓✓</span>}
                              </p>
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {error && (
                <div className="px-4 py-2 bg-red-50 text-red-600 text-xs border-t border-red-100">{error}</div>
              )}

              <form onSubmit={handleSend} className="flex items-center gap-2 p-3 border-t border-gray-100">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={`Message ${partnerLabel(active)}…`}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  className="btn-primary px-4 py-2.5 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <Spinner className="h-4 w-4 !border-white/60" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                  <span className="hidden sm:inline">{sending ? 'Sending…' : 'Send'}</span>
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default Chat;
