import { parseDashboard } from '../common/dashboard';
import { DELIJN_API_KEY } from '../common/delijn-key';
import { deLijnTime, parseDeLijnSettings, type DeLijnDeparture } from '../common/delijn';
const core = 'https://api.delijn.be/DLKernOpenData/api/v1';
const cache = new Map<string, { until: number; data: unknown }>();
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type !== 'delijn:request') return;
  if (
    !sender.tab ||
    !sender.url ||
    new URL(sender.url).origin !== 'https://kolvw.caspr.be'
  )
    return;
  void (async () => {
    const stored = await chrome.storage.local.get(['delijn', 'dashboard']);
    if (!parseDashboard(stored.dashboard).enabled) throw new Error('CASPR++ staat uit.');
    const settings = parseDeLijnSettings(stored.delijn);
    settings.key = DELIJN_API_KEY.trim() || settings.key;
    if (!settings.key) throw new Error('Vul eerst je De Lijn API-key in.');
    const get = async (url: string, ttl = 30000): Promise<any> => {
      const id = settings.key + ':' + url;
      const hit = cache.get(id);
      if (hit && hit.until > Date.now()) return hit.data;
      const response = await fetch(url, {
        headers: {
          'Ocp-Apim-Subscription-Key': settings.key,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10000),
        credentials: 'omit',
      });
      if (!response.ok)
        throw new Error(
          response.status === 401 || response.status === 403
            ? 'De API-key is ongeldig of heeft geen toegang tot dit API-product.'
            : response.status === 404
              ? 'Halte niet gevonden. Controleer het haltenummer.'
              : response.status === 429
                ? 'Te veel aanvragen. Wacht even en probeer opnieuw.'
                : 'De Lijn is tijdelijk niet beschikbaar.',
        );
      const data = await response.json();
      if (cache.size > 150) cache.clear();
      cache.set(id, { data, until: Date.now() + ttl });
      return data;
    };
    const stopFrom = (value: any) => ({
      number: String(value.haltenummer || ''),
      entity: String(value.entiteitnummer || String(value.haltenummer || '')[0] || ''),
      name: String(value.omschrijving || ''),
    });
    if (message.action === 'search') {
      const query =
        typeof message.query === 'string' ? message.query.trim().slice(0, 100) : '';
      if (query.length < 2)
        throw new Error('Vul minstens twee tekens of een haltenummer in.');
      if (/^[1-5]\d{5}$/.test(query)) {
        const stop = await get(`${core}/haltes/${query[0]}/${query}`, 3600000);
        return { ok: true, stops: [stopFrom(stop)] };
      }
      const data = await get(
        `https://api.delijn.be/DLZoekOpenData/v1/zoek/haltes/${encodeURIComponent(query)}?maxAantalHits=10`,
        300000,
      );
      return {
        ok: true,
        stops: (data.haltes || [])
          .map(stopFrom)
          .filter((stop: any) => parseDeLijnSettings({ stop }).stop),
      };
    }
    if (message.action === 'route' && settings.stop) {
      const { entity, internalLine, direction, trip, scheduled } = message;
      if (
        !/^[1-5]$/.test(String(entity)) ||
        !/^\d{1,8}$/.test(String(internalLine)) ||
        !['HEEN', 'TERUG'].includes(direction) ||
        !/^\d{1,15}$/.test(String(trip)) ||
        typeof scheduled !== 'string'
      )
        throw new Error('Geen ritdetails beschikbaar voor deze bus.');
      const base = `${core}/lijnen/${entity}/${internalLine}/lijnrichtingen/${direction}`;
      const [route, realtime] = await Promise.all([
        get(`${base}/haltes`, 3600000),
        get(`${base}/real-time`),
      ]);
      const findTrip = (data: any) =>
        (data.ritDoorkomsten || []).find(
          (ride: any) =>
            String(ride.ritnummer) === String(trip) &&
            (ride.doorkomsten || []).some(
              (stop: any) =>
                String(stop.haltenummer) === settings.stop!.number &&
                stop.dienstregelingTijdstip === scheduled,
            ),
        );
      let ride = findTrip(realtime);
      if (!ride) ride = findTrip(await get(`${base}/dienstregelingen`, 300000));
      if (!ride)
        throw new Error('Deze rit is niet meer beschikbaar. Ververs het vertrekbord.');
      const names = new Map<string, string>(
        (route.haltes || []).map((stop: any) => [
          String(stop.haltenummer),
          String(stop.omschrijvingLang || stop.omschrijving),
        ]),
      );
      const passages = (ride.doorkomsten || []).filter((stop: any) =>
        Number.isFinite(deLijnTime(stop.dienstregelingTijdstip)),
      );
      const index = passages.findIndex(
        (stop: any) =>
          String(stop.haltenummer) === settings.stop!.number &&
          stop.dienstregelingTijdstip === scheduled,
      );
      if (index < 0)
        throw new Error('Je vertrekhalte werd niet teruggevonden in deze rit.');
      return {
        ok: true,
        stops: passages.slice(index).map((stop: any, position: number) => {
          const statuses = Array.isArray(stop.predictionStatussen)
            ? stop.predictionStatussen
            : [stop.predictionStatussen];
          const live =
            statuses.includes('REALTIME') && !statuses.includes('GEENREALTIME');
          const planned = deLijnTime(stop.dienstregelingTijdstip);
          const expected = live
            ? deLijnTime(
                stop['real-timeTijdstip'] ||
                  stop.doorkomstTijdstip ||
                  stop.dienstregelingTijdstip,
              )
            : planned;
          return {
            name: names.get(String(stop.haltenummer)) || `Halte ${stop.haltenummer}`,
            scheduled: planned,
            expected: Number.isFinite(expected) ? expected : planned,
            realtime: live,
            cancelled: statuses.includes('GESCHRAPT'),
            current: position === 0,
          };
        }),
        note: 'Tijden per halte zijn live waar beschikbaar; anders zie je de dienstregeling.',
      };
    }
    if (message.action !== 'departures' || !settings.stop)
      throw new Error('Kies eerst een halte.');
    const stop = settings.stop;
    const data = await get(
      `${core}/haltes/${stop.entity}/${stop.number}/real-time?maxAantalDoorkomsten=20`,
    );
    const passages = (data.halteDoorkomsten || []).flatMap(
      (entry: any) => entry.doorkomsten || [],
    );
    const lines = new Map<string, string>();
    await Promise.all(
      [
        ...new Map<string, any>(
          passages.map((passage: any) => [
            `${passage.entiteitnummer || stop.entity}/${passage.lijnnummer}`,
            passage,
          ]),
        ).entries(),
      ]
        .slice(0, 15)
        .map(async ([id, passage]) => {
          try {
            const line = await get(`${core}/lijnen/${id}`, 86400000);
            lines.set(id, String(line.lijnnummerPubliek || passage.lijnnummer));
          } catch {
            /* Keep departures available if line metadata fails. */
          }
        }),
    );
    const departures: DeLijnDeparture[] = passages
      .map((passage: any) => {
        const statuses = Array.isArray(passage.predictionStatussen)
          ? passage.predictionStatussen
          : [passage.predictionStatussen];
        const realtime =
          statuses.includes('REALTIME') && !statuses.includes('GEENREALTIME');
        const scheduled = String(passage.dienstregelingTijdstip || '');
        return {
          entity: String(passage.entiteitnummer || stop.entity),
          internalLine: String(passage.lijnnummer || ''),
          direction: String(passage.richting || ''),
          trip: String(passage.ritnummer || ''),
          line:
            lines.get(`${passage.entiteitnummer || stop.entity}/${passage.lijnnummer}`) ||
            String(passage.lijnnummerPubliek || passage.lijnnummer || '?'),
          destination: String(passage.bestemming || 'Onbekende bestemming'),
          scheduled,
          expected: realtime
            ? String(
                passage['real-timeTijdstip'] || passage.doorkomstTijdstip || scheduled,
              )
            : scheduled,
          realtime,
          cancelled: statuses.includes('GESCHRAPT') || passage.status === 'CANCELLED',
        };
      })
      .filter((departure: DeLijnDeparture) =>
        Number.isFinite(deLijnTime(departure.expected)),
      )
      .sort(
        (a: DeLijnDeparture, b: DeLijnDeparture) =>
          deLijnTime(a.expected) - deLijnTime(b.expected),
      );
    return { ok: true, departures, updated: Date.now() };
  })()
    .then(reply)
    .catch((error) =>
      reply({
        ok: false,
        error:
          error instanceof Error && !['TimeoutError', 'TypeError'].includes(error.name)
            ? error.message
            : 'Geen verbinding met De Lijn. Probeer opnieuw.',
      }),
    );
  return true;
});
