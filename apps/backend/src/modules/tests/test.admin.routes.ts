import { Router, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import {
  createTest,
  deleteTest,
  getTestById,
  listAllTests,
  updateTest,
} from './test.service';
import { createTestSchema, updateTestSchema } from './test.validation';

const router = Router();

function handleError(err: unknown, res: Response) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Ошибка валидации',
      details: err.issues,
    });
  }

  throw err;
}

router.get('/', async (_req, res) => {
  const tests = await listAllTests();
  res.json({ tests });
});

router.get('/:id', async (req, res) => {
  const test = await getTestById(req.params.id);
  if (!test) {
    return res.status(404).json({ error: 'Тест не найден' });
  }
  res.json({ test });
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const input = createTestSchema.parse(req.body);
    const test = await createTest(input, req.user!.id);
    res.status(201).json({ test });
  } catch (err) {
    handleError(err, res);
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const input = updateTestSchema.parse(req.body);
    const test = await updateTest(req.params.id, input);
    if (!test) {
      return res.status(404).json({ error: 'Тест не найден' });
    }
    res.json({ test });
  } catch (err) {
    handleError(err, res);
  }
});

router.delete('/:id', async (req, res) => {
  const deleted = await deleteTest(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Тест не найден' });
  }
  res.status(204).send();
});

export default router;
