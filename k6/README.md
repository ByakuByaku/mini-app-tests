# Нагрузочное тестирование

Запуск:
\`\`\`
k6 run -e BOT_TOKEN=<токен> k6/load-test.js
k6 run -e BOT_TOKEN=<токен> -e TEST_ID=<id_теста> k6/load-test-full-flow.js
\`\`\`