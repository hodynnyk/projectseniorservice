# Setup · projectseniorservice / Соня

## Найпростіший шлях без коду

1. Заливаєш цей ZIP у GitHub repository `projectseniorservice`.
2. Чекаєш, поки Cloudflare deploy пройде без `ERROR`.
3. Відкриваєш:

```text
https://projectseniorservice.bot-worker-tenj.workers.dev/route-check
```

Має бути:

```json
{
  "ok": true,
  "version": "sonya-v3-admin-hotfix"
}
```

4. Відкриваєш адмінку:

```text
https://projectseniorservice.bot-worker-tenj.workers.dev/admin
```

Якщо браузер чомусь тримає стару сторінку, відкрий backup:

```text
https://projectseniorservice.bot-worker-tenj.workers.dev/setup
```

5. На First Setup екрані будуть уже підставлені прості стартові значення:

```text
Admin secret: sonya-admin-2026
Owner access code: owner2026
Family access code: family2026
```

Можеш змінити або просто натиснути `Save First Setup & Enter Admin`.

6. Після цього:

- Admin Panel: `/admin`
- Mini App: `/miniapp`
- Owner login у Mini App: `owner2026`, якщо не міняв
- Family login у Mini App: `family2026`, якщо не міняв

## Якщо замість Admin бачиш Family OS

Це означає, що відкрився Mini App або браузер тримає старий HTML.

Зроби по черзі:

1. Відкрий `/setup`.
2. Натисни Ctrl+F5.
3. Відкрий інкогніто.
4. Перевір `/route-check`; якщо немає `sonya-v3-admin-hotfix`, значить у GitHub ще не залитий цей ZIP.

## Куди вставляти ключі

Після First Setup відкрий Admin → API Keys і встав:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `OPENAI_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `RESEND_API_KEY`, якщо потрібна відправка пошти

