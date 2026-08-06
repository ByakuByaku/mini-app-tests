import { listAdminAttempts } from './attempt.service';
import ExcelJS from 'exceljs';
import axios from 'axios';
import FormData from 'form-data';


export async function exportAttempts(telegramId: string) {
    const attempts = await listAdminAttempts();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Результаты');
    const testTitles = [...new Set(attempts.map((a) => a.test.title))];
    const testMaxScores = new Map<string, number>();

    for (const attempt of attempts) {
      const current = testMaxScores.get(attempt.test.title) ?? 0;
      testMaxScores.set(
        attempt.test.title,
        Math.max(current, attempt.maxScore ?? 0)
      );
    }
    const users = new Map<
    string,
    {
      fullName: string;
      institute: string | null;
      studentId: string | null;
      tests: Record<string, string>;
      totalScore: number;
    }
    >();
    for (const attempt of attempts) {
    const userKey = attempt.user.id;

    if (!users.has(userKey)) {
      users.set(userKey, {
        fullName: attempt.user.fullName,
        institute: attempt.user.institute,
        studentId: attempt.user.studentId,
        tests: {},
        totalScore: 0,
      });
    }
    const user = users.get(userKey)!;

    const score = attempt.score ?? 0;
    const maxScore = attempt.maxScore ?? 0;
    user.tests[attempt.test.title] = `${score}/${maxScore}`;
    user.totalScore += score;
  }

  sheet.addRow([
    'ФИО',
    'Институт',
    '№ студенческого билета',
    ...testTitles,
    'Сумма',
    'Процент',
  ]);

  sheet.getRow(1).font = {
    bold: true,
  };
  const overallMaxScore = Array.from(testMaxScores.values()).reduce(
    (sum, value) => sum + value,
    0
  );
  for (const user of users.values()) {
    sheet.addRow([
      user.fullName,
      user.institute ?? '—',
      user.studentId ?? '—',
      ...testTitles.map((title) => user.tests[title] ?? '—'),
      `${user.totalScore}/${overallMaxScore}`,
      overallMaxScore === 0
        ? '0%'
        : `${Math.round((user.totalScore / overallMaxScore) * 100)}%`,
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
