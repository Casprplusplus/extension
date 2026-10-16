interface RouteStop {
  name: string;
  scheduled: number;
  expected: number;
  realtime: boolean;
  cancelled: boolean;
  current: boolean;
  passed?: boolean;
  platform?: string;
  platformChanged?: boolean;
}
export function createTransitRoute() {
  const dialog = document.createElement('dialog');
  dialog.className = 'caspr-community caspr-social-dialog caspr-route-dialog';
  dialog.setAttribute('aria-label', 'Ritdetails');
  const header = document.createElement('header');
  const title = document.createElement('h2');
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '✕';
  close.setAttribute('aria-label', 'Ritdetails sluiten');
  close.onclick = () => dialog.close();
  header.append(title, close);
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const list = document.createElement('ol');
  list.className = 'caspr-route-stops';
  dialog.append(header, status, list);
  document.body.append(dialog);
  let revision = 0;
  let disposed = false;
  dialog.addEventListener('close', () => {
    revision++;
  });
  const format = (value: number) =>
    new Date(value).toLocaleTimeString('nl-BE', {
      timeZone: 'Europe/Brussels',
      hour: '2-digit',
      minute: '2-digit',
    });
  return {
    async open(name: string, request: Record<string, unknown>) {
      const token = ++revision;
      title.textContent = name;
      status.textContent = 'Haltes laden…';
      list.replaceChildren();
      if (!dialog.open) dialog.showModal();
      try {
        const data = await chrome.runtime.sendMessage({ ...request, action: 'route' });
        if (disposed || token !== revision || !dialog.open) return;
        if (!data?.ok) throw new Error(data?.error || 'Ritdetails ophalen mislukt.');
        const stops = (Array.isArray(data.stops) ? data.stops : []) as RouteStop[];
        status.textContent = stops.length
          ? data.note || 'Volgende haltes'
          : 'Geen haltes beschikbaar voor deze rit.';
        for (const stop of stops) {
          const row = document.createElement('li');
          row.dataset.current = String(stop.current);
          row.dataset.passed = String(!!stop.passed);
          const body = document.createElement('div');
          const heading = document.createElement('strong');
          heading.textContent = stop.name;
          const meta = document.createElement('small');
          meta.textContent = [
            stop.current ? 'Jouw vertrekhalte' : '',
            stop.passed ? 'Voorbij' : '',
            stop.platform
              ? `Spoor ${stop.platform}${stop.platformChanged ? ' · gewijzigd' : ''}`
              : '',
          ]
            .filter(Boolean)
            .join(' · ');
          const delay = Math.ceil((stop.expected - stop.scheduled) / 60000);
          const badge = document.createElement('span');
          badge.className = 'caspr-route-status';
          row.dataset.state = stop.cancelled
            ? 'cancelled'
            : !stop.realtime
              ? 'scheduled'
              : delay > 0
                ? 'delayed'
                : 'ontime';
          badge.textContent = stop.cancelled
            ? 'Geschrapt'
            : !stop.realtime
              ? 'Dienstregeling'
              : delay > 0
                ? `+${delay} min`
                : 'Op tijd';
          body.append(heading, meta, badge);
          const time = document.createElement('time');
          if (Number.isFinite(stop.expected)) {
            time.textContent = format(stop.expected);
            time.dateTime = new Date(stop.expected).toISOString();
          } else time.textContent = '—';
          if (Number.isFinite(stop.scheduled))
            time.title = `Gepland: ${format(stop.scheduled)}`;
          row.append(body, time);
          list.append(row);
        }
      } catch (error) {
        if (!disposed && token === revision)
          status.textContent =
            error instanceof Error ? error.message : 'Ritdetails ophalen mislukt.';
      }
    },
    close() {
      revision++;
      if (dialog.open) dialog.close();
    },
    cleanup() {
      disposed = true;
      revision++;
      dialog.remove();
    },
  };
}
export function makeDepartureClickable(
  row: HTMLElement,
  label: string,
  open: () => void,
) {
  row.tabIndex = 0;
  row.setAttribute('role', 'button');
  row.setAttribute('aria-label', label);
  row.setAttribute('aria-haspopup', 'dialog');
  row.classList.add('caspr-transit-clickable');
  row.title = 'Klik om de volgende haltes te bekijken';
  row.addEventListener('click', open);
  row.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open();
    }
  });
}
