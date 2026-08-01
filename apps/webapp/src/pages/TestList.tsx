import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TestListItemDto } from 'shared-types';
import { api } from '../api/client';

export function TestList() {
  const [tests, setTests] = useState<TestListItemDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .getTests()
      .then((data) => setTests(data.tests))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page">Загрузка тестов...</div>;
  if (error) return <div className="page error">{error}</div>;

  return (
    <div className="page">
      <h1>Доступные тесты</h1>
      {tests.length === 0 ? (
        <p className="muted">Пока нет активных тестов</p>
      ) : (
        <ul className="test-list">
          {tests.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className="test-card"
                onClick={() => navigate(`/test/${t.id}`)}
              >
                <h3>{t.title}</h3>
                {t.description && <p>{t.description}</p>}
                <span className="meta">
                  {t.questionCount} вопр.
                  {t.timeLimitSec != null && ` · ${Math.round(t.timeLimitSec / 60)} мин`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
