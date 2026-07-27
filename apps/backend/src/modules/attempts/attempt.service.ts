import type { AttemptStatus, TestAttempt } from '../../generated/prisma/client';
import { db } from '../../db/client';

export class AttemptError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'AttemptError';
  }
}

function serializeAttempt(attempt: TestAttempt) {
  return {
    id: attempt.id,
    userId: attempt.userId,
    testId: attempt.testId,
    status: attempt.status,
    startedAt: attempt.startedAt.toISOString(),
    finishedAt: attempt.finishedAt?.toISOString() ?? null,
    score: attempt.score,
    maxScore: attempt.maxScore,
  };
}

function isTimeExpired(startedAt: Date, timeLimitSec: number | null | undefined): boolean {
  if (!timeLimitSec) return false;
  const elapsedSec = (Date.now() - startedAt.getTime()) / 1000;
  return elapsedSec > timeLimitSec;
}

async function getOwnedAttempt(attemptId: string, userId: string) {
  const attempt = await db.testAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt) {
    throw new AttemptError('Попытка не найдена', 404);
  }
  if (attempt.userId !== userId) {
    throw new AttemptError('Нет доступа к этой попытке', 403);
  }
  return attempt;
}

async function scoreAndCloseAttempt(
  attemptId: string,
  status: AttemptStatus
): Promise<TestAttempt> {
  const attempt = await db.testAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: {
      answers: true,
      test: {
        include: {
          Questions: {
            include: { options: true },
          },
        },
      },
    },
  });

  if (attempt.status !== 'IN_PROGRESS') {
    return attempt;
  }

  let score = 0;
  const maxScore = attempt.test.Questions.length;

  for (const question of attempt.test.Questions) {
    const userAnswer = attempt.answers.find((a) => a.questionId === question.id);
    const correctOptionIds = question.options
      .filter((o) => o.isCorrect)
      .map((o) => o.id)
      .sort();

    let isCorrect = false;
    if (userAnswer) {
      const selectedSorted = [...userAnswer.selectedOptionId].sort();
      isCorrect =
        correctOptionIds.length === selectedSorted.length &&
        correctOptionIds.every((id, i) => id === selectedSorted[i]);

      await db.userAnswer.update({
        where: { id: userAnswer.id },
        data: { isCorrect },
      });
    }

    if (isCorrect) score++;
  }

  return db.testAttempt.update({
    where: { id: attemptId },
    data: {
      status,
      finishedAt: new Date(),
      score,
      maxScore,
    },
  });
}

/** Если время вышло — закрывает попытку как EXPIRED и возвращает её. */
async function closeIfExpired(attempt: TestAttempt): Promise<TestAttempt> {
  if (attempt.status !== 'IN_PROGRESS') {
    return attempt;
  }

  const test = await db.test.findUniqueOrThrow({
    where: { id: attempt.testId },
    select: { timeLimitSec: true },
  });

  if (!isTimeExpired(attempt.startedAt, test.timeLimitSec)) {
    return attempt;
  }

  return scoreAndCloseAttempt(attempt.id, 'EXPIRED');
}

async function requireInProgressAttempt(attemptId: string, userId: string) {
  const owned = await getOwnedAttempt(attemptId, userId);
  const attempt = await closeIfExpired(owned);

  if (attempt.status !== 'IN_PROGRESS') {
    throw new AttemptError(
      attempt.status === 'EXPIRED'
        ? 'Время на прохождение истекло'
        : 'Попытка уже завершена',
      400
    );
  }

  return attempt;
}

export async function startAttempt(userId: string, testId: string) {
  const test = await db.test.findFirst({
    where: { id: testId, isActive: true },
  });
  if (!test) {
    throw new AttemptError('Тест не найден или неактивен', 404);
  }

  const existing = await db.testAttempt.findFirst({
    where: { userId, testId, status: 'IN_PROGRESS' },
  });

  if (existing) {
    const attempt = await closeIfExpired(existing);
    if (attempt.status === 'IN_PROGRESS') {
      return serializeAttempt(attempt);
    }
    // Просроченная закрыта — создаём новую ниже
  }

  const attempt = await db.testAttempt.create({
    data: { userId, testId, status: 'IN_PROGRESS' },
  });

  return serializeAttempt(attempt);
}

export async function submitAnswer(
  attemptId: string,
  userId: string,
  questionId: string,
  selectedOptionIds: string[]
) {
  const attempt = await requireInProgressAttempt(attemptId, userId);

  const question = await db.question.findFirst({
    where: { id: questionId, testId: attempt.testId },
  });
  if (!question) {
    throw new AttemptError('Вопрос не относится к этому тесту', 400);
  }

  const existingAnswer = await db.userAnswer.findUnique({
    where: { attemptId_questionId: { attemptId, questionId } },
  });
  if (existingAnswer) {
    throw new AttemptError('Ответ на этот вопрос уже отправлен', 400);
  }

  const answer = await db.userAnswer.create({
    data: {
      attemptId,
      questionId,
      selectedOptionId: selectedOptionIds,
    },
  });

  return {
    id: answer.id,
    attemptId: answer.attemptId,
    questionId: answer.questionId,
    selectedOptionIds: answer.selectedOptionId,
    isCorrect: answer.isCorrect,
  };
}

export async function finishAttempt(attemptId: string, userId: string) {
  const owned = await getOwnedAttempt(attemptId, userId);
  const attempt = await closeIfExpired(owned);

  if (attempt.status !== 'IN_PROGRESS') {
    return serializeAttempt(attempt);
  }

  const updated = await scoreAndCloseAttempt(attempt.id, 'FINISHED');
  return serializeAttempt(updated);
}

export async function getAttemptResult(attemptId: string, userId: string) {
  const owned = await getOwnedAttempt(attemptId, userId);
  await closeIfExpired(owned);

  const result = await db.testAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: {
      answers: {
        include: {
          question: {
            include: { options: true },
          },
        },
      },
    },
  });

  return {
    id: result.id,
    testId: result.testId,
    status: result.status,
    startedAt: result.startedAt.toISOString(),
    finishedAt: result.finishedAt?.toISOString() ?? null,
    score: result.score,
    maxScore: result.maxScore,
    answers: result.answers.map((answer) => ({
      id: answer.id,
      questionId: answer.questionId,
      selectedOptionIds: answer.selectedOptionId,
      isCorrect: answer.isCorrect,
      question: {
        id: answer.question.id,
        type: answer.question.Type,
        orderNum: answer.question.orderNum,
        options: answer.question.options.map((option) => ({
          id: option.id,
          text: option.text,
          orderNum: option.orderNum,
          isCorrect: option.isCorrect,
        })),
      },
    })),
  };
}
