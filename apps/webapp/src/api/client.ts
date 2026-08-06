import WebApp from '@twa-dev/sdk';
import type {
  AdminTestDetailDto,
  AdminTestListItemDto,
  CreateTestInput,
  TestDetailDto,
  TestListItemDto,
} from 'shared-types';

const BASE_URL = '';

function getInitData(): string {
  if (WebApp.initData) return WebApp.initData;
  return import.meta.env.VITE_DEV_INIT_DATA ?? '';
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-init-data': getInitData(),
      ...options.headers,
    },
  });

  if (!res.ok) {
    let message = `API error: ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
    }
    throw new ApiError(message, res.status);
  }

  const text = await res.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

export type AttemptDto = {
  id: string;
  userId: string;
  testId: string;
  status: 'IN_PROGRESS' | 'FINISHED' | 'EXPIRED';
  startedAt: string;
  finishedAt: string | null;
  score: number | null;
  maxScore: number | null;
};

export type AdminAttemptListItemDto = {
  id: string;
  userId: string;
  testId: string;
  status: AttemptDto['status'];
  startedAt: string;
  finishedAt: string | null;
  score: number | null;
  maxScore: number | null;
  user: {
    id: string;
    fullName: string;
    username: string | null;
    institute: string | null;
    studentIdCard: string | null;
  };
  test: {
    id: string;
    title: string;
  };
};

export type AttemptResultDto = {
  id: string;
  testId: string;
  status: AttemptDto['status'];
  startedAt: string;
  finishedAt: string | null;
  score: number | null;
  maxScore: number | null;
  answers: Array<{
    id: string;
    questionId: string;
    selectedOptionIds: string[];
    isCorrect: boolean;
    question: {
      id: string;
      title: string;
      type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE';
      orderNum: number;
      options: Array<{
        id: string;
        text: string;
        orderNum: number;
        isCorrect: boolean;
      }>;
    };
  }>;
};

export const api = {
  getMe: () =>
    request<{ user: { id: string; telegramId: string; username: string | null; fullName: string; role: 'STUDENT' | 'ADMIN'; createdAt: string } }>('/api/me'),

  getTests: () => request<{ tests: TestListItemDto[] }>('/api/tests'),

  getAdminTests: () => request<{ tests: AdminTestListItemDto[] }>('/api/admin/tests'),
  getAdminAttempts: () => request<{ attempts: AdminAttemptListItemDto[] }>('/api/admin/attempts'),
  downloadResults: async () => {
  const res = await fetch(`${BASE_URL}/api/admin/attempts/export`, {
    method: 'GET',
    headers: {
      'x-telegram-init-data': getInitData(),
    },
  });
  
  if (!res.ok) {
    throw new Error('Ошибка экспорта');
  }
  return res.json();
  },

  getTest: (testId: string) =>
    request<{ test: TestDetailDto }>(`/api/tests/${testId}`),

  getAdminTest: (testId: string) =>
    request<{ test: AdminTestDetailDto }>(`/api/admin/tests/${testId}`),

  createTest: (payload: CreateTestInput) =>
    request<{ test: AdminTestDetailDto }>('/api/admin/tests', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateTest: (testId: string, payload: Partial<CreateTestInput>) =>
    request<{ test: AdminTestDetailDto }>(`/api/admin/tests/${testId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteTest: (testId: string) =>
    request<void>(`/api/admin/tests/${testId}`, {
      method: 'DELETE',
    }),

  startAttempt: (testId: string) =>
    request<{ attempt: AttemptDto }>(`/api/tests/${testId}/start`, {
      method: 'POST',
    }),

  submitAnswer: (attemptId: string, questionId: string, selectedOptionIds: string[]) =>
    request<{ answer: unknown }>(`/api/attempts/${attemptId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ questionId, selectedOptionIds }),
    }),

  finishAttempt: (attemptId: string) =>
    request<{ attempt: AttemptDto }>(`/api/attempts/${attemptId}/finish`, {
      method: 'POST',
    }),

  getResult: (attemptId: string) =>
    request<{ result: AttemptResultDto }>(`/api/attempts/${attemptId}/result`),
};
