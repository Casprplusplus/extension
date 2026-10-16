import { deLijnTime, parseDeLijnSettings, type DeLijnDeparture } from '../common/delijn';
import { DELIJN_API_KEY } from '../common/delijn-key';
import { createTransitRoute, makeDepartureClickable } from './transit-route';
export function mountDeLijn(parent: HTMLElement): () => void {
  const route = createTransitRoute();
  let disposed = false;
  let revision = 0;
  let busy = false;
  let settings = parseDeLijnSettings(null);
  let departures: DeLijnDeparture[] = [];
  let lastFetch = 0;
  const widget = document.createElement('article');
  widget.className = 'caspr-delijn-widget caspr-transit-widget';
  const header = document.createElement('div');
  header.className = 'caspr-transit-header';
  const title = document.createElement('h3');
  title.textContent = '🚌 De Lijn';
  const refresh = document.createElement('button');
  refresh.type = 'button';
  refresh.textContent = '↻';
  refresh.setAttribute('aria-label', 'De Lijn verversen');
  header.append(title, refresh);
  const stopName = document.createElement('p');
  stopName.className = 'caspr-transit-stop';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const list = document.createElement('ol');
  list.className = 'caspr-transit-departures';
  const details = document.createElement('details');
  details.className = 'caspr-transit-settings';
  const summary = document.createElement('summary');
  summary.textContent = 'Halte & instellingen';
  details.append(summary);
  const field = (text: string, type: string) => {
    const label = document.createElement('label');
    label.textContent = text;
    const input = document.createElement('input');
    input.type = type;
    label.append(input);
    details.append(label);
    return input;
  };
  const key = field('API-key', 'password');
  key.autocomplete = 'off';
  key.maxLength = 256;
  const save = document.createElement('button');
  save.type = 'button';
  save.textContent = 'Key opslaan';
  details.append(save);
  if (DELIJN_API_KEY.trim()) {
    key.parentElement!.hidden = true;
    save.hidden = true;
  }
  const search = field('Zoek halte of haltenummer', 'search');
  search.placeholder = 'Bijvoorbeeld Sint-Niklaas Station';
  search.maxLength = 100;
  const searchButton = document.createElement('button');
  searchButton.type = 'button';
  searchButton.textContent = 'Halte zoeken';
  details.append(searchButton);
  const results = document.createElement('div');
  results.className = 'caspr-transit-search-results';
  details.append(results);
  const filter = field('Lijnen (optioneel, gescheiden met komma’s)', 'text');
  filter.maxLength = 100;
  filter.placeholder = 'Bijvoorbeeld 1, 21, 82';
  const saveFilter = document.createElement('button');
  saveFilter.type = 'button';
  saveFilter.textContent = 'Lijnfilter bewaren';
  details.append(saveFilter);
  const note = document.createElement('small');
  note.textContent = DELIJN_API_KEY.trim()
    ? 'Je halte en lijnfilter worden lokaal bewaard.'
    : 'Key en halte worden alleen in deze browser bewaard.';
  details.append(note);
  const credit = document.createElement('a');
  credit.href = 'https://www.delijn.be/';
  credit.target = '_blank';
  credit.rel = 'noopener noreferrer';
  credit.textContent = 'Reisinformatie: De Lijn';
  credit.className = 'caspr-transit-credit';
  widget.append(header, stopName, status, list, details, credit);
  parent.append(widget);
  const render = () => {
    stopName.textContent = settings.stop
      ? `${settings.stop.name} · ${settings.stop.number}`
      : 'Kies jouw halte';
    const lines = new Set(
      settings.lines
        .split(',')
        .map((line) => line.trim().toLowerCase())
        .filter(Boolean),
    );
    const visible = departures
      .filter(
        (departure) =>
          (!lines.size || lines.has(departure.line.toLowerCase())) &&
          deLijnTime(departure.expected) > Date.now() - 60000,
      )
      .slice(0, 5);
    list.replaceChildren();
    for (const departure of visible) {
      const row = document.createElement('li');
      makeDepartureClickable(
        row,
        `Haltes van lijn ${departure.line} naar ${departure.destination}`,
        () => {
          void route.open(`Lijn ${departure.line} · ${departure.destination}`, {
            type: 'delijn:request',
            entity: departure.entity,
            internalLine: departure.internalLine,
            direction: departure.direction,
            trip: departure.trip,
            scheduled: departure.scheduled,
          });
        },
      );
      row.dataset.cancelled = String(departure.cancelled);
      const line = document.createElement('span');
      line.className = 'caspr-transit-line';
      line.textContent = departure.line;
      const destination = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = departure.destination;
      const info = document.createElement('small');
      const delay = Math.ceil(
        (deLijnTime(departure.expected) - deLijnTime(departure.scheduled)) / 60000,
      );
      const state = departure.cancelled
        ? 'cancelled'
        : !departure.realtime || !Number.isFinite(delay)
          ? 'scheduled'
          : delay > 0
            ? 'delayed'
            : 'ontime';
      row.dataset.transitStatus = state;
      const badge = document.createElement('span');
      badge.className = 'caspr-transit-status';
      badge.textContent =
        state === 'cancelled'
          ? 'Rit geschrapt'
          : state === 'delayed'
            ? `+${delay} min vertraging`
            : state === 'ontime'
              ? 'Op tijd'
              : 'Dienstregeling';
      if (departure.realtime && !departure.cancelled) info.append('Live · ');
      info.append(badge);
      destination.append(name, info);
      const time = document.createElement('time');
      time.dateTime = new Date(deLijnTime(departure.expected)).toISOString();
      time.textContent = new Date(deLijnTime(departure.expected)).toLocaleTimeString(
        'nl-BE',
        { timeZone: 'Europe/Brussels', hour: '2-digit', minute: '2-digit' },
      );
      if (Number.isFinite(deLijnTime(departure.scheduled)))
        time.title = `Gepland: ${new Date(deLijnTime(departure.scheduled)).toLocaleTimeString('nl-BE', { timeZone: 'Europe/Brussels', hour: '2-digit', minute: '2-digit' })}`;
      row.append(line, destination, time);
      list.append(row);
    }
    return visible.length;
  };
  const request = async (action: string, extra = {}) => {
    const data = await chrome.runtime.sendMessage({
      type: 'delijn:request',
      action,
      ...extra,
    });
    if (!data?.ok) throw new Error(data?.error || 'De Lijn ophalen mislukt.');
    return data;
  };
  const load = async () => {
    if (
      disposed ||
      busy ||
      document.hidden ||
      !settings.key ||
      !settings.stop ||
      widget.closest('[hidden]')
    )
      return;
    const token = revision;
    busy = true;
    refresh.disabled = true;
    lastFetch = Date.now();
    status.textContent = 'Vertrekken laden…';
    try {
      const data = await request('departures');
      if (disposed || token !== revision) return;
      departures = data.departures;
      status.textContent = render()
        ? `Bijgewerkt om ${new Date(data.updated).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}`
        : 'Geen komende vertrekken voor deze halte of lijnfilter.';
    } catch (error) {
      if (!disposed && token === revision)
        status.textContent = `${error instanceof Error ? error.message : 'Ophalen mislukt.'}${departures.length ? ' Getoonde tijden kunnen verouderd zijn.' : ''}`;
    } finally {
      busy = false;
      refresh.disabled = false;
      if (!disposed && token !== revision) void load();
    }
  };
  const persist = async (next: typeof settings) => {
    await chrome.storage.local.set({ delijn: next });
  };
  save.onclick = async () => {
    save.disabled = true;
    try {
      if (!key.value.trim()) throw new Error('Vul je API-key in.');
      await persist({ ...settings, key: key.value.trim() });
      status.textContent = 'Key lokaal opgeslagen. Zoek nu je halte.';
    } catch (error) {
      status.textContent = (error as Error).message;
    } finally {
      save.disabled = false;
    }
  };
  searchButton.onclick = async () => {
    const token = revision;
    searchButton.disabled = true;
    results.replaceChildren();
    status.textContent = 'Haltes zoeken…';
    try {
      const data = await request('search', { query: search.value });
      if (disposed || token !== revision) return;
      status.textContent = data.stops.length
        ? 'Kies een halte en richting.'
        : 'Geen haltes gevonden.';
      for (const stop of data.stops) {
        const choice = document.createElement('button');
        choice.type = 'button';
        choice.textContent = `${stop.name} · ${stop.number}`;
        choice.onclick = async () => {
          choice.disabled = true;
          try {
            await persist({ ...settings, stop });
            results.replaceChildren();
            details.open = false;
          } catch {
            status.textContent = 'Halte bewaren mislukt.';
            choice.disabled = false;
          }
        };
        results.append(choice);
      }
    } catch (error) {
      if (!disposed) status.textContent = (error as Error).message;
    } finally {
      searchButton.disabled = false;
    }
  };
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      searchButton.click();
    }
  });
  saveFilter.onclick = async () => {
    try {
      await persist({ ...settings, lines: filter.value.trim() });
    } catch {
      status.textContent = 'Filter bewaren mislukt.';
    }
  };
  refresh.onclick = () => void load();
  const configure = (value: unknown) => {
    route.close();
    revision++;
    settings = parseDeLijnSettings(value);
    settings.key = DELIJN_API_KEY.trim() || settings.key;
    key.value = settings.key;
    filter.value = settings.lines;
    departures = [];
    render();
    if (!settings.key || !settings.stop) details.open = true;
    status.textContent = !settings.key
      ? 'Vul je De Lijn API-key in om te beginnen.'
      : !settings.stop
        ? 'Zoek een halte om vertrektijden te zien.'
        : '';
    if (!busy) void load();
  };
  const changed = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area === 'local' && changes.delijn) configure(changes.delijn.newValue);
  };
  chrome.storage.onChanged.addListener(changed);
  const initial = revision;
  void chrome.storage.local
    .get('delijn')
    .then((data) => {
      if (!disposed && initial === revision) configure(data.delijn);
    })
    .catch(() => {
      if (!disposed) status.textContent = 'Instellingen laden mislukt.';
    });
  const visible = () => {
    if (!document.hidden && Date.now() - lastFetch > 30000) void load();
  };
  document.addEventListener('visibilitychange', visible);
  const timer = setInterval(() => void load(), 60000);
  return () => {
    route.cleanup();
    disposed = true;
    revision++;
    clearInterval(timer);
    document.removeEventListener('visibilitychange', visible);
    chrome.storage.onChanged.removeListener(changed);
    widget.remove();
  };
}
