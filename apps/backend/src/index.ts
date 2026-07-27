import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { telegramAuthMiddleware } from './middleware/telegramAuth';
import { requireAdmin } from './middleware/requireAdmin';
import { findUserById } from './modules/users/user.service';
import testRoutes from './modules/tests/test.routes';
import testAdminRoutes from './modules/tests/test.admin.routes';
import { attemptRouter } from './modules/attempts/attempt.routes';

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/me', telegramAuthMiddleware, async (req, res) => {
  const user = await findUserById(req.user!.id);
  res.json({ user });
});

app.get('/api/admin/ping', telegramAuthMiddleware, requireAdmin, (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/tests', telegramAuthMiddleware, testRoutes);
app.use('/api/admin/tests', telegramAuthMiddleware, requireAdmin, testAdminRoutes);
app.use('/api', attemptRouter);

app.listen(port, () => console.log(`Backend running on port ${port}`));