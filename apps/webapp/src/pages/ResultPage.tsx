import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { AttemptResultDto } from '../api/client';
import { api } from '../api/client';

export function ResultPage() {
  const { attemptId } = useParams();
  const [result, setResult] = useState<AttemptResultDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!attemptId) return;

    api
      .getResult(attemptId)
      .then((data) => setResult(data.result))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [attemptId]);

  if (loading) return <div className="page">Загрузка результата...</div>;
  if (error) return <div className="page error">{error}</div>;
  if (!result) return <div className="page">Результат не найден</div>;

  return (
    <div className="page">
      <h1>Результат попытки</h1>
      <p className="muted">
        {result.score ?? 0} / {result.maxScore ?? 0}
      </p>

      <div className="stack">
        {result.answers.map((answer) => {
          const selectedTexts = answer.selectedOptionIds
            .map((optionId) => answer.question.options.find((option) => option.id === optionId)?.text)
            .filter((text): text is string => Boolean(text));

          return (
            <div key={answer.id} className="card">
              <h3>{answer.question.title}</h3>
              <p>
                Статус: <strong>{answer.isCorrect ? 'Верно' : 'Не верно'}</strong>
              </p>
              <p>
                Выбранные ответы:{' '}
                {selectedTexts.length > 0 ? selectedTexts.join(', ') : '—'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
