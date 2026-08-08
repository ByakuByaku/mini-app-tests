# Mini App Tests

Telegram-бот и мини-приложение для прохождения тестов в школе наставничества НИТУ МИСИС.

## Описание

Студент регистрируется в боте, проходит короткую анкету (ФИО, институт, номер студенческого) и получает доступ к тестам через Telegram Mini App. Куратор управляет тестами и результатами через встроенную админ-панель.

## Возможности

**Для студентов**
- Регистрация через бота
- Прохождение тестов с таймером

- Мгновенный результат с разбором ответов

**Для администратора**
- Создание и редактирование тестов (вопросы с одним или несколькими правильными вариантами)
- Просмотр всех попыток прохождения, поиск по студенту
- Выгрузка результатов в Excel
- Рассылка сообщений всем пользователям

## Скриншоты
## Скриншоты

<p align="center">
  <b>Регистрация в боте</b>
</p>
<p align="center">
  <img width="350" alt="Регистрация в боте" src="https://github.com/user-attachments/assets/9a43ad89-ba19-4aae-9249-b3f923462a00" />
</p>

<br/>

<p align="center">
  <b>Прохождение теста</b>
</p>
<p align="center">
  <img width="350" alt="Прохождение теста" src="https://github.com/user-attachments/assets/32781e77-aa0f-4081-a039-c1b142c95c4d" />
</p>


<br/>

<p align="center">
  <b>Админ-панель</b>
</p>

<p align = "center">
  <img width="350" height="508" alt="Снимок экрана 2026-08-08 220006" src="https://github.com/user-attachments/assets/fa411ae6-d7fc-43ac-820d-1cc5ba110f1b" />
</p>
<br/>
<p align = "center">
  <img width="350" height="509" alt="Снимок экрана 2026-08-08 220628" src="https://github.com/user-attachments/assets/53545ace-1188-4040-831f-b04559051e38" />
</p>


## Стек

Node.js, TypeScript, Express, Prisma, PostgreSQL, React, Vite

## Структура

```
apps/
├── backend/   — REST API
├── bot/       — Telegram-бот
└── webapp/    — Mini App (React)
packages/
└── shared-types/
```

## Быстрый старт

```bash
git clone <repo_url>
cd mini-app-tests
npm install
```

### Переменные окружения

**apps/backend/.env.example**
```
DATABASE_URL="postgresql://user:password@localhost:5432/mini_app_tests?schema=public"
BOT_TOKEN=""
PORT=3000
```

**apps/bot/.env.example**
```
BOT_TOKEN=""
DATABASE_URL="postgresql://user:password@localhost:5432/mini_app_tests?schema=public"
MINI_APP_URL="http://localhost:5173"
ADMIN_TELEGRAM_ID=""
```

**apps/webapp/.env.example**
```
VITE_API_URL="http://localhost:3000"
```

Скопируй каждый файл в `.env` и заполни своими значениями.

### База данных

```bash
cd apps/backend
npx prisma migrate deploy
npx prisma generate
```

### Запуск

Каждый сервис — в своём терминале:
```bash
cd apps/backend && npm run dev
cd apps/bot && npm run dev
cd apps/webapp && npm run dev
```

Первому зарегистрированному пользователю нужно вручную выдать роль администратора через Prisma Studio (`npx prisma studio`, таблица `User`, поле `role`).

## API
 
Все эндпоинты требуют заголовок `x-telegram-init-data` с подписанной строкой от Telegram Mini App.
 
**Пользователь**
 
| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/me` | Текущий пользователь |
| GET | `/api/admin/ping` | Проверка прав администратора |
 
**Тесты**
 
| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/tests` | Список активных тестов |
| GET | `/api/tests/:id` | Тест с вопросами |
 
**Тесты (администратор)**
 
| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/admin/tests` | Все тесты, включая неактивные |
| GET | `/api/admin/tests/:id` | Тест целиком, с правильными ответами |
| POST | `/api/admin/tests` | Создать тест |
| PATCH | `/api/admin/tests/:id` | Обновить тест |
| DELETE | `/api/admin/tests/:id` | Удалить тест |
 
**Прохождение теста**
 
| Метод | Путь | Описание |
|---|---|---|
| POST | `/api/tests/:id/start` | Начать попытку |
| POST | `/api/attempts/:id/answer` | Отправить ответ на вопрос |
| POST | `/api/attempts/:id/finish` | Завершить попытку |
| GET | `/api/attempts/:id/result` | Результат попытки |

## Команды бота

| Команда | Описание |
|---|---|
| `/start` | Начать регистрацию или открыть меню |
| `/restart` | Начать регистрацию заново |
| `/broadcast <текст>` | Рассылка всем пользователям (только для админа) |<img width="625" height="492" alt="Снимок экрана 2026-08-08 214546" src="https://github.com/user-attachments/assets/4f8406d6-e770-4ea8-abe0-a772d8d8d1f2" />
