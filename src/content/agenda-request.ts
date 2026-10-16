import { accountScope } from '../common/account-scope';
import { agendaKind, parseAgendaItems, type AgendaItem } from '../common/agenda-items';
export function watchAgendaCapture(): void {
  let timer: ReturnType<typeof setTimeout>;
  let signature = '';
  const capture = () => {
    if (!document.documentElement.hasAttribute('data-caspr-dashboard')) return;
    const scope = accountScope();
    if (!scope) return;
    const items: AgendaItem[] = [];
    for (const column of document.querySelectorAll<HTMLElement>(
      '.fc-timegrid-col[data-date], .fc-daygrid-day[data-date]',
    )) {
      const date = column.dataset.date;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      for (const event of column.querySelectorAll<HTMLElement>('.fc-event')) {
        const title = (
          event.querySelector('.fc-event-title')?.textContent ||
          event.querySelector('.fc-event-main')?.textContent ||
          event.textContent ||
          ''
        )
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 250);
        const kind = agendaKind(title);
        if (!kind) continue;
        const time = event
          .querySelector('.fc-event-time')
          ?.textContent?.match(/(\d{1,2}):(\d{2})/);
        const start = Date.parse(
          `${date}T${time ? time[1].padStart(2, '0') + ':' + time[2] : '00:00'}:00`,
        );
        if (Number.isFinite(start)) items.push({ title, start, kind });
      }
    }
    const next = JSON.stringify({ scope, items });
    if (
      !document.querySelector(
        '.fc-timegrid-col[data-date], .fc-daygrid-day[data-date]',
      ) ||
      next === signature
    )
      return;
    signature = next;
    void chrome.storage.local
      .get('agendaCache')
      .then((data) => {
        if (accountScope() !== scope) return;
        const cache = data.agendaCache as
          { scope?: string; items?: AgendaItem[] } | undefined;
        const previous =
          cache?.scope === scope && Array.isArray(cache.items)
            ? cache.items.filter(
                (item) =>
                  item && Number.isFinite(item.start) && typeof item.title === 'string',
              )
            : [];
        const dates = new Set(
          [...document.querySelectorAll<HTMLElement>('[data-date]')].map(
            (node) => node.dataset.date,
          ),
        );
        const merged = previous.filter(
          (item: AgendaItem) =>
            !dates.has(
              new Date(item.start).toLocaleDateString('sv-SE', {
                timeZone: 'Europe/Brussels',
              }),
            ),
        );
        return chrome.storage.local.set({
          agendaCache: {
            scope,
            updated: Date.now(),
            items: [...merged, ...items].slice(-500),
          },
        });
      })
      .catch(() => {});
  };
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(capture, 400);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  capture();
  window.addEventListener(
    'pagehide',
    () => {
      observer.disconnect();
      clearTimeout(timer);
    },
    { once: true },
  );
}
export async function requestAgenda(signal: AbortSignal): Promise<AgendaItem[]> {
  const scope = accountScope();
  if (!scope) throw new Error('Meld je aan bij CASPR.');
  const options: RequestInit = {
    credentials: 'same-origin',
    redirect: 'error',
    cache: 'no-store',
    signal,
  };
  const page = await fetch('/leerlingapp/Agenda', options);
  if (!page.ok) throw new Error('Agenda ophalen mislukt.');
  const html = await page.text();
  // Read the actual calendar endpoint from CASPR; never execute page scripts.
  const paths = [
    ...html.matchAll(/["'](\/(?:leerlingapp|LeerlingApp)\/[^"'<>\s]+)["']/g),
  ].map((match) => match[1]);
  const path = paths.find((path) => /\/(?:GetAgenda[^/]*|AgendaGet[^/]*)/i.test(path));
  if (!path)
    throw new Error(
      'Open je CASPR-agenda één keer om taken en toetsen te synchroniseren.',
    );
  const url = new URL(path, location.origin);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 30);
  url.searchParams.set('start', start.toISOString());
  url.searchParams.set('end', end.toISOString());
  const response = await fetch(url, {
    ...options,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok || !response.headers.get('content-type')?.includes('json'))
    throw new Error('Agenda niet beschikbaar. Open de agenda om te synchroniseren.');
  const items = parseAgendaItems(await response.json());
  if (scope !== accountScope() || signal.aborted)
    throw new Error('Agenda-aanvraag geannuleerd.');
  await chrome.storage.local.set({ agendaCache: { scope, updated: Date.now(), items } });
  return items;
}
