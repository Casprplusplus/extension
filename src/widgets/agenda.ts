import { accountScope } from '../common/account-scope';
import { requestAgenda } from '../content/agenda-request';
import type { AgendaItem } from '../common/agenda-items';
export function mountAgenda(container: HTMLElement): () => void {
  const card = document.createElement('article');
  card.className = 'caspr-agenda-widget';
  const title = document.createElement('h3');
  title.textContent = '📅 Taken & toetsen';
  const tabs = document.createElement('div');
  tabs.className = 'caspr-agenda-tabs';
  const list = document.createElement('div');
  list.className = 'caspr-agenda-list';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const refresh = document.createElement('button');
  refresh.type = 'button';
  refresh.textContent = 'Agenda vernieuwen';
  refresh.className = 'caspr-refresh-schedule';
  const link = document.createElement('a');
  link.href = '/leerlingapp/Agenda';
  link.textContent = 'Agenda openen';
  const actions = document.createElement('div');
  actions.className = 'caspr-grades-actions';
  actions.append(refresh, link);
  card.append(title, tabs, list, status, actions);
  container.append(card);
  const scope = accountScope();
  let disposed = false,
    items: AgendaItem[] = [],
    updated = 0,
    filter = 'all';
  let controller: AbortController | undefined;
  const day = (time: number) =>
    new Date(time).toLocaleDateString('sv-SE', { timeZone: 'Europe/Brussels' });
  function render() {
    list.replaceChildren();
    const today = day(Date.now()),
      tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const upcoming = items
      .filter(
        (item) =>
          (item.start >= Date.now() ||
            (day(item.start) === today &&
              new Date(item.start).getHours() === 0 &&
              new Date(item.start).getMinutes() === 0)) &&
          (filter === 'all' || item.kind === filter),
      )
      .sort((a, b) => a.start - b.start);
    for (const item of upcoming.slice(0, 8)) {
      const row = document.createElement('a');
      row.href = link.href;
      row.className = 'caspr-agenda-item';
      row.dataset.kind = item.kind;
      const heading = document.createElement('strong');
      heading.textContent = item.title
        .replace(/^(\s*[A-Z&0-9-]+\s*:)\s*(?:grote\s+toets|toets|taak)\s*:\s*/i, '$1 ')
        .replace(/\b(?:grote\s+toets|toets)\s*:\s*/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      heading.title = item.title;
      const detail = document.createElement('small');
      const date = day(item.start);
      const label =
        date === today
          ? 'Vandaag'
          : date === day(tomorrow.getTime())
            ? 'Morgen'
            : new Date(item.start).toLocaleDateString('nl-BE', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                timeZone: 'Europe/Brussels',
              });
      detail.textContent = `${item.kind === 'test' ? 'Toets' : 'Taak'} · ${label} · ${new Date(item.start).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}`;
      row.append(heading, detail);
      list.append(row);
    }
    if (!upcoming.length)
      list.textContent = updated
        ? 'Geen komende taken of toetsen in je gesynchroniseerde agenda.'
        : 'Je agenda wordt opgehaald…';
    if (updated)
      status.textContent = `Laatst bijgewerkt: ${new Date(updated).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
  }
  for (const [value, label] of [
    ['all', 'Alles'],
    ['task', 'Taken'],
    ['test', 'Toetsen'],
  ]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.setAttribute('aria-pressed', String(value === filter));
    b.onclick = () => {
      filter = value;
      for (const child of tabs.children)
        child.setAttribute('aria-pressed', String(child === b));
      render();
    };
    tabs.append(b);
  }
  function read(value: unknown) {
    const cache = value as
      { scope?: string; updated?: number; items?: AgendaItem[] } | undefined;
    if (cache?.scope !== scope || !Array.isArray(cache.items)) return;
    items = cache.items.filter(
      (item) =>
        item &&
        Number.isFinite(item.start) &&
        typeof item.title === 'string' &&
        ['task', 'test'].includes(item.kind),
    );
    updated = typeof cache.updated === 'number' ? cache.updated : 0;
    render();
  }
  const load = async () => {
    controller?.abort();
    controller = new AbortController();
    const timeout = setTimeout(() => controller?.abort(), 15000);
    refresh.disabled = true;
    try {
      await requestAgenda(controller.signal);
      if (disposed || accountScope() !== scope) return;
      status.textContent = 'Agenda bijgewerkt.';
    } catch (error) {
      if (!disposed) {
        render();
        status.textContent =
          error instanceof Error ? error.message : 'Agenda ophalen mislukt.';
      }
    } finally {
      clearTimeout(timeout);
      if (!disposed) refresh.disabled = false;
    }
  };
  const changed = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area === 'local' && changes.agendaCache && !disposed)
      read(changes.agendaCache.newValue);
  };
  chrome.storage.onChanged.addListener(changed);
  refresh.onclick = () => void load();
  render();
  void chrome.storage.local
    .get('agendaCache')
    .then((data) => {
      if (disposed) return;
      read(data.agendaCache);
      if (!updated || Date.now() - updated > 5 * 60000) void load();
    })
    .catch(() => {
      if (!disposed) void load();
    });
  return () => {
    disposed = true;
    controller?.abort();
    chrome.storage.onChanged.removeListener(changed);
    card.remove();
  };
}
