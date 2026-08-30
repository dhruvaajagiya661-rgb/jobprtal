import React, { useState, useEffect, useRef, useCallback } from 'react';
import { careersAPI } from '../../api/client';
import useSeo from '../../hooks/useSeo';

interface Skill {
  id: number;
  name: string;
  question_count: number;
}

interface CareerPath {
  id: number;
  name: string;
  question_count: number;
}

interface Question {
  id: number;
  skill: { id: number; name: string };
  question: string;
  answer: string;
  difficulty: string;
  career_path_name: string | null;
  is_behavioral: boolean;
}

interface Resource {
  id: number;
  title: string;
  url: string;
  resource_type: string;
  difficulty: string;
  is_free: boolean;
}

interface ProgressStats {
  total_attempts: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  streak: number;
  best_streak: number;
  bookmarked_count: number;
  by_difficulty: { difficulty: string; total: number; correct: number }[];
}

interface BookmarkItem {
  id: number;
  question: Question;
}

const difficultyColors: Record<string, string> = {
  beginner: 'badge-success',
  intermediate: 'badge-warning',
  advanced: 'badge-danger',
};

const DIFFICULTIES = ['', 'beginner', 'intermediate', 'advanced'];

const InterviewPrep: React.FC = () => {
  useSeo({
    title: 'Interview prep',
    description: 'Practise real interview questions by role and track how your answers improve over time.',
  });
  const [skills, setSkills] = useState<Skill[]>([]);
  const [paths, setPaths] = useState<CareerPath[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [selectedSkill, setSelectedSkill] = useState<number | null>(null);
  const [selectedPath, setSelectedPath] = useState<number | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [showAnswer, setShowAnswer] = useState<number | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<number>>(new Set());
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);

  // Search
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<Question[]>([]);
  const [searching, setSearching] = useState(false);

  // Quiz / mock mode
  const [quizActive, setQuizActive] = useState(false);
  const [quizIsMock, setQuizIsMock] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [quizRevealed, setQuizRevealed] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [quizAnswered, setQuizAnswered] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Progress
  const [progress, setProgress] = useState<ProgressStats | null>(null);

  const loadQuestions = useCallback((skillId: number | null, pathId: number | null, difficulty: string) => {
    setQuestionsLoading(true);
    setShowAnswer(null);
    const p: Promise<{ data: { questions?: Question[]; resources?: Resource[] } }> =
      pathId
        ? careersAPI.interviewByPath(pathId, difficulty || undefined)
        : skillId
          ? careersAPI.interviewBySkill(skillId, difficulty || undefined)
          : Promise.resolve({ data: { questions: [], resources: [] } });
    p.then(r => {
      setQuestions(r.data.questions || []);
      setResources(r.data.resources || []);
    })
      .catch(() => {})
      .finally(() => setQuestionsLoading(false));
  }, []);

  useEffect(() => {
    careersAPI
      .interviewHub()
      .then(r => {
        setSkills(r.data.skills || []);
        setPaths(r.data.career_paths || []);
        setTotalQuestions(r.data.total_questions || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // Load progress + bookmarks only for logged-in users. This page is
    // public, so anonymous visitors must not be redirected to /login by the
    // axios 401 handler.
    if (localStorage.getItem('access_token')) {
      careersAPI
        .progress()
        .then(r => setProgress(r.data))
        .catch(() => {});
      careersAPI
        .bookmarks()
        .then(r => {
          const items: BookmarkItem[] = r.data.bookmarks || [];
          setBookmarks(items);
          setBookmarkedIds(new Set(items.map(b => b.question.id)));
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (selectedSkill || selectedPath) {
      loadQuestions(selectedSkill, selectedPath, selectedDifficulty);
    }
  }, [selectedSkill, selectedPath, selectedDifficulty, loadQuestions]);

  useEffect(() => {
    if (!searchQ.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      careersAPI
        .search(searchQ.trim())
        .then(r => setSearchResults(r.data.questions || []))
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 350);
    return () => clearTimeout(t);
  }, [searchQ]);

  // Quiz timer
  useEffect(() => {
    if (!quizActive || quizFinished) return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          window.clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [quizActive, quizIndex, quizFinished]);

  // Time's up: auto-reveal the model answer so the session can't hang.
  // Kept in its own effect so the timer updater stays pure.
  useEffect(() => {
    if (quizActive && !quizFinished && timeLeft === 0) {
      setQuizRevealed(true);
    }
  }, [timeLeft, quizActive, quizFinished]);

  const startQuiz = async (isMock: boolean) => {
    const skillIds = selectedSkill ? [selectedSkill] : [];
    const count = isMock ? 8 : 5;
    try {
      const r = isMock
        ? await careersAPI.mock(skillIds, count)
        : await careersAPI.quiz(skillIds, count, selectedDifficulty || undefined);
      const qs = r.data.questions || [];
      if (qs.length === 0) return;
      setQuizQuestions(qs);
      setQuizIndex(0);
      setQuizScore(0);
      setQuizAnswered(0);
      setQuizRevealed(false);
      setQuizFinished(false);
      setTimeLeft(r.data.time_per_question || 60);
      setQuizIsMock(isMock);
      setQuizActive(true);
    } catch { /* ignore */ }
  };

  const finishQuiz = useCallback(() => {
    setQuizFinished(true);
    setQuizActive(false);
    if (localStorage.getItem('access_token')) {
      careersAPI.progress().then(r => setProgress(r.data)).catch(() => {});
    }
  }, []);

  const handleReveal = (correct: boolean | null) => {
    if (!quizRevealed) {
      setQuizRevealed(true);
      return;
    }
    // User answered (correct/incorrect) -> record, move next
    const q = quizQuestions[quizIndex];
    if (correct !== null && q) {
      setQuizScore(s => s + (correct ? 1 : 0));
      setQuizAnswered(a => a + 1);
      // Progress tracking is a logged-in feature; anonymous visitors can
      // still take the quiz without firing 401s at the server.
      if (localStorage.getItem('access_token')) {
        careersAPI.recordAttempt(q.id, correct, quizIsMock ? 'mock' : 'quiz').catch(() => {});
      }
    }
    if (quizIndex + 1 >= quizQuestions.length) {
      finishQuiz();
    } else {
      setQuizIndex(i => i + 1);
      setQuizRevealed(false);
      setTimeLeft(quizIsMock ? 45 : 60);
    }
  };

  const handleBookmark = async (questionId: number) => {
    try {
      const r = await careersAPI.bookmark(questionId);
      setBookmarkedIds(prev => {
        const next = new Set(prev);
        if (r.data.bookmarked) next.add(questionId);
        else next.delete(questionId);
        return next;
      });
      if (r.data.bookmarked) {
        const q = questions.find(x => x.id === questionId) || searchResults.find(x => x.id === questionId);
        if (q) setBookmarks(prev => [{ id: questionId, question: q }, ...prev]);
      } else {
        setBookmarks(prev => prev.filter(b => b.question.id !== questionId));
      }
    } catch { /* ignore */ }
  };

  const renderQuestionCard = (q: Question, inQuiz = false) => (
    <div key={q.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded">{q.skill?.name}</span>
            <span className={difficultyColors[q.difficulty] || 'badge'}>{q.difficulty}</span>
            {q.is_behavioral && <span className="badge bg-purple-100 text-purple-700">Behavioral</span>}
          </div>
          <p className="text-gray-900 font-medium leading-relaxed">{q.question}</p>
        </div>
        {!inQuiz && (
          <button
            onClick={() => handleBookmark(q.id)}
            title={bookmarkedIds.has(q.id) ? 'Remove bookmark' : 'Bookmark'}
            className={`ml-3 p-2 rounded-lg transition-colors ${bookmarkedIds.has(q.id) ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-500'}`}
          >
            <svg className="w-5 h-5" fill={bookmarkedIds.has(q.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
        )}
      </div>
      <button
        onClick={() => setShowAnswer(showAnswer === q.id ? null : q.id)}
        className="text-sm text-primary-600 hover:text-primary-700 font-medium"
      >
        {showAnswer === q.id ? 'Hide Answer' : 'Show Answer'}
      </button>
      {showAnswer === q.id && q.answer && (
        <div className="mt-3 p-4 bg-gray-50 rounded-lg text-sm text-gray-700 leading-relaxed whitespace-pre-line">
          {q.answer}
        </div>
      )}
    </div>
  );

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;
  }

  // -------- Quiz / Mock session view --------
  if (quizActive && !quizFinished) {
    const q = quizQuestions[quizIndex];
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{quizIsMock ? 'Mock Interview' : 'Timed Quiz'}</h1>
            <p className="text-gray-500 text-sm mt-1">Question {quizIndex + 1} of {quizQuestions.length}</p>
          </div>
          <div className={`px-4 py-2 rounded-xl font-mono text-lg font-bold ${timeLeft <= 10 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-700'}`}>
            ⏱ {timeLeft}s
          </div>
        </div>

        <div className="mb-6">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${((quizIndex + (quizRevealed ? 1 : 0)) / quizQuestions.length) * 100}%` }}></div>
          </div>
        </div>

        {q ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded">{q.skill?.name}</span>
              <span className={difficultyColors[q.difficulty] || 'badge'}>{q.difficulty}</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 leading-relaxed mb-6">{q.question}</h2>

            {!quizRevealed ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-500">Think about your answer, then reveal the model answer and grade yourself.</p>
                <button
                  onClick={() => handleReveal(null)}
                  className="btn-primary w-full py-3"
                >
                  Reveal Model Answer
                </button>
              </div>
            ) : (
              <div>
                {q.answer && (
                  <div className="p-4 bg-gray-50 rounded-xl text-sm text-gray-700 leading-relaxed whitespace-pre-line mb-6">
                    <span className="font-semibold text-gray-900">Model answer: </span>
                    {q.answer}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => handleReveal(true)} className="py-3 rounded-xl bg-green-50 text-green-700 font-semibold hover:bg-green-100 transition-colors">
                    ✓ Got it right
                  </button>
                  <button onClick={() => handleReveal(false)} className="py-3 rounded-xl bg-red-50 text-red-600 font-semibold hover:bg-red-100 transition-colors">
                    ✗ Needs review
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  // -------- Quiz finished summary --------
  if (quizFinished) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Session Complete!</h1>
        <p className="text-gray-500 mt-2">You answered {quizAnswered} question{quizAnswered === 1 ? '' : 's'} and got {quizScore} correct.</p>
        <div className="grid grid-cols-3 gap-4 mt-8">
          <div className="p-5 bg-white rounded-xl border border-gray-100">
            <p className="text-3xl font-bold text-primary-600">{quizAnswered}</p>
            <p className="text-xs text-gray-500 mt-1">Answered</p>
          </div>
          <div className="p-5 bg-white rounded-xl border border-gray-100">
            <p className="text-3xl font-bold text-green-600">{quizScore}</p>
            <p className="text-xs text-gray-500 mt-1">Correct</p>
          </div>
          <div className="p-5 bg-white rounded-xl border border-gray-100">
            <p className="text-3xl font-bold text-gray-900">{quizAnswered ? Math.round((quizScore / quizAnswered) * 100) : 0}%</p>
            <p className="text-xs text-gray-500 mt-1">Accuracy</p>
          </div>
        </div>
        <div className="mt-8 space-x-3">
          <button onClick={() => startQuiz(quizIsMock)} className="btn-primary">Practice Again</button>
          <button onClick={() => setQuizFinished(false)} className="btn-secondary">Back to Browse</button>
        </div>
      </div>
    );
  }

  // -------- Main browse view --------
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Interview Preparation</h1>
        <p className="text-lg text-gray-500 mt-3">{totalQuestions} practice questions to help you ace your interviews</p>
      </div>

      {/* Progress summary */}
      {progress && progress.total_attempts > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          <div className="p-4 bg-white rounded-xl border border-gray-100">
            <p className="text-xl font-bold text-gray-900">{progress.total_attempts}</p>
            <p className="text-xs text-gray-500">Attempts</p>
          </div>
          <div className="p-4 bg-white rounded-xl border border-gray-100">
            <p className="text-xl font-bold text-green-600">{progress.accuracy}%</p>
            <p className="text-xs text-gray-500">Accuracy</p>
          </div>
          <div className="p-4 bg-white rounded-xl border border-gray-100">
            <p className="text-xl font-bold text-primary-600">{progress.streak}🔥</p>
            <p className="text-xs text-gray-500">Day streak (best {progress.best_streak})</p>
          </div>
          <div className="p-4 bg-white rounded-xl border border-gray-100">
            <p className="text-xl font-bold text-yellow-500">{progress.bookmarked_count}</p>
            <p className="text-xs text-gray-500">Bookmarks</p>
          </div>
          <div className="p-4 bg-white rounded-xl border border-gray-100">
            <p className="text-xl font-bold text-gray-900">{progress.correct}</p>
            <p className="text-xs text-gray-500">Correct answers</p>
          </div>
        </div>
      )}

      {/* Search + actions */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Search all questions…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
          />
          {searching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Searching…</span>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => startQuiz(false)} className="btn-primary whitespace-nowrap">▶ Start Quiz</button>
          <button onClick={() => startQuiz(true)} className="btn-secondary whitespace-nowrap">🎤 Mock Interview</button>
          <button
            onClick={() => setShowBookmarks(b => !b)}
            className={`whitespace-nowrap px-4 py-2 rounded-xl font-medium text-sm transition-colors ${showBookmarks ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            🔖 Bookmarks {progress?.bookmarked_count ? `(${progress.bookmarked_count})` : ''}
          </button>
        </div>
      </div>

      {searchQ.trim() && (
        <div className="mb-8">
          <h3 className="font-semibold text-gray-900 mb-3">Search results ({searchResults.length})</h3>
          {searchResults.length === 0 ? (
            <p className="text-sm text-gray-400">No questions match "{searchQ}"</p>
          ) : (
            <div className="space-y-4">{searchResults.map(q => renderQuestionCard(q))}</div>
          )}
        </div>
      )}

      {showBookmarks && (
        <div className="mb-8">
          <h3 className="font-semibold text-gray-900 mb-3">Bookmarked questions ({bookmarks.length})</h3>
          {bookmarks.length === 0 ? (
            <p className="text-sm text-gray-400">No bookmarks yet — click the 🔖 on any question to save it for later.</p>
          ) : (
            <div className="space-y-4">{bookmarks.map(b => renderQuestionCard(b.question))}</div>
          )}
        </div>
      )}

      {!searchQ.trim() && !showBookmarks && (
        <div className="grid md:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 sticky top-24">
              <h3 className="font-semibold text-gray-900 mb-3">Skills</h3>
              <div className="space-y-1">
                {skills.map(skill => (
                  <button
                    key={skill.id}
                    onClick={() => { setSelectedSkill(skill.id); setSelectedPath(null); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedSkill === skill.id && !selectedPath ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {skill.name}
                    <span className="float-right text-xs text-gray-400">{skill.question_count}</span>
                  </button>
                ))}
              </div>

              {paths.length > 0 && (
                <>
                  <h3 className="font-semibold text-gray-900 mt-6 mb-3">Career Paths</h3>
                  <div className="space-y-1">
                    {paths.map(path => (
                      <button
                        key={path.id}
                        onClick={() => { setSelectedPath(path.id); setSelectedSkill(null); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          selectedPath === path.id ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {path.name}
                        <span className="float-right text-xs text-gray-400">{path.question_count}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Main content */}
          <div className="md:col-span-3">
            {!selectedSkill && !selectedPath ? (
              <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-100">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900">Select a skill or career path</h3>
                <p className="text-gray-500 mt-1">Choose from the sidebar, or search above to find questions</p>
                <div className="mt-6 flex justify-center gap-3">
                  <button onClick={() => startQuiz(false)} className="btn-primary">Take a Random Quiz</button>
                  <button onClick={() => startQuiz(true)} className="btn-secondary">Start Mock Interview</button>
                </div>
              </div>
            ) : questionsLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : (
              <>
                {/* Difficulty filter */}
                <div className="flex gap-2 mb-6">
                  {DIFFICULTIES.map(d => (
                    <button
                      key={d}
                      onClick={() => setSelectedDifficulty(d)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${
                        selectedDifficulty === d ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {d || 'All'}
                    </button>
                  ))}
                </div>

                {questions.length === 0 ? (
                  <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
                    <p className="text-gray-500">No questions found for this selection.</p>
                  </div>
                ) : (
                  <div className="space-y-4">{questions.map(q => renderQuestionCard(q))}</div>
                )}

                {/* Resources */}
                {resources.length > 0 && (
                  <div className="mt-8">
                    <h3 className="font-semibold text-gray-900 mb-4">Learning Resources</h3>
                    <div className="grid md:grid-cols-2 gap-3">
                      {resources.map(r => (
                        <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center p-3 bg-white rounded-xl border border-gray-100 hover:shadow-sm transition-shadow">
                          <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center mr-3">
                            <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
                            <p className="text-xs text-gray-400 capitalize">{r.resource_type} • {r.difficulty}</p>
                          </div>
                          {r.is_free && <span className="badge-success text-xs">Free</span>}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewPrep;
