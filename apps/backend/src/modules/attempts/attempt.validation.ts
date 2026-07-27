import { z } from 'zod';

export const submitAnswerSchema = z.object({
  questionId: z.string().uuid('Некорректный questionId'),
  selectedOptionIds: z
    .array(z.string().uuid('Некорректный optionId'))
    .min(1, 'Выберите хотя бы один вариант'),
});

export type SubmitAnswerBody = z.infer<typeof submitAnswerSchema>;
