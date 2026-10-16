import { parseWeatherPlace, weatherDescription } from '../common/weather';
export function mountWeather(parent: HTMLElement): () => void {
  let disposed = false,
    busy = false,
    revision = 0,
    lastFetch = 0;
  let place = parseWeatherPlace(null);
  const widget = document.createElement('article');
  widget.className = 'caspr-weather-widget caspr-transit-widget';
  const header = document.createElement('div');
  header.className = 'caspr-transit-header';
  const title = document.createElement('h3');
  title.textContent = '🌤️ Weer';
  const refresh = document.createElement('button');
  refresh.type = 'button';
  refresh.textContent = '↻';
  refresh.setAttribute('aria-label', 'Weer verversen');
  header.append(title, refresh);
  const name = document.createElement('p');
  name.className = 'caspr-transit-stop';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const forecast = document.createElement('div');
  forecast.className = 'caspr-weather-forecast';
  const settings = document.createElement('details');
  settings.className = 'caspr-transit-settings';
  const summary = document.createElement('summary');
  summary.textContent = 'Plaats kiezen';
  const label = document.createElement('label');
  label.textContent = 'Zoek plaats';
  const input = document.createElement('input');
  input.type = 'search';
  input.maxLength = 100;
  input.placeholder = 'Bijvoorbeeld Sint-Niklaas';
  label.append(input);
  const search = document.createElement('button');
  search.type = 'button';
  search.textContent = 'Plaats zoeken';
  const results = document.createElement('div');
  results.className = 'caspr-transit-search-results';
  settings.append(summary, label, search, results);
  const credit = document.createElement('a');
  credit.className = 'caspr-transit-credit';
  credit.href = 'https://open-meteo.com/';
  credit.target = '_blank';
  credit.rel = 'noopener noreferrer';
  credit.textContent = 'Weergegevens: Open-Meteo';
  widget.append(header, name, status, forecast, settings, credit);
  parent.append(widget);
  const format = (value: unknown, suffix: string) =>
    typeof value === 'number' && Number.isFinite(value)
      ? `${Math.round(value)}${suffix}`
      : '—';
  const render = (data: any) => {
    forecast.replaceChildren();
    const current = data.current;
    const [icon, text] = weatherDescription(current.weather_code, current.is_day === 1);
    const now = document.createElement('div');
    now.className = 'caspr-weather-now';
    const symbol = document.createElement('div');
    symbol.className = 'caspr-weather-icon';
    symbol.textContent = icon;
    symbol.setAttribute('aria-hidden', 'true');
    const info = document.createElement('div');
    const temperature = document.createElement('strong');
    temperature.className = 'caspr-weather-temperature';
    temperature.textContent = format(current.temperature_2m, '°');
    const description = document.createElement('p');
    description.textContent = text;
    info.append(temperature, description);
    now.append(symbol, info);
    const metrics = document.createElement('div');
    metrics.className = 'caspr-weather-metrics';
    for (const [title, value] of [
      ['Gevoel', format(current.apparent_temperature, '°')],
      ['Wind', format(current.wind_speed_10m, ' km/u')],
      [
        'Neerslag',
        typeof current.precipitation === 'number'
          ? `${current.precipitation.toLocaleString('nl-BE', { maximumFractionDigits: 1 })} mm`
          : '—',
      ],
    ]) {
      const item = document.createElement('div');
      const label = document.createElement('small');
      label.textContent = title;
      const number = document.createElement('strong');
      number.textContent = value;
      item.append(label, number);
      metrics.append(item);
    }
    const days = document.createElement('div');
    days.className = 'caspr-weather-days';
    for (let i = 0; i < Math.min(3, data.daily?.time?.length || 0); i++) {
      const row = document.createElement('div');
      const day = document.createElement('strong');
      day.textContent =
        i === 0
          ? 'Vandaag'
          : new Date(data.daily.time[i] * 1000).toLocaleDateString('nl-BE', {
              timeZone: 'Europe/Brussels',
              weekday: 'short',
            });
      const condition = document.createElement('span');
      const [emoji, text] = weatherDescription(data.daily.weather_code[i]);
      condition.textContent = emoji;
      condition.title = text;
      condition.setAttribute('aria-label', text);
      const temperatures = document.createElement('span');
      temperatures.textContent = `${format(data.daily.temperature_2m_min[i], '°')} / ${format(data.daily.temperature_2m_max[i], '°')}`;
      const rain = document.createElement('small');
      rain.textContent = `💧 ${format(data.daily.precipitation_probability_max[i], '%')}`;
      rain.title = 'Kans op neerslag';
      row.append(day, condition, temperatures, rain);
      days.append(row);
    }
    forecast.append(now, metrics, days);
  };
  const request = async (action: string, extra = {}) => {
    const data = await chrome.runtime.sendMessage({
      type: 'weather:request',
      action,
      ...extra,
    });
    if (!data?.ok) throw new Error(data?.error || 'Weer ophalen mislukt.');
    return data;
  };
  const load = async () => {
    if (disposed || busy || !place || document.hidden || widget.closest('[hidden]'))
      return;
    busy = true;
    refresh.disabled = true;
    lastFetch = Date.now();
    const token = revision;
    status.textContent = 'Weer laden…';
    try {
      const data = await request('forecast');
      if (disposed || token !== revision) return;
      render(data);
      status.textContent = `Weermodel · bijgewerkt om ${new Date(data.updated).toLocaleTimeString('nl-BE', { timeZone: 'Europe/Brussels', hour: '2-digit', minute: '2-digit' })}`;
    } catch (error) {
      if (!disposed && token === revision)
        status.textContent = `${(error as Error).message}${forecast.children.length ? ' Getoonde gegevens kunnen verouderd zijn.' : ''}`;
    } finally {
      busy = false;
      refresh.disabled = false;
      if (!disposed && token !== revision) void load();
    }
  };
  const configure = (value: unknown) => {
    revision++;
    place = parseWeatherPlace(value);
    forecast.replaceChildren();
    name.textContent = place?.name || 'Kies jouw plaats';
    if (!place) {
      settings.open = true;
      status.textContent = 'Zoek een plaats voor jouw weersverwachting.';
    } else if (!busy) void load();
  };
  search.onclick = async () => {
    const token = revision;
    search.disabled = true;
    results.replaceChildren();
    status.textContent = 'Plaatsen zoeken…';
    try {
      const data = await request('search', { query: input.value });
      if (disposed || token !== revision) return;
      status.textContent = data.places.length
        ? 'Kies jouw plaats.'
        : 'Geen plaatsen gevonden.';
      for (const match of data.places) {
        const choose = document.createElement('button');
        choose.type = 'button';
        choose.textContent = match.name;
        choose.onclick = async () => {
          choose.disabled = true;
          try {
            await chrome.storage.local.set({ weatherPlace: match });
            settings.open = false;
            results.replaceChildren();
          } catch {
            status.textContent = 'Plaats bewaren mislukt.';
            choose.disabled = false;
          }
        };
        results.append(choose);
      }
    } catch (error) {
      if (!disposed && token === revision) status.textContent = (error as Error).message;
    } finally {
      search.disabled = false;
    }
  };
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      search.click();
    }
  });
  refresh.onclick = () => void load();
  const changed = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area === 'local' && changes.weatherPlace)
      configure(changes.weatherPlace.newValue);
  };
  chrome.storage.onChanged.addListener(changed);
  const initial = revision;
  void chrome.storage.local
    .get('weatherPlace')
    .then((data) => {
      if (!disposed && initial === revision) configure(data.weatherPlace);
    })
    .catch(() => {
      if (!disposed) status.textContent = 'Weerinstellingen laden mislukt.';
    });
  const visible = () => {
    if (!document.hidden && Date.now() - lastFetch > 900000) void load();
  };
  document.addEventListener('visibilitychange', visible);
  const timer = setInterval(() => void load(), 900000);
  return () => {
    disposed = true;
    revision++;
    clearInterval(timer);
    chrome.storage.onChanged.removeListener(changed);
    document.removeEventListener('visibilitychange', visible);
    widget.remove();
  };
}
