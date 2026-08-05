import { listAdminAttempts } from './attempt.service';
import ExcelJS from 'exceljs';
import axios from 'axios';
import FormData from 'form-data';


export async function exportAttempts(telegramId: string) {
    const attempts = await listAdminAttempts();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Результаты');
    const testTitles = [...new Set(attempts.map((a) => a.test.title))];
    const users = new Map<
    string,
    {
      fullName: string;
      tests: Record<string, string>;
      totalScore: number;
      totalMaxScore: number;
    }
    >();
    for (const attempt of attempts) {
    const userKey = attempt.user.id;

    if (!users.has(userKey)) {
      users.set(userKey, {
        fullName: attempt.user.fullName,
        tests: {},
        totalScore: 0,
        totalMaxScore: 0,
      });
    }
    const user = users.get(userKey)!;

    const score = attempt.score ?? 0;
    const maxScore = attempt.maxScore ?? 0;

    user.tests[attempt.test.title] = `${score}/${maxScore}`;
    user.totalScore += score;
    user.totalMaxScore += maxScore;
  }

  sheet.addRow([
    'ФИО',
    ...testTitles,
    'Сумма',
    'Процент',
  ]);

  sheet.getRow(1).font = {
    bold: true,
  };

  for (const user of users.values()) {
    sheet.addRow([
      user.fullName,
      ...testTitles.map((title) => user.tests[title] ?? '—'),
      `${user.totalScore}/${user.totalMaxScore}`,
      user.totalMaxScore === 0
        ? '0%'
        : `${Math.round((user.totalScore / user.totalMaxScore) * 100)}%`,
    ]);
  }

  sheet.columns.forEach((column) => {
    let maxLength = 10;

    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const value = cell.value?.toString() ?? '';
      maxLength = Math.max(maxLength, value.length + 2);
    });

    column.width = maxLength;
  });

  sheet.views = [
    {
      state: 'frozen',
      ySplit: 1,
    },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  const form = new FormData();
  form.append('chat_id', telegramId.toString());
  form.append('document', buffer, {
  filename: 'results.xlsx',
  contentType:
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  try {
  await axios.post(
    `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendDocument`,
    form,
    {
      headers: form.getHeaders(),
    }
  );
    } catch (error: any) {
  console.log(
    'Telegram error:',
    error.response?.data
  );

  throw error;
    }
}
