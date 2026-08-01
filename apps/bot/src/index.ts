import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';

config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const botToken = process.env.BOT_TOKEN;
const miniAppUrl = process.env.MINI_APP_URL ?? 'http://localhost:5173';

if (!botToken) {
  throw new Error('BOT_TOKEN not set. Add it to apps/bot/.env or parent env file.');
}

const bot = new TelegramBot(botToken, { polling: true });

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

bot.on('polling_error', (error) => {
  console.error('Telegram polling error:', error);
});

console.log('Telegram bot started. Mini App URL:', miniAppUrl);
