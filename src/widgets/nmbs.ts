import { parseRailStation, type RailDeparture } from '../common/nmbs';
import { createTransitRoute, makeDepartureClickable } from './transit-route';
export function mountNMBS(parent: HTMLElement): () => void {
  const route = createTransitRoute();
  let disposed = false,
    busy = false,
    revision = 0,
    lastFetch = 0;
  let station = parseRailStation(null);
  let departures: RailDeparture[] = [];
  const widget = document.createElement('article');
  widget.className = 'caspr-nmbs-widget caspr-transit-widget';
  const header = document.createElement('div');
  header.className = 'caspr-transit-header';
  const title = document.createElement('h3');
  title.textContent = '🚆 NMBS';
  const refresh = document.createElement('button');
  refresh.type = 'button';
  refresh.textContent = '↻';
  refresh.setAttribute('aria-label', 'Treinen verversen');
  header.append(title, refresh);
  const name = document.createElement('p');
  name.className = 'caspr-transit-stop';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const list = document.createElement('ol');
  list.className = 'caspr-transit-departures';
  const settings = document.createElement('details');
  settings.className = 'caspr-transit-settings';
  const summary = document.createElement('summary');
  summary.textContent = 'Station kiezen';
  const label = document.createElement('label');
  label.textContent = 'Zoek station';
  const search = document.createElement('input');
  search.type = 'search';
  search.maxLength = 100;
  search.placeholder = 'Bijvoorbeeld Sint-Niklaas';
  label.append(search);
  const searchButton = document.createElement('button');
  searchButton.type = 'button';
  searchButton.textContent = 'Stations zoeken';
  const results = document.createElement('div');
  results.className = 'caspr-transit-search-results';
  settings.append(summary, label, searchButton, results);
  const credit = document.createElement('a');
  credit.className = 'caspr-transit-credit';
  credit.href = 'https://irail.be/';
  credit.target = '_blank';
  credit.rel = 'noopener noreferrer';
  credit.textContent = 'Treininformatie via iRail';
  widget.append(header, name, status, list, settings, credit);
  parent.append(widget);
  const render = () => {
    name.textContent = station?.name || 'Kies jouw station';
    list.replaceChildren();
    const visible = departures
      .filter((departure) => departure.time + departure.delay > Date.now() - 60000)
      .slice(0, 5);
    for (const departure of visible) {
      const row = document.createElement('li');
      makeDepartureClickable(
        row,
        `Stations van ${departure.train} naar ${departure.destination}`,
        () => {
          void route.open(`${departure.train} · ${departure.destination}`, {
            type: 'nmbs:request',
            vehicle: departure.vehicle,
            time: departure.time,
            serviceDate: departure.serviceDate,
          });
        },
      );
      row.dataset.cancelled = String(departure.cancelled);
      const train = document.createElement('span');
      train.className = 'caspr-transit-line';
      train.textContent = departure.train || 'Trein';
      const body = document.createElement('div');
      const destination = document.createElement('strong');
      destination.textContent = departure.destination;
      const info = document.createElement('small');
      row.dataset.transitStatus = departure.cancelled
        ? 'cancelled'
        : departure.delay > 0
          ? 'delayed'
          : 'ontime';
      const badge = document.createElement('span');
      badge.className = 'caspr-transit-status';
      badge.textContent = departure.cancelled
        ? 'Trein afgeschaft'
        : departure.delay > 0
          ? `+${Math.ceil(departure.delay / 60000)} min vertraging`
          : 'Op tijd';
      if (!departure.cancelled) {
        const platform = document.createElement('span');
        platform.className = departure.platformChanged
          ? 'caspr-transit-platform-changed'
          : '';
        platform.textContent = `Spoor ${departure.platform}${departure.platformChanged ? ' · gewijzigd' : ''}`;
        info.append(platform, ' · ');
      }
      info.append(badge);
      body.append(destination, info);
      const time = document.createElement('time');
      time.dateTime = new Date(departure.time + departure.delay).toISOString();
      time.textContent = new Date(departure.time + departure.delay).toLocaleTimeString(
        'nl-BE',
        { timeZone: 'Europe/Brussels', hour: '2-digit', minute: '2-digit' },
      );
      time.title = `Gepland: ${new Date(departure.time).toLocaleTimeString('nl-BE', { timeZone: 'Europe/Brussels', hour: '2-digit', minute: '2-digit' })}`;
      row.append(train, body, time);
      list.append(row);
    }
    return visible.length;
  };
  const request = async (action: string, extra = {}) => {
    const data = await chrome.runtime.sendMessage({
      type: 'nmbs:request',
      action,
      ...extra,
    });
    if (!data?.ok) throw new Error(data?.error || 'Treininformatie ophalen mislukt.');
    return data;
  };
  const load = async () => {
    if (disposed || busy || !station || document.hidden || widget.closest('[hidden]'))
      return;
    busy = true;
    refresh.disabled = true;
    lastFetch = Date.now();
    const token = revision;
    status.textContent = 'Treinen laden…';
    try {
      const data = await request('departures');
      if (disposed || token !== revision) return;
      departures = data.departures;
      status.textContent = render()
        ? `Bijgewerkt om ${new Date(data.updated).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}`
        : 'Geen komende treinen gevonden.';
    } catch (error) {
      if (!disposed && token === revision)
        status.textContent = `${(error as Error).message}${departures.length ? ' Getoonde tijden kunnen verouderd zijn.' : ''}`;
    } finally {
      busy = false;
      refresh.disabled = false;
      if (!disposed && token !== revision) void load();
    }
  };
  const configure = (value: unknown) => {
    route.close();
    revision++;
    station = parseRailStation(value);
    departures = [];
    render();
    if (!station) {
      settings.open = true;
      status.textContent = 'Zoek je station om vertrektijden te zien.';
    } else if (!busy) void load();
  };
  searchButton.onclick = async () => {
    const token = revision;
    searchButton.disabled = true;
    results.replaceChildren();
    status.textContent = 'Stations zoeken…';
    try {
      const data = await request('search', { query: search.value });
      if (disposed || token !== revision) return;
      status.textContent = data.stations.length
        ? 'Kies jouw vertrekstation.'
        : 'Geen stations gevonden.';
      for (const match of data.stations) {
        const choose = document.createElement('button');
        choose.type = 'button';
        choose.textContent = match.name;
        choose.onclick = async () => {
          choose.disabled = true;
          try {
            await chrome.storage.local.set({ nmbsStation: match });
            settings.open = false;
            results.replaceChildren();
          } catch {
            status.textContent = 'Station bewaren mislukt.';
            choose.disabled = false;
          }
        };
        results.append(choose);
      }
    } catch (error) {
      if (!disposed && token === revision) status.textContent = (error as Error).message;
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
  refresh.onclick = () => void load();
  const changed = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area === 'local' && changes.nmbsStation) configure(changes.nmbsStation.newValue);
  };
  chrome.storage.onChanged.addListener(changed);
  const initial = revision;
  void chrome.storage.local
    .get('nmbsStation')
    .then((data) => {
      if (!disposed && initial === revision) configure(data.nmbsStation);
    })
    .catch(() => {
      if (!disposed) status.textContent = 'Station laden mislukt.';
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
    chrome.storage.onChanged.removeListener(changed);
    document.removeEventListener('visibilitychange', visible);
    widget.remove();
  };
}
