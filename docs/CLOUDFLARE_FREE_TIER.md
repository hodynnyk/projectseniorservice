# Cloudflare free-tier policy · Соня v10

- R2 вимкнено, щоб не наближатися до 10 GB/month.
- Voice/audio input вимкнено.
- Фото/документи не скачуються в binary storage.
- Файли створюються як metadata-only картки.
- KV використовується економно: Соня не зберігає все підряд.
- Activity log треба періодично експортувати, якщо система стане дуже активною.


## v12 AI Router

AI Router stores only small config values in KV: active provider, fallback provider and base prompt. R2 and voice remain disabled to avoid storage overuse.
