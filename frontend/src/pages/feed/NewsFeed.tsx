import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { feedAPI } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

interface Author {
  id: number;
  email: string;
  username: string;
}

interface Comment {
  id: number;
  user: Author;
  content: string;
  likes_count: number;
  is_liked: boolean;
  replies_count: number;
  created_at: string;
}

interface Post {
  id: number;
  author: Author;
  content: string;
  post_type: string;
  image?: string;
  shared_job_title?: string;
  shared_job_company?: string;
  article_title?: string;
  article_url?: string;
  visibility: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  is_liked: boolean;
  user_reaction?: string;
  is_saved: boolean;
  comments: Comment[];
  created_at: string;
}

const REACTIONS = [
  { key: 'like', emoji: '👍', label: 'Like' },
  { key: 'celebrate', emoji: '🎉', label: 'Celebrate' },
  { key: 'support', emoji: '💪', label: 'Support' },
  { key: 'love', emoji: '❤️', label: 'Love' },
  { key: 'insightful', emoji: '💡', label: 'Insightful' },
  { key: 'funny', emoji: '😄', label: 'Funny' },
];

const timeAgo = (date: string) => {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
};

const PostCard: React.FC<{ post: Post; onUpdate: () => void }> = ({ post, onUpdate }) => {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showReactions, setShowReactions] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleLike = async (reaction = 'like') => {
    await feedAPI.like(post.id, reaction);
    setShowReactions(false);
    onUpdate();
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;
    await feedAPI.comment(post.id, commentText);
    setCommentText('');
    onUpdate();
  };

  const handleSave = async () => {
    await feedAPI.toggleSave(post.id);
    onUpdate();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Author Header */}
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white font-bold text-lg">
              {(post.author.username || post.author.email)[0].toUpperCase()}
            </div>
            <div>
              <Link to={`/profile/${post.author.id}`} className="font-semibold text-gray-900 hover:text-primary-600 transition-colors">
                {post.author.username || post.author.email}
              </Link>
              <p className="text-xs text-gray-500">{timeAgo(post.created_at)} · {post.visibility === 'public' ? '🌐' : '🔗'}</p>
            </div>
          </div>
          <button className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className={`mt-3 text-gray-800 leading-relaxed ${!expanded && post.content.length > 300 ? 'line-clamp-4' : ''}`}>
          {post.content}
        </div>
        {post.content.length > 300 && !expanded && (
          <button onClick={() => setExpanded(true)} className="text-primary-600 text-sm font-medium mt-1 hover:underline">...see more</button>
        )}

        {/* Shared Job */}
        {post.shared_job_title && (
          <Link to={`/jobs`} className="mt-3 block p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-primary-300 transition-colors">
            <p className="text-xs text-gray-500 mb-1">Shared a job</p>
            <p className="font-semibold text-gray-900">{post.shared_job_title}</p>
            {post.shared_job_company && <p className="text-sm text-gray-500">{post.shared_job_company}</p>}
          </Link>
        )}

        {/* Article Link */}
        {post.article_url && (
          <a href={post.article_url} target="_blank" rel="noopener noreferrer" className="mt-3 block p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-primary-300 transition-colors">
            {post.article_title && <p className="font-semibold text-gray-900">{post.article_title}</p>}
            <p className="text-sm text-primary-600 truncate">{post.article_url}</p>
          </a>
        )}
      </div>

      {/* Engagement Counts */}
      <div className="px-5 py-2 flex items-center justify-between text-xs text-gray-500 border-t border-gray-100">
        <div className="flex items-center gap-1">
          {post.likes_count > 0 && (
            <>
              <span className="text-base">👍</span>
              <span>{post.likes_count}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {post.comments_count > 0 && <span>{post.comments_count} comments</span>}
          {post.shares_count > 0 && <span>{post.shares_count} shares</span>}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-5 py-1 flex items-center border-t border-gray-100">
        <div className="relative flex-1"
          onMouseEnter={() => setShowReactions(true)}
          onMouseLeave={() => setShowReactions(false)}>
          <button
            onClick={() => handleLike()}
            className={`flex items-center justify-center gap-2 py-3 flex-1 rounded-lg transition-colors font-medium text-sm ${
              post.is_liked ? 'text-primary-600 bg-primary-50' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span>{post.user_reaction ? REACTIONS.find(r => r.key === post.user_reaction)?.emoji || '👍' : '👍'}</span>
            <span>{post.user_reaction ? REACTIONS.find(r => r.key === post.user_reaction)?.label || 'Like' : 'Like'}</span>
          </button>
          {showReactions && (
            <div className="absolute bottom-full left-0 mb-2 bg-white rounded-full shadow-xl border border-gray-100 px-2 py-1.5 flex items-center gap-1 z-10">
              {REACTIONS.map(r => (
                <button key={r.key} onClick={() => handleLike(r.key)}
                  className="text-2xl hover:scale-125 transition-transform p-1" title={r.label}>
                  {r.emoji}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => setShowComments(!showComments)}
          className="flex items-center justify-center gap-2 py-3 flex-1 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors font-medium text-sm">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          Comment
        </button>
        <button onClick={handleSave}
          className={`flex items-center justify-center gap-2 py-3 flex-1 rounded-lg transition-colors font-medium text-sm ${
            post.is_saved ? 'text-primary-600 bg-primary-50' : 'text-gray-600 hover:bg-gray-50'
          }`}>
          <svg className="w-5 h-5" fill={post.is_saved ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
          Save
        </button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
          {user && (
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-xs font-bold">
                {(user.username || user.email)[0].toUpperCase()}
              </div>
              <input
                type="text"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleComment()}
                placeholder="Add a comment..."
                className="flex-1 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <button onClick={handleComment} disabled={!commentText.trim()}
                className="text-primary-600 font-semibold text-sm disabled:opacity-40 hover:text-primary-700">
                Post
              </button>
            </div>
          )}
          {post.comments.map(c => (
            <div key={c.id} className="flex gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {(c.user.username || c.user.email)[0].toUpperCase()}
              </div>
              <div className="bg-white rounded-xl px-3 py-2 border border-gray-100 flex-1">
                <Link to={`/profile/${c.user.id}`} className="text-sm font-semibold text-gray-900 hover:text-primary-600">{c.user.username || c.user.email}</Link>
                <p className="text-sm text-gray-700">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const CreatePostBox: React.FC<{ onCreated: () => void }> = ({ onCreated }) => {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [showForm, setShowForm] = useState(false);

  if (!user) return null;

  const handleSubmit = async () => {
    if (!content.trim()) return;
    await feedAPI.create({ content, post_type: 'text', visibility: 'public' });
    setContent('');
    setShowForm(false);
    onCreated();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white font-bold">
          {(user.username || user.email)[0].toUpperCase()}
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex-1 text-left bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full px-4 py-3 text-sm text-gray-500 transition-colors">
          Start a post, try writing with AI
        </button>
      </div>
      {showForm && (
        <div className="mt-4">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="What do you want to talk about?"
            className="w-full border border-gray-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            rows={4}
            autoFocus
          />
          <div className="flex justify-between items-center mt-3">
            <div className="flex items-center gap-2">
              <select className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600">
                <option value="public">🌐 Anyone</option>
                <option value="connections">🔗 Connections only</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowForm(false); setContent(''); }}
                className="text-sm text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-100">Cancel</button>
              <button onClick={handleSubmit} disabled={!content.trim()}
                className="text-sm bg-primary-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-primary-700 disabled:opacity-40 transition-colors">
                Post
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const NewsFeed: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'feed' | 'trending' | 'my'>('feed');

  const loadPosts = useCallback(async () => {
    try {
      let response;
      if (activeTab === 'trending') {
        response = await feedAPI.trending();
      } else if (activeTab === 'my') {
        response = await feedAPI.myPosts();
      } else {
        response = await feedAPI.list();
      }
      setPosts(response.data.results || response.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [activeTab]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Feed</h1>
      </div>

      <CreatePostBox onCreated={loadPosts} />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
        {(['feed', 'trending', 'my'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {tab === 'feed' ? 'My Feed' : tab === 'trending' ? '🔥 Trending' : 'My Posts'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
          <p className="text-gray-500 font-medium">No posts yet</p>
          <p className="text-gray-400 text-sm mt-1">Connect with people and check back here for their updates.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <PostCard key={post.id} post={post} onUpdate={loadPosts} />
          ))}
        </div>
      )}
    </div>
  );
};

export default NewsFeed;
