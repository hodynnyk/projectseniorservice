import { logActivity } from '../services/activity.js';

const WEATHER_CODES = {
  0: 'ясно', 1: 'переважно ясно', 2: 'мінлива хмарність', 3: 'хмарно',
  45: 'туман', 48: 'паморозь / туман', 51: 'слабка мряка', 53: 'мряка', 55: 'сильна мряка',
  56: 'крижана мряка', 57: 'сильна крижана мряка', 61: 'слабкий дощ', 63: 'дощ', 65: 'сильний дощ',
  66: 'крижаний дощ', 67: 'сильний крижаний дощ', 71: 'слабкий сніг', 73: 'сніг', 75: 'сильний сніг',
  77: 'сніжні зерна', 80: 'слабкі зливи', 81: 'зливи', 82: 'сильні зливи',
  85: 'слабкий снігопад', 86: 'сильний снігопад', 95: 'гроза', 96: 'гроза з градом', 99: 'сильна гроза з градом'
};

const DEFAULT_LOCATION = 'Obukhiv, Ukraine';

export function isWeatherIntent(text = '') {
  const s = String(text || '').toLowerCase();
  return ['погод', 'погода', 'weather', 'температур', 'дощ', 'сніг', 'ветер', 'вітер', 'прогноз', 'що там на вулиці', 'что там на улице'].some(k => s.includes(k));
}

export async function getWeatherForText(env, user, text = '', source = 'bot') {
  const location = extractWeatherLocation(text) || env.DEFAULT_WEATHER_LOCATION || DEFAULT_LOCATION;
  const geo = await geocode(location);
  if (!geo.ok) {
    return { ok: false, text: `Не знайшла місто для погоди: ${location}. Напиши, наприклад: погода Київ або погода Обухів.` };
  }
  const forecast = await fetchForecast(geo.place);
  if (!forecast.ok) return { ok: false, text: forecast.text || 'Погода тимчасово недоступна.' };
  const textOut = formatWeather(geo.place, forecast.data);
  await logActivity(env, { userId: user?.id, source, module: 'weather', action: 'lookup', message: location, metadata: { resolved: geo.place.name } });
  return { ok: true, text: textOut, location: geo.place, weather: forecast.data };
}

function extractWeatherLocation(text = '') {
  let s = String(text || '').trim();
  s = s.replace(/[?!.]+$/g, '').trim();
  const patterns = [
    /(?:погода|прогноз|weather)\s+(?:в|у|на|для)?\s*([\p{L}\s'.-]{2,60})/iu,
    /(?:що|шо|что)\s+(?:по|там по)\s+погод[іе]\s+(?:в|у|на)?\s*([\p{L}\s'.-]{2,60})/iu,
    /(?:температура|дощ|сніг|ветер|вітер)\s+(?:в|у|на)?\s*([\p{L}\s'.-]{2,60})/iu
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m?.[1]) return cleanLocation(m[1]);
  }
  return '';
}

function cleanLocation(s) {
  return String(s || '')
    .replace(/\b(сьогодні|сегодня|завтра|tomorrow|today|будь ласка|пожалуйста|pls|please)\b/giu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function geocode(location) {
  const q = location || DEFAULT_LOCATION;
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=uk&format=json`;
  const res = await fetch(url, { headers: { 'accept': 'application/json' } });
  const data = await res.json().catch(() => ({}));
  const place = data?.results?.[0];
  if (!res.ok || !place) return { ok: false };
  return { ok: true, place: { name: place.name, country: place.country, admin1: place.admin1 || '', latitude: place.latitude, longitude: place.longitude, timezone: place.timezone || 'auto' } };
}

async function fetchForecast(place) {
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: 'temperature_2m,apparent_temperature,precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    forecast_days: '3',
    timezone: 'auto'
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, { headers: { 'accept': 'application/json' } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.current) return { ok: false, text: data?.reason || 'Weather API error' };
  return { ok: true, data };
}

function formatWeather(place, data) {
  const c = data.current || {};
  const d = data.daily || {};
  const placeName = [place.name, place.admin1, place.country].filter(Boolean).join(', ');
  const code = Number(c.weather_code);
  const desc = WEATHER_CODES[code] || 'погодні дані';
  const parts = [];
  parts.push(`Погода: ${placeName}`);
  parts.push(`Зараз: ${round(c.temperature_2m)}°C, відчувається як ${round(c.apparent_temperature)}°C, ${desc}.`);
  parts.push(`Вітер: ${round(c.wind_speed_10m)} км/год${c.wind_gusts_10m ? `, пориви до ${round(c.wind_gusts_10m)} км/год` : ''}. Хмарність: ${round(c.cloud_cover)}%.`);
  const rain = Number(c.precipitation || 0) + Number(c.rain || 0) + Number(c.showers || 0) + Number(c.snowfall || 0);
  if (rain > 0) parts.push(`Опади зараз: ${round(rain, 1)} мм.`);
  if (d.time?.length) {
    const days = d.time.slice(0, 3).map((day, i) => {
      const w = WEATHER_CODES[Number(d.weather_code?.[i])] || 'прогноз';
      const p = d.precipitation_probability_max?.[i];
      return `${day}: ${round(d.temperature_2m_min?.[i])}…${round(d.temperature_2m_max?.[i])}°C, ${w}${p != null ? `, шанс опадів ${p}%` : ''}`;
    });
    parts.push('Найближче:\n' + days.join('\n'));
  }
  return parts.join('\n');
}

function round(n, digits = 0) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return Number(n).toFixed(digits).replace(/\.0$/, '');
}
