import { orderedTileIds, type DashboardLayout } from '../common/dashboard-layout';

let editing = false;

export function mountDashboardLayout(
  content: HTMLElement,
  tiles: HTMLAnchorElement[],
  preferences: DashboardLayout,
): { grid: HTMLElement; cleanup: () => void } {
  let disposed = false;
  let dragged = '';

  const entries = tiles.map((tile) => {
    const column = tile.parentElement!;
    const placeholder = document.createComment('CASPR++ tile position');

    column.before(placeholder);

    return {
      tile,
      column,
      placeholder,
      id: new URL(tile.href).pathname.toLowerCase(),
      label: tile.textContent?.trim() || 'Tegel',
    };
  });

  const toolbar = document.createElement('section');
  toolbar.className = 'caspr-dashboard-controls';
  toolbar.setAttribute('aria-label', 'Focusmodus');

  const focus = document.createElement('button');
  focus.type = 'button';
  focus.className = 'caspr-focus-toggle';
  focus.textContent = preferences.focus ? '🎯 Focusmodus aan' : '🎯 Focusmodus';
  focus.setAttribute('aria-pressed', String(preferences.focus));

  const description = document.createElement('p');
  description.textContent = preferences.focus
    ? 'Even rust: chat en games zijn verborgen.'
    : 'Verberg Chats en Games om je op schoolwerk te concentreren.';

  const status = document.createElement('p');
  status.className = 'caspr-layout-status';
  status.setAttribute('role', 'status');

  const editor = document.createElement('details');
  editor.className = 'caspr-layout-editor';
  editor.open = editing;

  const summary = document.createElement('summary');
  summary.textContent = '⚙️ Dashboard aanpassen';

  const instructions = document.createElement('p');
  instructions.textContent =
    'Gebruik de pijlen voor de volgorde. Vink een tegel uit om hem te verbergen. De navigatie blijft beschikbaar.';

  const list = document.createElement('ul');
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = 'Standaardindeling herstellen';

  editor.append(summary, instructions, list, reset);
  toolbar.append(focus, description, status);
  content.prepend(toolbar);

  const grid = document.createElement('div');
  grid.className = 'caspr-custom-grid';
  entries[0]?.placeholder.parentElement?.before(grid);

  const order = orderedTileIds(
    entries.map((entry) => entry.id),
    preferences.order,
  );
  const hidden = new Set(preferences.hidden);

  const save = async (next: DashboardLayout) => {
    if (disposed) return;

    try {
      await chrome.storage.local.set({ dashboardLayout: next });
    } catch {
      if (!disposed) status.textContent = 'Opslaan mislukt. Probeer opnieuw.';
    }
  };

  focus.addEventListener(
    'click',
    () => void save({ ...preferences, focus: !preferences.focus }),
  );
  reset.addEventListener(
    'click',
    () => void save({ ...preferences, order: [], hidden: [] }),
  );

  const move = (id: string, target: string) => {
    const next = order.filter((value) => value !== id);

    next.splice(next.indexOf(target), 0, id);
    void save({ ...preferences, order: next });
  };

  const eventCleanups: (() => void)[] = [];

  for (const [index, id] of order.entries()) {
    const entry = entries.find((entry) => entry.id === id)!;
    grid.append(entry.column);
    entry.column.classList.add('caspr-custom-column');
    entry.column.dataset.casprHidden = String(hidden.has(id));

    const item = document.createElement('li');
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !hidden.has(id);
    label.append(checkbox, document.createTextNode(entry.label));

    checkbox.addEventListener('change', () => {
      const next = new Set(hidden);

      if (checkbox.checked) next.delete(id);
      else next.add(id);

      void save({ ...preferences, hidden: [...next] });
    });

    item.append(label);

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
        `${entry.label} ${offset < 0 ? 'omhoog' : 'omlaag'}`,
      );

      button.addEventListener('click', () => {
        const next = [...order];
        [next[index], next[index + offset]] = [next[index + offset], next[index]];

        void save({ ...preferences, order: next });
      });

      item.append(button);
    }

    list.append(item);

    const prevent = (event: Event) => {
      if (grid.dataset.editing === 'true') event.preventDefault();
    };

    const dragstart = (event: DragEvent) => {
      if (!editor.open) {
        event.preventDefault();
        return;
      }

      dragged = id;
      event.dataTransfer?.setData('text/plain', id);

      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    };

    const dragover = (event: DragEvent) => {
      if (editor.open && dragged) event.preventDefault();
    };

    const drop = (event: DragEvent) => {
      if (!editor.open || !dragged || dragged === id) return;
      event.preventDefault();

      move(dragged, id);

      dragged = '';
    };

    const dragend = () => {
      dragged = '';
    };

    entry.tile.addEventListener('click', prevent);
    entry.column.addEventListener('dragstart', dragstart);
    entry.column.addEventListener('dragover', dragover);
    entry.column.addEventListener('drop', drop);
    entry.column.addEventListener('dragend', dragend);

    eventCleanups.push(() => {
      entry.tile.removeEventListener('click', prevent);
      entry.column.removeEventListener('dragstart', dragstart);
      entry.column.removeEventListener('dragover', dragover);
      entry.column.removeEventListener('drop', drop);
      entry.column.removeEventListener('dragend', dragend);
    });
  }

  const updateEditor = () => {
    if (disposed) return;

    editing = editor.open;
    grid.dataset.editing = 'false';

    entries.forEach((entry) => {
      entry.column.draggable = false;
    });
  };

  editor.addEventListener('toggle', updateEditor);
  updateEditor();

  document.documentElement.dataset.casprFocus = String(preferences.focus);

  return {
    grid,
    cleanup: () => {
      disposed = true;
      eventCleanups.forEach((cleanup) => cleanup());

      for (const entry of entries) {
        entry.placeholder.replaceWith(entry.column);
        entry.column.classList.remove('caspr-custom-column');

        delete entry.column.dataset.casprHidden;

        entry.column.removeAttribute('draggable');
      }

      grid.remove();
      toolbar.remove();

      document.documentElement.removeAttribute('data-caspr-focus');
    },
  };
}
