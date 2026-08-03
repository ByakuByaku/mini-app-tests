import type {
  AdminTestDetailDto,
  AdminTestListItemDto,
  CreateTestInput,
  QuestionType,
  TestDetailDto,
  TestListItemDto,
  UpdateTestInput,
} from 'shared-types';
import type { AnswerOption, Prisma, Question, Test } from '../../generated/prisma/client';
import { db } from '../../db/client';

type QuestionWithOptions = Question & { options: AnswerOption[] };
type TestWithQuestions = Test & { Questions: QuestionWithOptions[] };

const testInclude = {
  Questions: {
    orderBy: { orderNum: 'asc' as const },
    include: {
      options: {
        orderBy: { orderNum: 'asc' as const },
      },
    },
  },
};

function toStudentListItem(test: Test & { Questions: unknown[] }): TestListItemDto {
  return {
    id: test.id,
    title: test.Title,
    description: test.Description,
    timeLimitSec: test.timeLimitSec,
    questionCount: test.Questions.length,
  };
}

function toAdminListItem(test: Test & { Questions: unknown[] }): AdminTestListItemDto {
  return {
    ...toStudentListItem(test),
    isActive: test.isActive,
    createdAt: test.createdAt.toISOString(),
  };
}

function toStudentDetail(test: TestWithQuestions): TestDetailDto {
  return {
    id: test.id,
    title: test.Title,
    description: test.Description,
    timeLimitSec: test.timeLimitSec,
    questions: test.Questions.map((question) => ({
      id: question.id,
      title: question.title,
      type: question.Type as QuestionType,
      orderNum: question.orderNum,
      options: question.options.map((option) => ({
        id: option.id,
        text: option.text,
        orderNum: option.orderNum,
      })),
    })),
  };
}

function toAdminDetail(test: TestWithQuestions): AdminTestDetailDto {
  return {
    id: test.id,
    title: test.Title,
    description: test.Description,
    isActive: test.isActive,
    timeLimitSec: test.timeLimitSec,
    createdAt: test.createdAt.toISOString(),
    questions: test.Questions.map((question) => ({
      id: question.id,
      title: question.title,
      type: question.Type as QuestionType,
      orderNum: question.orderNum,
      options: question.options.map((option) => ({
        id: option.id,
        text: option.text,
        orderNum: option.orderNum,
        isCorrect: option.isCorrect,
      })),
    })),
  };
}

async function createQuestions(
  tx: Prisma.TransactionClient,
  testId: string,
  questions: CreateTestInput['questions']
) {
  for (const question of questions) {
    const createdQuestion = await tx.question.create({
      data: {
        testId,
        title: question.title,
        Type: question.type,
        orderNum: question.orderNum,
      },
    });

    for (const option of question.options) {
      await tx.answerOption.create({
        data: {
          QuestionId: createdQuestion.id,
          questionId: createdQuestion.id,
          text: option.text,
          isCorrect: option.isCorrect,
          orderNum: option.orderNum,
        },
      });
    }
  }
}

export async function listActiveTests(): Promise<TestListItemDto[]> {
  const tests = await db.test.findMany({
    where: { isActive: true },
    include: testInclude,
    orderBy: { createdAt: 'desc' },
  });

  return tests.map(toStudentListItem);
}

export async function getActiveTestById(id: string): Promise<TestDetailDto | null> {
  const test = await db.test.findFirst({
    where: { id, isActive: true },
    include: testInclude,
  });

  return test ? toStudentDetail(test) : null;
}

export async function listAllTests(): Promise<AdminTestListItemDto[]> {
  const tests = await db.test.findMany({
    include: testInclude,
    orderBy: { createdAt: 'desc' },
  });

  return tests.map(toAdminListItem);
}

export async function getTestById(id: string): Promise<AdminTestDetailDto | null> {
  const test = await db.test.findUnique({
    where: { id },
    include: testInclude,
  });

  return test ? toAdminDetail(test) : null;
}

export async function createTest(
  input: CreateTestInput,
  createdById: string
): Promise<AdminTestDetailDto> {
  const test = await db.$transaction(async (tx) => {
    const created = await tx.test.create({
      data: {
        Title: input.title,
        Description: input.description ?? null,
        isActive: input.isActive ?? true,
        timeLimitSec: input.timeLimitSec ?? null,
        createdById,
      },
    });

    await createQuestions(tx, created.id, input.questions);

    return tx.test.findUniqueOrThrow({
      where: { id: created.id },
      include: testInclude,
    });
  });

  return toAdminDetail(test);
}

export async function updateTest(
  id: string,
  input: UpdateTestInput
): Promise<AdminTestDetailDto | null> {
  const existing = await db.test.findUnique({ where: { id } });
  if (!existing) return null;

  const test = await db.$transaction(async (tx) => {
    if (input.questions) {
      await tx.userAnswer.deleteMany({
        where: {
          question: {
            testId: id,
          },
        },
      });

      await tx.question.deleteMany({ where: { testId: id } });
    }

    await tx.test.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { Title: input.title }),
        ...(input.description !== undefined && { Description: input.description }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.timeLimitSec !== undefined && { timeLimitSec: input.timeLimitSec }),
      },
    });

    if (input.questions) {
      await createQuestions(tx, id, input.questions);
    }

    return tx.test.findUniqueOrThrow({
      where: { id },
      include: testInclude,
    });
  });

  return toAdminDetail(test);
}

export async function deleteTest(id: string): Promise<boolean> {
  const existing = await db.test.findUnique({ where: { id } });
  if (!existing) return false;

  await db.test.delete({ where: { id } });
  return true;
}
