# Setup guide for non-coder upload flow

This guide assumes you only upload a ready ZIP to GitHub.

## 1. Upload project to GitHub

Create/open GitHub repository:

```txt
projectseniorservice
```

Upload all files from this ZIP into the repository root.

## 2. Add GitHub Secrets for Cloudflare deploy

In GitHub repository:

```txt
Settings → Secrets and variables → Actions → New repository secret
```

Add:

| Secret | Meaning |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare token allowed to deploy Workers |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |

No coding is needed.

## 3. GitHub Actions deploy

After upload to `main` or `master`, GitHub Actions runs:

```txt
npm install → npm run check → wrangler deploy
```

## 4. Open Admin Panel

After deploy, open your Worker URL:

```txt
https://projectseniorservice.<your-subdomain>.workers.dev/admin
```

If the system is new, you will see **First Setup**.

## 5. First Setup fields

Fill these fields:

| Field | What to enter |
|---|---|
| Assistant name | Соня або інша назва помічника |
| Public Base URL | Deployed Worker URL, for example `https://projectseniorservice.xxx.workers.dev` |
| Owner name | Your name/nickname |
| Family name | Wife/family account name |
| Admin secret | Long private admin password/link secret |
| Owner access code | Code for `/start CODE` in Telegram |
| Family access code | Code for wife/family login |
| Telegram Bot Token | Optional now, can add later |
| OpenAI API Key | Optional now, can add later |
| Telegram webhook secret | Any private word, default `telegram` is acceptable for first test |
| Google Client ID/Secret | Optional now |
| RESEND_API_KEY | Optional only for outbound email |

Click:

```txt
Save First Setup & Enter Admin
```

## 6. Set Telegram webhook

After Telegram Bot Token and Public URL are saved:

```txt
Admin → Backup → Set Telegram webhook
```

Then write to your bot:

```txt
/start OWNER_ACCESS_CODE
```

For wife/family:

```txt
/start FAMILY_ACCESS_CODE
```

## 7. Mini App

Open:

```txt
https://projectseniorservice.<your-subdomain>.workers.dev/miniapp
```

Inside Telegram, Соня надсилає кнопку для відкриття панелі після `/start CODE`.
