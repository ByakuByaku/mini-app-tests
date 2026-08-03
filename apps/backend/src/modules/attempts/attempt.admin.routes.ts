import { Router, type Response } from 'express';
import { listAdminAttempts } from './attempt.service';

const router = Router();

router.get('/', async (_req, res: Response) => {
  const attempts = await listAdminAttempts();
  res.json({ attempts });
});

export default router;
