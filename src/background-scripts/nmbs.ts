import { parseDashboard } from '../common/dashboard';
import { parseRailDepartures, parseRailStation, type RailStation } from '../common/nmbs';
const cache = new Map<string, { until: number; data: any }>();
const pending = new Map<string, Promise<any>>();
let retryAfter = 0;
async function get(url: string, ttl: number): Promise<any> {
  const hit = cache.get(url);
  if (hit && hit.until > Date.now()) return hit.data;
  if (retryAfter > Date.now())
    throw new Error('iRail is druk. Probeer over een minuut opnieuw.');
  const current = pending.get(url);
  if (current) return current;
  const request = (async () => {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });
    if (response.status === 429) {
      const delay = Number(response.headers.get('Retry-After'));
      retryAfter =
        Date.now() + Math.max(60000, Number.isFinite(delay) ? delay * 1000 : 0);
      throw new Error('iRail is druk. Probeer over een minuut opnieuw.');
    }
    if (!response.ok)
      throw new Error(
        response.status === 404
          ? 'Geen treininfo gevonden voor dit station.'
          : 'Treininformatie is tijdelijk niet beschikbaar.',
      );
    const data = await response.json();
    const maxAge =
      Number(response.headers.get('Cache-Control')?.match(/max-age=(\d+)/i)?.[1]) || 0;
    if (cache.size > 100) cache.clear();
    cache.set(url, { data, until: Date.now() + Math.max(ttl, maxAge * 1000) });
    return data;
  })();
  pending.set(url, request);
  try {
    return await request;
  } finally {
    pending.delete(url);
  }
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type !== 'nmbs:request') return;
  if (
    !sender.tab ||
    !sender.url ||
    new URL(sender.url).origin !== 'https://kolvw.caspr.be'
  )
    return;
  void (async () => {
    const stored = await chrome.storage.local.get(['dashboard', 'nmbsStation']);
    if (!parseDashboard(stored.dashboard).enabled) throw new Error('CASPR++ staat uit.');
    if (message.action === 'search') {
      const query =
        typeof message.query === 'string' ? message.query.trim().slice(0, 100) : '';
      if (query.length < 2)
        throw new Error('Vul minstens twee letters van je station in.');
      const data = await get(
        'https://api.irail.be/stations/?format=json&lang=nl',
        86400000,
      );
      const normalize = (value: string) =>
        value
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
      const stations: RailStation[] = (Array.isArray(data.station) ? data.station : [])
        .map(parseRailStation)
        .filter((station: RailStation | null): station is RailStation => !!station);
      return {
        ok: true,
        stations: stations
          .filter((station) => normalize(station.name).includes(normalize(query)))
          .slice(0, 12),
      };
    }
    const station = parseRailStation(stored.nmbsStation);
    if (message.action === 'route' && station) {
      if (
        typeof message.vehicle !== 'string' ||
        !/^BE\.NMBS\.[A-Z0-9]{1,20}$/i.test(message.vehicle) ||
        !Number.isFinite(message.time)
      )
        throw new Error('Geen ritdetails beschikbaar voor deze trein.');
      const localDate = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Brussels',
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      })
        .format(message.time)
        .replaceAll('/', '');
      const date =
        typeof message.serviceDate === 'string' && /^\d{8}$/.test(message.serviceDate)
          ? message.serviceDate.slice(6, 8) +
            message.serviceDate.slice(4, 6) +
            message.serviceDate.slice(2, 4)
          : localDate;
      const data = await get(
        `https://api.irail.be/vehicle/?id=${encodeURIComponent(message.vehicle)}&date=${date}&format=json&lang=nl`,
        30000,
      );
      const raw = data.stops?.stop;
      const stops = Array.isArray(raw) ? raw : raw ? [raw] : [];
      let index = stops.findIndex(
        (stop: any) =>
          stop.stationinfo?.id === station.id &&
          Math.abs(
            Number(stop.scheduledDepartureTime || stop.time) * 1000 - message.time,
          ) < 120000,
      );
      if (index < 0)
        index = stops.findIndex((stop: any) => stop.stationinfo?.id === station.id);
      if (index < 0)
        throw new Error('Je vertrekstation werd niet teruggevonden in deze rit.');
      return {
        ok: true,
        stops: stops
          .slice(index)
          .map((stop: any, position: number) => {
            const planned =
              Number(
                stop.scheduledDepartureTime || stop.scheduledArrivalTime || stop.time,
              ) * 1000;
            const delay =
              Number(stop.departureDelay || stop.arrivalDelay || stop.delay) || 0;
            return {
              name: String(stop.station || ''),
              scheduled: planned,
              expected: planned + Math.max(0, delay) * 1000,
              realtime: true,
              cancelled:
                String(stop.canceled) === '1' || String(stop.departureCanceled) === '1',
              platform: String(stop.platform || '?'),
              platformChanged: String(stop.platforminfo?.normal) === '0',
              passed: String(stop.left) === '1',
              current: position === 0,
            };
          })
          .filter((stop: any) => Number.isFinite(stop.scheduled)),
        note: 'Traject vanaf jouw gekozen station. De tijden bevatten de gemelde vertraging.',
      };
    }
    if (message.action !== 'departures' || !station)
      throw new Error('Kies eerst je station.');
    const data = await get(
      `https://api.irail.be/liveboard/?id=${encodeURIComponent(station.id)}&format=json&lang=nl&arrdep=departure`,
      30000,
    );
    return { ok: true, departures: parseRailDepartures(data), updated: Date.now() };
  })()
    .then(reply)
    .catch((error) =>
      reply({
        ok: false,
        error:
          error instanceof Error && !['TimeoutError', 'TypeError'].includes(error.name)
            ? error.message
            : 'Geen verbinding met iRail. Probeer opnieuw.',
      }),
    );
  return true;
});
