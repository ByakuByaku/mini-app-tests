import { Router, type Response } from 'express';
import { listAdminAttempts } from './attempt.service';
import { exportAttempts } from './export.service';

const router = Router();

router.get('/', async (_req, res: Response) => {
  const attempts = await listAdminAttempts();
  res.json({ attempts });
});
router.get('/export', async (req, res: Response) => {
  await exportAttempts(req.user!.telegramId);

  res.json({
    success: true,
  });
});
export default router;
