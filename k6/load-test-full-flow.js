import http from 'k6/http';
import { sleep, check, fail } from 'k6';
import crypto from 'k6/crypto';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export const options = {
  vus: 200,
  duration: '30s',
};

const BOT_TOKEN = __ENV.BOT_TOKEN;
const TEST_ID = __ENV.TEST_ID; // id существующего теста, который будем "проходить"
const BASE_URL = 'http://localhost:3000';

function buildInitData(telegramId) {
  const user = JSON.stringify({
    id: telegramId,
    first_name: 'Load',
    last_name: 'Test',
    username: `loadtest_${telegramId}`,
  });
  const authDate = Math.floor(Date.now() / 1000);

  const params = {
    user: user,
    auth_date: String(authDate),
    query_id: 'loadtest_query',
  };

  const dataCheckArr = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`);
  const dataCheckString = dataCheckArr.join('\n');

  const secretKey = crypto.hmac('sha256', 'WebAppData', BOT_TOKEN, 'binary');
  const hash = crypto.hmac('sha256', secretKey, dataCheckString, 'hex');

  const queryParts = Object.keys(params).map(
    (key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
  );
  queryParts.push(`hash=${hash}`);

  return queryParts.join('&');
}

export default function () {
  // каждая новая итерация — новый "студент" (уникальный telegramId),
  // чтобы не упираться в блокировку "ответ уже отправлен" от предыдущей попытки
  const telegramId = 800000000 + __VU * 100000 + __ITER;
  const initData = buildInitData(telegramId);
  const headers = {
    'Content-Type': 'application/json',
    'x-telegram-init-data': initData,
  };

  // 1. Получаем детали теста с вопросами
  const testRes = http.get(`${BASE_URL}/api/tests/${TEST_ID}`, { headers });
  const testOk = check(testRes, { 'get test: status 200': (r) => r.status === 200 });
  if (!testOk) {
    console.error('get test failed:', testRes.status, testRes.body);
    fail('cannot fetch test');
  }

  const test = JSON.parse(testRes.body).test;
  const questions = test.questions;

  // 2. Стартуем попытку
  const startRes = http.post(`${BASE_URL}/api/tests/${TEST_ID}/start`, null, { headers });
  const startOk = check(startRes, { 'start attempt: status 201': (r) => r.status === 201 });
  if (!startOk) {
    console.error('start failed:', startRes.status, startRes.body);
    fail('cannot start attempt');
  }

  const attemptId = JSON.parse(startRes.body).attempt.id;

  // 3. Отвечаем на каждый вопрос
  for (const question of questions) {
    const selectedOptionIds = [question.options[0].id]; // просто берём первый вариант

    const answerRes = http.post(
      `${BASE_URL}/api/attempts/${attemptId}/answer`,
      JSON.stringify({ questionId: question.id, selectedOptionIds }),
      { headers }
    );

    check(answerRes, { 'submit answer: status 200': (r) => r.status === 200 });

    sleep(randomIntBetween(1, 2)); // имитация времени на раздумья над вопросом
  }

  // 4. Завершаем попытку
  const finishRes = http.post(`${BASE_URL}/api/attempts/${attemptId}/finish`, null, { headers });
  check(finishRes, { 'finish attempt: status 200': (r) => r.status === 200 });

  // 5. Получаем результат
  const resultRes = http.get(`${BASE_URL}/api/attempts/${attemptId}/result`, { headers });
  check(resultRes, { 'get result: status 200': (r) => r.status === 200 });

  sleep(randomIntBetween(1, 3));
}