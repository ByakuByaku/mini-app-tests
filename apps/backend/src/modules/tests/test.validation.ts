import { z } from 'zod';

export const questionTypeSchema = z.enum(['SINGLE_CHOICE', 'MULTIPLE_CHOICE']);

export const createAnswerOptionSchema = z.object({
  text: z.string().trim().min(1, 'Текст ответа обязателен').max(500),
  isCorrect: z.boolean(),
  orderNum: z.number().int().min(0),
});

export const createQuestionSchema = z
  .object({
    title: z.string().trim().min(1, 'Название вопроса обязательно').max(500),
    type: questionTypeSchema,
    orderNum: z.number().int().min(0),
    options: z.array(createAnswerOptionSchema).min(2, 'Минимум 2 варианта ответа'),
  })
  .superRefine((question, ctx) => {
    const correctCount = question.options.filter((o) => o.isCorrect).length;

    if (question.type === 'SINGLE_CHOICE' && correctCount !== 1) {
      ctx.addIssue({
        code: 'custom',
        message: 'Для SINGLE_CHOICE ровно один правильный ответ',
        path: ['options'],
      });
    }

    if (question.type === 'MULTIPLE_CHOICE' && correctCount < 1) {
      ctx.addIssue({
        code: 'custom',
        message: 'Для MULTIPLE_CHOICE нужен хотя бы один правильный ответ',
        path: ['options'],
      });
    }
  });

export const createTestSchema = z.object({
  title: z.string().trim().min(1, 'Название обязательно').max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
  timeLimitSec: z.number().int().positive().nullable().optional(),
  questions: z.array(createQuestionSchema).min(1, 'Добавьте хотя бы один вопрос'),
});

export const updateTestSchema = createTestSchema.partial();

export type CreateTestBody = z.infer<typeof createTestSchema>;
export type UpdateTestBody = z.infer<typeof updateTestSchema>;
