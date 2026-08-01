import { useEffect, useMemo, useState } from 'react';
import type { AdminTestListItemDto, CreateTestInput } from 'shared-types';
import { api } from '../api/client';

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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false;

    return questions.every((question) => {
      if (!question.title.trim()) return false;
      if (question.options.length < 2) return false;
      return question.options.every((option) => option.text.trim());
    });
  }, [questions, title]);

  async function loadTests() {
    try {
      const data = await api.getAdminTests();
      setTests(data.tests);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    }
  }

  useEffect(() => {
    void loadTests();
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

  async function handleCreate() {
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
      await api.createTest(payload);
      setTitle('');
      setDescription('');
      setIsActive(true);
      setTimeLimitSec('');
      setQuestions([createEmptyQuestion(0)]);
      await loadTests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать тест');
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

        <button type="button" className="primary" onClick={() => void handleCreate()} disabled={!canSubmit || saving}>
          {saving ? 'Создаём...' : 'Создать тест'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="stack">
        {tests.map((test) => (
          <div key={test.id} className="card">
            <h3>{test.title}</h3>
            <p>{test.description}</p>
            <p className="muted">
              {test.questionCount} вопросов · {test.isActive ? 'Активен' : 'Неактивен'}
            </p>
            <button type="button" onClick={() => void handleDelete(test.id)}>
              Удалить
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
