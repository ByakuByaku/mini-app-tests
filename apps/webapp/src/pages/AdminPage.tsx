import { useEffect, useMemo, useState } from 'react';
import type { AdminTestListItemDto, CreateTestInput } from 'shared-types';
import { api, type AdminAttemptListItemDto } from '../api/client';

type QuestionDraft = {
  title: string;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE';
  orderNum: number;
  options: Array<{ text: string; isCorrect: boolean; orderNum: number }>;
};

const createEmptyQuestion = (orderNum: number): QuestionDraft => ({
  title: '',
  type: 'SINGLE_CHOICE',
  orderNum,
  options: [
    { text: '', isCorrect: false, orderNum: 0 },
    { text: '', isCorrect: false, orderNum: 1 },
  ],
});

export function AdminPage() {
  const [tests, setTests] = useState<AdminTestListItemDto[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [timeLimitSec, setTimeLimitSec] = useState<number | ''>('');
  const [questions, setQuestions] = useState<QuestionDraft[]>([createEmptyQuestion(0)]);
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<AdminAttemptListItemDto[]>([]);
  const [activeTab, setActiveTab] = useState<'tests' | 'attempts'>('tests');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false;

    return questions.every((question) => {
      if (!question.title.trim()) return false;
      if (question.options.length < 2) return false;
      return question.options.every((option) => option.text.trim());
    });
  }, [questions, title]);

  const uniqueUsers = useMemo(() => {
  const map = new Map<
    string,
    {
      id: string;
      label: string;
    }
  >();

  attempts.forEach((attempt) => {
    if (!map.has(attempt.user.id)) {
      map.set(attempt.user.id, {
        id: attempt.user.id,
        label:
          attempt.user.fullName ||
          attempt.user.username ||
          attempt.user.id,
      });
    }
  });

  return Array.from(map.values()).sort((a, b) =>
    a.label.localeCompare(b.label)
  );
  }, [attempts]);

  const matchingUsers = useMemo(() => {
  if (!userSearch.trim()) {
    return [];
  }

  const query = userSearch.toLowerCase();

  return uniqueUsers.filter((user) =>
    user.label.toLowerCase().includes(query)
  );
  }, [uniqueUsers, userSearch]);

  const filteredAttempts = useMemo(() => {
  if (!selectedUserId) {
    return attempts;
  }

  return attempts.filter(
    (attempt) => attempt.user.id === selectedUserId
  );
  }, [attempts, selectedUserId]);

  const selectedUser = useMemo(
  () => uniqueUsers.find((u) => u.id === selectedUserId),
  [uniqueUsers, selectedUserId]
  );


  async function loadTests() {
    try {
      const data = await api.getAdminTests();
      setTests(data.tests);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    }
  }

  async function loadAttempts() {
    try {
      const data = await api.getAdminAttempts();
      setAttempts(data.attempts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки попыток');
    }
  }

  useEffect(() => {
    void loadTests();
    void loadAttempts();
  }, []);

  function addQuestion() {
    setQuestions((prev) => [...prev, createEmptyQuestion(prev.length)]);
  }

  function removeQuestion(index: number) {
    setQuestions((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((_, questionIndex) => questionIndex !== index);
    });
  }

  function updateQuestion(index: number, patch: Partial<QuestionDraft>) {
    setQuestions((prev) =>
      prev.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...patch } : question
      )
    );
  }

  function addOption(questionIndex: number) {
    setQuestions((prev) =>
      prev.map((question, index) => {
        if (index !== questionIndex) return question;
        const nextOrder = question.options.length;
        return {
          ...question,
          options: [...question.options, { text: '', isCorrect: false, orderNum: nextOrder }],
        };
      })
    );
  }

  function removeOption(questionIndex: number, optionIndex: number) {
    setQuestions((prev) =>
      prev.map((question, index) => {
        if (index !== questionIndex) return question;
        if (question.options.length <= 2) return question;

        const nextOptions = question.options
          .filter((_, optionPos) => optionPos !== optionIndex)
          .map((option, newOrder) => ({ ...option, orderNum: newOrder }));

        return { ...question, options: nextOptions };
      })
    );
  }

  function updateOption(questionIndex: number, optionIndex: number, field: 'text' | 'isCorrect', value: string | boolean) {
    setQuestions((prev) =>
      prev.map((question, index) => {
        if (index !== questionIndex) return question;

        const nextOptions = question.options.map((option, optionPos) => {
          if (optionPos !== optionIndex) return option;

          if (field === 'isCorrect') {
            const nextCorrect = Boolean(value);

            if (question.type === 'SINGLE_CHOICE' && nextCorrect) {
              return { ...option, isCorrect: true };
            }

            return { ...option, isCorrect: nextCorrect };
          }

          return { ...option, text: String(value) };
        });

        if (question.type === 'SINGLE_CHOICE' && field === 'isCorrect' && value) {
          return {
            ...question,
            options: nextOptions.map((option, optionPos) => ({
              ...option,
              isCorrect: optionPos === optionIndex,
            })),
          };
        }

        return { ...question, options: nextOptions };
      })
    );
  }

  function validateQuestions(): string | null {
    for (const [questionIndex, question] of questions.entries()) {
      const correctCount = question.options.filter((option) => option.isCorrect).length;
      if (question.type === 'SINGLE_CHOICE' && correctCount !== 1) {
        return `Вопрос ${questionIndex + 1}: для типа “Один вариант” нужен ровно один правильный ответ`;
      }
      if (question.type === 'MULTIPLE_CHOICE' && correctCount < 1) {
        return `Вопрос ${questionIndex + 1}: для типа “Несколько вариантов” нужен хотя бы один правильный ответ`;
      }
    }

    return null;
  }

  function resetForm() {
    setTitle('');
    setDescription('');
    setIsActive(true);
    setTimeLimitSec('');
    setQuestions([createEmptyQuestion(0)]);
    setEditingTestId(null);
  }

  async function beginEdit(test: AdminTestListItemDto) {
    try {
      const data = await api.getAdminTest(test.id);
      const detail = data.test;

      setEditingTestId(detail.id);
      setTitle(detail.title);
      setDescription(detail.description ?? '');
      setIsActive(detail.isActive);
      setTimeLimitSec(detail.timeLimitSec ?? '');
      setQuestions(
        detail.questions.map((question, questionIndex) => ({
          title: question.title,
          type: question.type,
          orderNum: questionIndex,
          options: question.options.map((option, optionIndex) => ({
            text: option.text,
            isCorrect: option.isCorrect,
            orderNum: optionIndex,
          })),
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить тест для редактирования');
    }
  }

  async function handleSave() {
    const validationMessage = validateQuestions();
    if (!canSubmit) {
      setError('Заполните название теста, каждый вопрос и все варианты');
      return;
    }
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setSaving(true);
    setError(null);

    const payload: CreateTestInput = {
      title,
      description: description || null,
      isActive,
      timeLimitSec: timeLimitSec === '' ? null : timeLimitSec,
      questions: questions.map((question, index) => ({
        title: question.title,
        type: question.type,
        orderNum: index,
        options: question.options.map((option, optionIndex) => ({
          text: option.text,
          isCorrect: option.isCorrect,
          orderNum: optionIndex,
        })),
      })),
    };

    try {
      if (editingTestId) {
        await api.updateTest(editingTestId, payload);
      } else {
        await api.createTest(payload);
      }
      resetForm();
      await loadTests();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : editingTestId
            ? 'Не удалось обновить тест'
            : 'Не удалось создать тест'
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(testId: string) {
    try {
      await api.deleteTest(testId);
      await loadTests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить тест');
    }
  }

  return (
    <div className="page">
      <h1>Админка</h1>

      <div className="tabs-row">
        <button type="button" className={activeTab === 'tests' ? 'primary' : 'secondary'} onClick={() => setActiveTab('tests')}>
          Тесты
        </button>
        <button type="button" className={activeTab === 'attempts' ? 'primary' : 'secondary'} onClick={() => setActiveTab('attempts')}>
          Попытки и результаты
        </button>
      </div>

      {activeTab === 'tests' && (
        <div className="card stack">
          <h2>Создать тест</h2>

        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название теста" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Описание" />

        <label>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Показывать тест пользователям
        </label>

        <label>
          <span>Лимит времени в секундах</span>
          <input
            type="number"
            min={1}
            value={timeLimitSec}
            onChange={(e) => setTimeLimitSec(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="Например: 300"
          />
        </label>

        <div className="stack">
          {questions.map((question, questionIndex) => (
            <div key={`${questionIndex}-${question.orderNum}`} className="question-block card">
              <div className="question-head">
                <strong>Вопрос {questionIndex + 1}</strong>
                <button type="button" onClick={() => removeQuestion(questionIndex)}>
                  Удалить вопрос
                </button>
              </div>

              <input
                value={question.title}
                onChange={(e) => updateQuestion(questionIndex, { title: e.target.value })}
                placeholder="Название вопроса"
              />

              <select
                value={question.type}
                onChange={(e) =>
                  updateQuestion(questionIndex, {
                    type: e.target.value as 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE',
                  })
                }
              >
                <option value="SINGLE_CHOICE">Один правильный вариант</option>
                <option value="MULTIPLE_CHOICE">Несколько правильных вариантов</option>
              </select>

              <div className="stack">
                {question.options.map((option, optionIndex) => (
                  <div key={`${questionIndex}-${optionIndex}`} className="option-row">
                    <input
                      value={option.text}
                      onChange={(e) => updateOption(questionIndex, optionIndex, 'text', e.target.value)}
                      placeholder={`Вариант ${optionIndex + 1}`}
                    />
                    <label>
                      <input
                        type={question.type === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'}
                        name={`q-${questionIndex}`}
                        checked={option.isCorrect}
                        onChange={(e) =>
                          updateOption(
                            questionIndex,
                            optionIndex,
                            'isCorrect',
                            e.target.checked
                          )
                        }
                      />
                      Правильный
                    </label>
                    <button type="button" onClick={() => removeOption(questionIndex, optionIndex)}>
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <button type="button" onClick={() => addOption(questionIndex)}>
                Добавить вариант
              </button>
            </div>
          ))}
        </div>

        <button type="button" className="secondary" onClick={addQuestion}>
          Добавить вопрос
        </button>

          <div className="actions-row">
            <button type="button" className="primary" onClick={() => void handleSave()} disabled={!canSubmit || saving}>
              {saving ? (editingTestId ? 'Сохраняем...' : 'Создаём...') : editingTestId ? 'Сохранить изменения' : 'Создать тест'}
            </button>
            {editingTestId && (
              <button type="button" className="secondary" onClick={resetForm}>
                Отмена
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === 'attempts' && (
        <div className="card stack">
          <h2>Попытки и результаты</h2>
          <div style={{ position: 'relative' }}>
            <input
              value={selectedUser ? selectedUser.label : userSearch}
              onChange={(e) => {
                setUserSearch(e.target.value);
                setSelectedUserId(null);
              }}
              placeholder="Поиск участника..."
            />
            {selectedUserId && (
              <button
                type="button"
                onClick={() => {
                  setSelectedUserId(null);
                  setUserSearch('');
                }}
              >
                Показать всех
              </button>
            )}
            {!selectedUserId && userSearch && matchingUsers.length > 0 && (
              <div
                className="card"
                style={{
                  position: 'absolute',
                  width: '100%',
                  zIndex: 10,
                }}
              >
                {matchingUsers.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => {
                      setSelectedUserId(user.id);
                      setUserSearch('');
                    }}
                    style={{
                      padding: 8,
                      cursor: 'pointer',
                    }}
                  >
                    {user.label}
                  </div>
                ))}
              </div>
            )}
          </div>
          {attempts.length === 0 ? (
            <p className="muted">Пока нет попыток</p>
          ) : (
            <div className="stack">
              {filteredAttempts.map((attempt) => (
                <div key={attempt.id} className="card">
                  <h3>{attempt.test.title}</h3>
                  <p className="muted">
                    Пользователь: {attempt.user.fullName || attempt.user.username || attempt.user.id}
                  </p>
                  <p className="muted">
                    Статус: {attempt.status} · Балл: {attempt.score ?? 0}/{attempt.maxScore ?? 0}
                  </p>
                  <p className="muted">
                    Начало: {new Date(attempt.startedAt).toLocaleString()} · Завершение: {attempt.finishedAt ? new Date(attempt.finishedAt).toLocaleString() : '—'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {activeTab === 'tests' && (
        <div className="stack">
          {tests.map((test) => (
            <div key={test.id} className="card">
              <h3>{test.title}</h3>
              <p>{test.description}</p>
              <p className="muted">
                {test.questionCount} вопросов · {test.isActive ? 'Активен' : 'Неактивен'}
              </p>
              <div className="actions-row">
                <button type="button" onClick={() => beginEdit(test)}>
                  Редактировать
                </button>
                <button type="button" onClick={() => void handleDelete(test.id)}>
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
