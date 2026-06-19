# Architecture · Соня v10

Cloudflare Worker є єдиним ядром для трьох інтерфейсів:

- Telegram Bot webhook.
- Telegram Mini App HTML panel.
- Web Admin panel.

Сховище:

- KV `SONYA_KV` — основний lightweight state.
- D1 `DB` — підготовлений binding для майбутнього структурного розширення.
- R2 — вимкнено за політикою Owner.

AI:

- OpenAI / GPT — primary brain.
- Gemini — sidecar provider, запускається тільки за явним Gemini intent або через кнопку тесту.
- Weather — окремий tool, не вигадується GPT.

UI:

- Admin v10 має Sonya Center, speech bubble, provider statuses і дружній key manager.
- Mini App v10 має центральний блок Соні та не зберігає дані без явного наміру.
