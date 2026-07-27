import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { upsertFromTelegram } from '../modules/users/user.service';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

// Расширяем тип Express Request, чтобы req.user был доступен во всех роутах
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        telegramId: string;
        role: 'STUDENT' | 'ADMIN';
      };
    }
  }
}

function validateInitData(initData: string): TelegramUser | null {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    throw new Error('BOT_TOKEN не задан в переменных окружения');
  }

  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  if (!hash) return null;

  urlParams.delete('hash');

  // Собираем строку для проверки — все параметры, кроме hash, отсортированные по ключу
  const dataCheckArr: string[] = [];
  urlParams.forEach((value, key) => {
    dataCheckArr.push(`${key}=${value}`);
  });
  dataCheckArr.sort();
  const dataCheckString = dataCheckArr.join('\n');

  // secret_key = HMAC_SHA256("WebAppData", bot_token)
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (computedHash !== hash) {
    return null; // подпись не совпала — данные подделаны или устарел формат
  }

  // Проверка свежести — initData не должен быть старше часа
  const authDate = Number(urlParams.get('auth_date'));
  const MAX_AGE_SECONDS = 3600;
  if (Date.now() / 1000 - authDate > MAX_AGE_SECONDS) {
    return null;
  }

  const userJson = urlParams.get('user');
  if (!userJson) return null;

  return JSON.parse(userJson) as TelegramUser;
}

export async function telegramAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const initData = req.headers['x-telegram-init-data'] as string | undefined;

  if (!initData) {
    return res.status(401).json({ error: 'Отсутствует initData' });
  }

  const tgUser = validateInitData(initData);
  if (!tgUser) {
    return res.status(401).json({ error: 'Невалидный initData' });
  }

  const user = await upsertFromTelegram(tgUser);

  req.user = user;

  next();
}