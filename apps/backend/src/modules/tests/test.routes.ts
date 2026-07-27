import { Router } from 'express';
import { getActiveTestById, listActiveTests } from './test.service';

const router = Router();

router.get('/', async (_req, res) => {
  const tests = await listActiveTests();
  res.json({ tests });
});

router.get('/:id', async (req, res) => {
  const test = await getActiveTestById(req.params.id);
  if (!test) {
    return res.status(404).json({ error: 'Тест не найден' });
  }
  res.json({ test });
});

export default router;
