# Calories Frontend

PWA-клиент для трекера набора веса с реальной интеграцией с backend API.

## Стек
- Next.js (App Router) + TypeScript
- Tailwind CSS
- React Query
- Zustand (локальное состояние unlock + настройки биометрии)

## Что реализовано
- Backend auth: `bootstrap`, `passcode/login`, `webauthn/verify`, `logout`.
- AI-анализ блюда через `POST /api/v1/meals/analyze`.
- CRUD записи еды через backend API.
- Экран `Сегодня` на `GET /api/v1/days/:date`.
- Экран `Календарь` на `GET /api/v1/calendar`.
- PWA-заготовка: `manifest.webmanifest`, базовый `sw.js`.

## Конфиг окружения
Создай `.env.local` в `calories-frontend`:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:3232/api/v1
```

## Локальный запуск
```bash
npm install
npm run dev
```
