import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import { PrismaClient } from '../../backend/src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });


const botToken = process.env.BOT_TOKEN;
const miniAppUrl = process.env.MINI_APP_URL ?? 'http://localhost:5173';

if (!botToken) {
  throw new Error('BOT_TOKEN not set. Add it to apps/bot/.env or parent env file.');
}

const bot = new TelegramBot(botToken, { polling: true });
const ADMIN_TELEGRAM_ID = Number(process.env.ADMIN_TELEGRAM_ID);

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  await bot.sendMessage(chatId, 'Привет! Открой мини‑апп и пройди тесты.', {
    reply_markup: {
      keyboard: [
        [
          {
            text: 'Открыть мини‑апп',
            web_app: {
              url: miniAppUrl,
            },
          },
        ],
      ],
      resize_keyboard: true,
    },
  });
});


bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  if (msg.from?.id !== ADMIN_TELEGRAM_ID) {
    return bot.sendMessage(msg.chat.id, 'Команда недоступна');
  }
  const text = match![1];
  const users = await db.user.findMany({ select: { telegramId: true } });

  await bot.sendMessage(msg.chat.id, `Рассылка начата на ${users.length} пользователей`);

  let sent = 0;
  for (const user of users) {
    try {
      await bot.sendMessage(user.telegramId.toString(), text);
      sent++;
    } catch(err: any) {
      console.error(`Не удалось отправить ${user.telegramId}:`, err.response?.body ?? err.message);
    }
    await new Promise((r) => setTimeout(r, 50));
  }

  await bot.sendMessage(msg.chat.id, `Рассылка завершена. Отправлено: ${sent}/${users.length}`);
});

bot.on('polling_error', (error) => {
  console.error('Telegram polling error:', error);
});

console.log('Telegram bot started. Mini App URL:', miniAppUrl);
