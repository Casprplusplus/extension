import { parseDashboard } from '../common/dashboard';
import { parseWeatherPlace } from '../common/weather';
const cache = new Map<string, { until: number; data: any }>();
const pending = new Map<string, Promise<any>>();
async function get(url: string, ttl: number): Promise<any> {
  const hit = cache.get(url);
  if (hit && hit.until > Date.now()) return hit.data;
  if (pending.has(url)) return pending.get(url);
  const task = (async () => {
    const response = await fetch(url, {
      credentials: 'omit',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      throw new Error(
        response.status === 429
          ? 'Te veel weeraanvragen. Probeer later opnieuw.'
          : 'De weerdienst is tijdelijk niet beschikbaar.',
      );
    const data = await response.json();
    if (data.error)
      throw new Error('Weergegevens zijn niet beschikbaar voor deze plaats.');
    if (cache.size > 80) cache.clear();
    cache.set(url, { data, until: Date.now() + ttl });
    return data;
  })();
  pending.set(url, task);
  try {
    return await task;
  } finally {
    pending.delete(url);
  }
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type !== 'weather:request') return;
  if (
    !sender.tab ||
    !sender.url ||
    new URL(sender.url).origin !== 'https://kolvw.caspr.be'
  )
    return;
  void (async () => {
    const stored = await chrome.storage.local.get(['dashboard', 'weatherPlace']);
    if (!parseDashboard(stored.dashboard).enabled) throw new Error('CASPR++ staat uit.');
    if (message.action === 'search') {
      const query =
        typeof message.query === 'string' ? message.query.trim().slice(0, 100) : '';
      if (query.length < 2)
        throw new Error('Vul minstens twee letters van een plaatsnaam in.');
      const data = await get(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=nl&format=json`,
        86400000,
      );
      return {
        ok: true,
        places: (data.results || [])
          .map((place: any) =>
            parseWeatherPlace({
              name: [place.name, place.admin1, place.country].filter(Boolean).join(', '),
              latitude: place.latitude,
              longitude: place.longitude,
            }),
          )
          .filter(Boolean),
      };
    }
    const place = parseWeatherPlace(stored.weatherPlace);
    if (message.action !== 'forecast' || !place) throw new Error('Kies eerst je plaats.');
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FBrussels&timeformat=unixtime&forecast_days=3`;
    const data = await get(url, 900000);
    if (!data.current || typeof data.current.temperature_2m !== 'number')
      throw new Error('Geen actuele weergegevens ontvangen.');
    return {
      ok: true,
      current: data.current,
      daily: data.daily,
      updated: data.current.time * 1000,
    };
  })()
    .then(reply)
    .catch((error) =>
      reply({
        ok: false,
        error:
          error instanceof Error && !['TimeoutError', 'TypeError'].includes(error.name)
            ? error.message
            : 'Geen verbinding met de weerdienst.',
      }),
    );
  return true;
});
