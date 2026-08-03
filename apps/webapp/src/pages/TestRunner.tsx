import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { QuestionDto } from 'shared-types';
import { api } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';

export function TestRunner() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const { hapticFeedback } = useTelegram();

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<QuestionDto[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [timeLimitSec, setTimeLimitSec] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [timeLeftSec, setTimeLeftSec] = useState<number | null>(null);

  useEffect(() => {
    if (!testId) return;

    async function init() {
      try {
        const [{ attempt }, { test }] = await Promise.all([
          api.startAttempt(testId!),
          api.getTest(testId!),
        ]);
        setAttemptId(attempt.id);
        setStartedAt(new Date(attempt.startedAt));
        setTitle(test.title);
        setQuestions(test.questions);
        setTimeLimitSec(test.timeLimitSec);
        setTimeLeftSec(test.timeLimitSec);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      }
    }

    void init();
  }, [testId]);

  useEffect(() => {
    if (!startedAt || timeLimitSec == null) return;

    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000);
      const next = Math.max(0, timeLimitSec - elapsed);
      setTimeLeftSec(next);

      if (next <= 0) {
        void finishAttemptByTimeout();
      }
    };

    tick();
    const timer = window.setInterval(tick, 1000);

    return () => window.clearInterval(timer);
  }, [startedAt, timeLimitSec]);

  const currentQuestion = questions[currentIdx];

  function toggleOption(optionId: string) {
    if (!currentQuestion) return;

    if (currentQuestion.type === 'SINGLE_CHOICE') {
      setSelected([optionId]);
    } else {
      setSelected((prev) =>
        prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
      );
    }
    hapticFeedback.selectionChanged();
  }

  async function finishAttemptByTimeout() {
    if (!attemptId) return;

    try {
      await api.finishAttempt(attemptId);
      hapticFeedback.notificationOccurred('success');
      navigate(`/result/${attemptId}`);
    } catch (err) {
      hapticFeedback.notificationOccurred('error');
      setError(err instanceof Error ? err.message : 'Не удалось завершить попытку');
    }
  }

  async function handleNext() {
    if (!attemptId || !currentQuestion || selected.length === 0) return;

    setSubmitting(true);
    setError(null);

    try {
      await api.submitAnswer(attemptId, currentQuestion.id, selected);
      setSelected([]);

      if (currentIdx + 1 < questions.length) {
        setCurrentIdx((idx) => idx + 1);
        hapticFeedback.impactOccurred('light');
      } else {
        await api.finishAttempt(attemptId);
        hapticFeedback.notificationOccurred('success');
        navigate(`/result/${attemptId}`);
      }
    } catch (err) {
      hapticFeedback.notificationOccurred('error');
      setError(err instanceof Error ? err.message : 'Ошибка отправки');
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !currentQuestion) {
    return <div className="page error">{error}</div>;
  }

  if (!currentQuestion) {
    return <div className="page">Загрузка...</div>;
  }

  const progress = ((currentIdx + 1) / questions.length) * 100;
  const isLast = currentIdx + 1 === questions.length;

  return (
    <div className="page">
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <p className="muted">
        {title} · вопрос {currentIdx + 1} из {questions.length}
      </p>

      {timeLimitSec != null && timeLeftSec != null && (
        <div className="timer-box">
          <strong>Осталось:</strong> {Math.max(0, timeLeftSec)} сек
        </div>
      )}

      <h2>
        {currentQuestion.title}
        {currentQuestion.type === 'MULTIPLE_CHOICE' && (
          <span className="badge">несколько ответов</span>
        )}
      </h2>

      <div className="options">
        {currentQuestion.options.map((opt) => {
          const checked = selected.includes(opt.id);
          return (
            <label key={opt.id} className={`option ${checked ? 'selected' : ''}`}>
              <input
                type={currentQuestion.type === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'}
                name={`q-${currentQuestion.id}`}
                checked={checked}
                onChange={() => toggleOption(opt.id)}
              />
              <span>{opt.text}</span>
            </label>
          );
        })}
      </div>

      {error && <p className="error inline">{error}</p>}

      <button
        type="button"
        className="primary"
        onClick={() => void handleNext()}
        disabled={selected.length === 0 || submitting}
      >
        {submitting ? 'Отправка...' : isLast ? 'Завершить' : 'Далее'}
      </button>
    </div>
  );
}
