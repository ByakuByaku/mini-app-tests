import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import { PrismaClient } from '../../backend/src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });


const botToken = process.env.BOT_TOKEN;
const miniAppUrl = process.env.MINI_APP_URL ?? 'http://localhost:5174';
console.log(miniAppUrl)

if (!botToken) {
  throw new Error('BOT_TOKEN not set. Add it to apps/bot/.env or parent env file.');
}

const bot = new TelegramBot(botToken, { polling: true });
const ADMIN_TELEGRAM_ID = Number(process.env.ADMIN_TELEGRAM_ID);

const awaitingName = new Set<number>();

async function sendWebAppButton(chatId: number) {
  await bot.sendMessage(chatId, 'Нажми кнопку, чтобы открыть тесты:', {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'Открыть тесты',
            web_app: {
              url: miniAppUrl,
            },
          },
        ],
      ],
    },
  });
}

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = BigInt(msg.from!.id);

  const existingUser = await db.user.findUnique({
    where: { telegramId },
  });

  if (!existingUser) {
    awaitingName.add(chatId);

    await bot.sendMessage(
      chatId,
      'Привет! Для начала напиши своё ФИО полностью (например: Иванов Иван Иванович)'
    );

    return;
  }

  await sendWebAppButton(chatId);
});

bot.onText(/\/rename/, async (msg) => {
  const chatId = msg.chat.id;

  awaitingName.add(chatId);

  await bot.sendMessage(chatId, 'Напиши своё ФИО заново:');
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

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  if (msg.text?.startsWith('/')) return;
  if (!awaitingName.has(chatId)) return;

  const fullName = msg.text?.trim();

  if (!fullName || fullName.length < 5) {
    await bot.sendMessage(
      chatId,
      'Пожалуйста, напиши ФИО полностью, например: Иванов Иван Иванович'
    );
    return;
  }

  const telegramId = BigInt(msg.from!.id);
  const tgUser = msg.from!;

  await db.user.upsert({
    where: { telegramId },
    update: {
      fullName,
      username: tgUser.username,
    },
    create: {
      telegramId,
      username: tgUser.username,
      fullName,
      role: 'STUDENT',
    },
  });

  awaitingName.delete(chatId);

  await bot.sendMessage(chatId, `Спасибо, ${fullName}! Теперь можешь пройти тест.`);

  await sendWebAppButton(chatId);
});


bot.on('polling_error', (error) => {
  console.error('Telegram polling error:', error);
});

console.log('Telegram bot started. Mini App URL:', miniAppUrl);
