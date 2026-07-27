import { Router, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { telegramAuthMiddleware } from '../../middleware/telegramAuth';
import {
  AttemptError,
  finishAttempt,
  getAttemptResult,
  startAttempt,
  submitAnswer,
} from './attempt.service';
import { submitAnswerSchema } from './attempt.validation';

export const attemptRouter = Router();
attemptRouter.use(telegramAuthMiddleware);

function handleError(err: unknown, res: Response) {
  if (err instanceof AttemptError) {
    return res.status(err.status).json({ error: err.message });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Ошибка валидации',
      details: err.issues,
    });
  }

  throw err;
}

function param(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

attemptRouter.post('/tests/:id/start', async (req: Request, res: Response) => {
  try {
    const attempt = await startAttempt(req.user!.id, param(req.params.id));
    res.status(201).json({ attempt });
  } catch (err) {
    handleError(err, res);
  }
});

attemptRouter.post('/attempts/:id/answer', async (req: Request, res: Response) => {
  try {
    const { questionId, selectedOptionIds } = submitAnswerSchema.parse(req.body);
    const answer = await submitAnswer(
      param(req.params.id),
      req.user!.id,
      questionId,
      selectedOptionIds
    );
    res.json({ answer });
  } catch (err) {
    handleError(err, res);
  }
});

attemptRouter.post('/attempts/:id/finish', async (req: Request, res: Response) => {
  try {
    const attempt = await finishAttempt(param(req.params.id), req.user!.id);
    res.json({ attempt });
  } catch (err) {
    handleError(err, res);
  }
});

attemptRouter.get('/attempts/:id/result', async (req: Request, res: Response) => {
  try {
    const result = await getAttemptResult(param(req.params.id), req.user!.id);
    res.json({ result });
  } catch (err) {
    handleError(err, res);
  }
});
