# Calories Backend

NestJS backend для трекера набора веса по фото еды.

## Что реализовано
- `TypeORM + PostgreSQL` модель данных под MVP (`users`, `auth_passcodes`, `sessions`, `meal_entries`, `meal_photos`, `auth_webauthn_credentials`).
- Auth-flow по docs:
  - `POST /api/v1/auth/bootstrap`
  - `POST /api/v1/auth/passcode/login`
  - `POST /api/v1/auth/webauthn/options` (stub)
  - `POST /api/v1/auth/webauthn/verify` (stub)
  - `POST /api/v1/auth/refresh`
  - `POST /api/v1/auth/logout`
- JWT access token + refresh token в `HttpOnly` cookie с rotation.
- Upload фото на сервер (`/uploads/meals/*`) и хранение пути в БД (`meal_photos.storage_key`).
- Интеграция с GPT-proxy микросервисом (`AI_MICROSERVICE_URL`, по умолчанию `http://150.241.91.222:3666/`):
  - `POST /api/v1/meals/analyze` принимает `multipart/form-data` (`photo`, `comment?`),
  - backend отправляет в proxy запрос в формате `input + stream:false` и фото как `data:image/*;base64`,
  - если микросервис недоступен или ответ невалиден, включается fallback-оценка.
- CRUD meals:
  - `POST /api/v1/meals`
  - `PATCH /api/v1/meals/:id`
  - `DELETE /api/v1/meals/:id`
  - `GET /api/v1/meals/:id`
- Календарь и день:
  - `GET /api/v1/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD`
  - `GET /api/v1/days/:date`
- Health-check: `GET /api/v1/health`.

## Локальный запуск
```bash
npm install
cp .env.example .env
npm run start:dev
```

Backend стартует на `http://localhost:3232`, API под префиксом `/api/v1`.

## Env переменные
Смотри `.env.example`.
Критично задать:
- PostgreSQL (`DATABASE_URL` или `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME`)
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`

## Upload файлов
- Файлы хранятся локально в `uploads/meals/`.
- Раздаются как статика по пути `/uploads/...`.
- В БД сохраняется относительный storage key (`meals/<filename>`).

## Команды
```bash
npm run build
npm run lint
npm run test
npm run test:e2e
```

`test:e2e` требует доступный PostgreSQL (потому что используется полный `AppModule` с TypeORM).
