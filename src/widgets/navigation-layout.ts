import { orderedTileIds, type DashboardLayout } from '../common/dashboard-layout';

let expanded = false;

export function mountNavigationLayout(
  content: HTMLElement,
  preferences: DashboardLayout,
): () => void {
  let disposed = false;

  const originals: { item: HTMLElement; placeholder: Comment }[] = [];
  const labels = new Map<string, string>();

  for (const list of document.querySelectorAll<HTMLElement>(
    '.navbar-sidebar .navbar__list, .navbar-mobile .navbar__list',
  )) {
    const entries = [...list.children].flatMap((element) => {
      const item = element as HTMLElement;
      const link = item.querySelector<HTMLAnchorElement>(':scope > a[href]');

      if (!link) return [];

      const url = new URL(link.href, location.href);

      if (
        url.origin !== location.origin ||
        url.hash ||
        url.pathname.toLowerCase().startsWith('/auth')
      )
        return [];
      const id = url.pathname.toLowerCase();
      const copy = link.cloneNode(true) as HTMLElement;

      copy.querySelectorAll('i, .caspr-nav-emoji').forEach((icon) => icon.remove());
      labels.set(id, copy.textContent?.trim() || 'Navigatie-item');

      const placeholder = document.createComment('CASPR++ original navigation position');
      item.before(placeholder);
      originals.push({ item, placeholder });

      return [{ item, id }];
    });

    for (const id of orderedTileIds(
      entries.map((entry) => entry.id),
      preferences.order,
    )) {
      const entry = entries.find((entry) => entry.id === id)!;
      list.append(entry.item);

      entry.item.dataset.casprNavHidden = String(preferences.hidden.includes(id));
    }
  }

  const panel = document.createElement('details');
  panel.className =
    'caspr-dashboard-controls caspr-layout-editor caspr-navigation-editor';
  panel.open = expanded;

  const summary = document.createElement('summary');
  summary.textContent = '🧭 Navigatie aanpassen';

  const note = document.createElement('p');
  note.textContent =
    'Kies wat je ziet in de zijbalk en het mobiele menu. Gebruik de pijlen voor de volgorde. Dashboardtegels hebben hun eigen instellingen.';

  const list = document.createElement('ul');
  const status = document.createElement('p');
  status.setAttribute('role', 'status');

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = 'Standaardnavigatie herstellen';

  panel.append(summary, note, list, reset, status);
  content.prepend(panel);

  const order = orderedTileIds([...labels.keys()], preferences.order);
  const save = async (order: string[], hidden: string[]) => {
    try {
      await chrome.storage.local.set({ navigationLayout: { order, hidden } });
    } catch {
      if (!disposed) status.textContent = 'Opslaan mislukt. Probeer opnieuw.';
    }
  };

  reset.addEventListener('click', () => void save([], []));

  for (const [index, id] of order.entries()) {
    const row = document.createElement('li');
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !preferences.hidden.includes(id);
    label.append(checkbox, document.createTextNode(labels.get(id)!));

    checkbox.addEventListener('change', () => {
      const hidden = new Set(preferences.hidden);

      if (checkbox.checked) hidden.delete(id);
      else hidden.add(id);

      void save(order, [...hidden]);
    });

    row.append(label);

    for (const [offset, icon] of [
      [-1, '↑'],
      [1, '↓'],
    ] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = icon;
      button.disabled = index + offset < 0 || index + offset >= order.length;

      button.setAttribute(
        'aria-label',
        `${labels.get(id)} ${offset < 0 ? 'omhoog' : 'omlaag'}`,
      );

      button.addEventListener('click', () => {
        const next = [...order];
        [next[index], next[index + offset]] = [next[index + offset], next[index]];

        void save(next, preferences.hidden);
      });

      row.append(button);
    }

    list.append(row);
  }

  panel.addEventListener('toggle', () => {
    if (!disposed) expanded = panel.open;
  });

  return () => {
    disposed = true;

    for (const { item, placeholder } of originals) {
      placeholder.replaceWith(item);
      delete item.dataset.casprNavHidden;
    }

    panel.remove();
  };
}
