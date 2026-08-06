import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import { PrismaClient } from '../../backend/src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });
const INSTITUTES = [
  "ИКН",
  "ИНМ",
  "ИТ",
  "ГИ",
  "ИЭУ",
  "ИФКИ",
  "ИБО",
  "БиоИНЖ"
];

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

function buildInstituteKeyboard() {
  return {
    reply_markup: {
      keyboard: INSTITUTES.map((name) => [{ text: name }]),
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  };
}


async function promptCurrentStep(chatId: number, step: string) {
  if (step === 'AWAITING_NAME') {
    await bot.sendMessage(chatId, 'Напиши своё ФИО полностью:', {
      reply_markup: { remove_keyboard: true },
    });
  } else if (step === 'AWAITING_INSTITUTE') {
    await bot.sendMessage(chatId, 'Выбери свой институт:', buildInstituteKeyboard());
  } else if (step === 'AWAITING_STUDENT_ID') {
    await bot.sendMessage(chatId, 'Напиши свой студенческий билет (например: 2401011):', {
      reply_markup: { remove_keyboard: true },
    });
  }
}

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = BigInt(msg.from!.id);

  const existingUser = await db.user.findUnique({
    where: { telegramId },
  });

  if (!existingUser) {
    await db.user.create({
      data: {
        telegramId,
        username: msg.from!.username,
        fullName: '',
        onboardingStep: 'AWAITING_NAME',
        role: 'STUDENT'
      },
    })
    await bot.sendMessage(chatId, 'Привет! Напиши своё ФИО полностью (например: Иванов Иван Иванович)', {
      reply_markup: { remove_keyboard: true },
    });
    return;
  }
  if (existingUser.onboardingStep !== 'COMPLETED') {
    await promptCurrentStep(chatId, existingUser.onboardingStep);
    return;
  }

  await sendWebAppButton(chatId);
});


bot.onText(/\/restart/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = BigInt(msg.from!.id);

  await db.user.update({
    where: { telegramId },
    data: { onboardingStep: 'AWAITING_NAME' },
  });
  await bot.sendMessage(chatId, 'Хорошо, пройдём регистрацию заново. Напиши своё ФИО полностью:', {
    reply_markup: { remove_keyboard: true },
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

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  if (!text || text.startsWith('/')) return;


  const telegramId = BigInt(msg.from!.id);
  const tgUser = await db.user.findUnique({ where: { telegramId } });

  if (!tgUser || tgUser.onboardingStep === 'COMPLETED')
    return;

  if (tgUser.onboardingStep === 'AWAITING_NAME') {
    if (text.length < 5) {
      await bot.sendMessage(chatId, 'Пожалуйста, напиши ФИО полностью, например: Иванов Иван Иванович');
      return;
    }

    await db.user.update({
      where: { telegramId },
      data: { fullName: text, onboardingStep: 'AWAITING_INSTITUTE' },
    });
    await bot.sendMessage(chatId, `Спасибо, ${text}! Теперь выбери свой институт:`, buildInstituteKeyboard());
    return;
  }
  if (tgUser.onboardingStep === 'AWAITING_INSTITUTE') {
    if (!INSTITUTES.includes(text)) {
      await bot.sendMessage(chatId, 'Пожалуйста, выбери институт кнопкой из списка ниже', buildInstituteKeyboard());
      return;
    }
    await db.user.update({
      where: { telegramId },
      data: { institute: text, onboardingStep: 'AWAITING_STUDENT_ID' },
    });
    await bot.sendMessage(chatId, 'Теперь напиши номер своего студенческого билета:', {
      reply_markup: { remove_keyboard: true },
    });
    return;
  }

  if (tgUser.onboardingStep === 'AWAITING_STUDENT_ID') {
    if (text.length !==7 ) {
      await bot.sendMessage(chatId, 'Похоже на некорректный номер, проверь и напиши ещё раз');
      return;
    }
    await db.user.update({
      where: { telegramId },
      data: { studentId: text, onboardingStep: 'COMPLETED' },
    });

    await bot.sendMessage(chatId, 'Отлично, регистрация завершена! Теперь можешь пройти тест.');
    await sendWebAppButton(chatId);
    return;
  }
});


bot.on('polling_error', (error) => {
  console.error('Telegram polling error:', error);
});

console.log('Telegram bot started. Mini App URL:', miniAppUrl);
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});