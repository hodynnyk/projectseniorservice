# Architecture · projectseniorservice v8

## Interfaces

- Telegram Bot: розмовний інтерфейс Соні.
- Telegram Mini App: сімейна панель задач, пам’яті, файлів-карток, пошти.
- Web Admin: ключі, users, Family reset, Telegram webhook, logs, modules, backup.

## Storage

- KV `SONYA_KV`: головний runtime storage для settings/users/sessions/items/activity.
- D1 `DB`: підключений для наступної SQL-еволюції, але v8 все ще KV-first для стабільного deploy.
- R2: відключений. Binary-файли не зберігаються.

## AI behavior

- GPT через OpenAI API для відповідей.
- Weather через окремий tool, не через вигадування GPT.
- Life Inbox не зберігає все автоматично. Автозбереження тільки при явному намірі: “запиши”, “збережи”, “додай”, “нагадай”, “створи”.
- Якщо текст схожий на запис, але намір не явний, Соня уточнює.

## Owner persona

Owner отримує окремий стиль: коротко, тепло, персонально, з делікатними звертаннями “сер/господин”. Після довгої паузи Соня вітається. Family user отримує нейтральний сімейний стиль.

## Telegram

- `setWebhook` доступний з Admin → API Keys.
- Voice/audio вимкнено.
- Photo/document не скачуються. Якщо Owner просить зберегти, створюється metadata-card із Telegram file_id.

## Family reset

Endpoint: `POST /api/admin/users/family/reset`.

Modes:

- `safe`: очищає приватні Family дані, Telegram link, sessions.
- `hard`: очищає також shared objects, створені Family.
