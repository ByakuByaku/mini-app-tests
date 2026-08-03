import http from 'k6/http';
import { sleep, check } from 'k6';
import crypto from 'k6/crypto';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export const options = {
  vus: 100,
  duration: '30s',
};

const BOT_TOKEN = __ENV.BOT_TOKEN;

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

  // строка для проверки — отсортированные по ключу параметры
  const dataCheckArr = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`);
  const dataCheckString = dataCheckArr.join('\n');

  // secret_key = HMAC_SHA256("WebAppData", bot_token)
  const secretKey = crypto.hmac('sha256', 'WebAppData', BOT_TOKEN, 'binary');
  const hash = crypto.hmac('sha256', secretKey, dataCheckString, 'hex');

  // собираем query-строку вручную, с encodeURIComponent вместо URLSearchParams
  const queryParts = Object.keys(params).map(
    (key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
  );
  queryParts.push(`hash=${hash}`);

  return queryParts.join('&');
}

export default function () {
  const telegramId = 900000000 + __VU;
  const initData = buildInitData(telegramId);

  const res = http.get('http://localhost:3000/api/tests', {
    headers: { 'x-telegram-init-data': initData },
  });

  check(res, { 'status is 200': (r) => r.status === 200 });

  sleep(randomIntBetween(1, 3));
}