import {
  parseHome,
  safeLink,
  type HomeLayout,
  type HomeItem,
} from '../common/home-layout';
import { parseDashboard } from '../common/dashboard';
import { parseTimeOptions } from '../common/time-widgets';
import { parseStudio } from '../common/theme-studio';
export function mountHomeStudio(content: HTMLElement): () => void {
  let disposed = false,
    editing = false,
    library: HomeLayout[] = [],
    state = parseHome(null),
    undo: HomeLayout[] = [],
    redo: HomeLayout[] = [];
  let queue = Promise.resolve();
  let ready = false;
  const originals = new Map<
    string,
    { node: HTMLElement; placeholder: Comment; title: string }
  >();
  const grid = document.createElement('section');
  grid.className = 'caspr-home-grid';
  grid.setAttribute('aria-label', 'Mijn startscherm');
  const toolbar = document.createElement('section');
  toolbar.className = 'caspr-home-toolbar';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const dialog = document.createElement('dialog');
  dialog.className = 'caspr-community caspr-studio-dialog caspr-home-studio-dialog';
  dialog.setAttribute('aria-label', 'Startscherm Studio');
  const title = document.createElement('h2');
  title.textContent = '🧩 Startscherm Studio';
  const note = document.createElement('p');
  note.textContent =
    'Sleep kaarten via de greep ⋮⋮ of gebruik de pijlen. Via ‘Op pagina verslepen’ verplaats je de widgets op je startscherm. Alles wordt automatisch opgeslagen.';
  note.className = 'caspr-home-studio-note';
  const list = document.createElement('div');
  list.className = 'caspr-home-settings-list';
  const actions = document.createElement('div');
  actions.className = 'caspr-studio-actions';
  const presets = document.createElement('div');
  const filters = document.createElement('section');
  filters.className = 'caspr-home-filters';
  filters.setAttribute('aria-label', 'Widgets zoeken en filteren');
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Zoek widget, zoals weer, bus of resultaten…';
  search.setAttribute('aria-label', 'Widget zoeken');
  const visibility = document.createElement('select');
  visibility.setAttribute('aria-label', 'Filter op zichtbaarheid');
  for (const [value, text] of [
    ['all', 'Alles tonen'],
    ['visible', 'Zichtbaar'],
    ['hidden', 'Verborgen'],
  ])
    visibility.append(new Option(text, value));
  const searchRow = document.createElement('div');
  searchRow.className = 'caspr-home-search-row';
  searchRow.append(search, visibility);
  const categories = document.createElement('div');
  categories.className = 'caspr-home-categories';
  categories.setAttribute('role', 'group');
  categories.setAttribute('aria-label', 'Widgetcategorie');
  let category = 'all';
  const categoryNames: Record<string, string> = {
    all: 'Alles',
    school: 'School',
    planning: 'Planning',
    travel: 'Vervoer & weer',
    personal: 'Persoonlijk',
    custom: 'Eigen kaarten',
  };
  for (const [value, text] of Object.entries(categoryNames)) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.textContent = text;
    tab.dataset.category = value;
    tab.setAttribute('aria-pressed', String(value === category));
    tab.onclick = () => {
      category = value;
      applyFilters();
    };
    categories.append(tab);
  }
  const count = document.createElement('p');
  count.className = 'caspr-home-filter-count';
  count.setAttribute('role', 'status');
  const empty = document.createElement('p');
  empty.className = 'caspr-home-filter-empty';
  empty.textContent = 'Geen widgets gevonden. Probeer een andere zoekterm of categorie.';
  empty.hidden = true;
  filters.append(searchRow, categories, count);
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  function itemCategory(item: HomeItem): string {
    if (item.kind !== 'widget') return 'custom';
    if (/delijn|nmbs|weather/.test(item.id)) return 'travel';
    if (/agenda|today|next-lesson|countdown|clock|pomodoro|groupwork/.test(item.id))
      return 'planning';
    if (/grades/.test(item.id)) return 'school';
    return 'personal';
  }
  function applyFilters() {
    const query = normalize(search.value.trim());
    let matches = 0;
    for (const row of list.querySelectorAll<HTMLElement>('.caspr-home-row')) {
      const item = state.items.find((item) => item.id === row.dataset.homeItem);
      if (!item) continue;
      const group = itemCategory(item);
      const keywords = /delijn/.test(item.id)
        ? 'bus tram halte de lijn'
        : /nmbs/.test(item.id)
          ? 'trein station'
          : /weather/.test(item.id)
            ? 'weer weather temperatuur regen'
            : /pomodoro/.test(item.id)
              ? 'focus timer'
              : /grades/.test(item.id)
                ? 'punten resultaten rapport'
                : '';
      row.hidden =
        !(category === 'all' || category === group) ||
        !(
          visibility.value === 'all' || (visibility.value === 'hidden') === item.hidden
        ) ||
        !normalize(`${item.title} ${categoryNames[group]} ${keywords}`).includes(query);
      if (!row.hidden) matches++;
    }
    for (const tab of categories.querySelectorAll<HTMLButtonElement>('button'))
      tab.setAttribute('aria-pressed', String(tab.dataset.category === category));
    count.textContent = `${matches} van ${list.children.length} kaarten · wijzigingen worden automatisch opgeslagen`;
    empty.hidden = matches > 0;
  }
  search.addEventListener('input', applyFilters);
  visibility.addEventListener('change', applyFilters);
  const header = document.createElement('header');
  header.className = 'caspr-studio-header';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'caspr-community-close';
  close.textContent = '✕';
  close.setAttribute('aria-label', 'Startscherm Studio sluiten');
  close.addEventListener('click', () => dialog.close());
  header.append(title, close);
  dialog.append(header, note, presets, actions, filters, list, empty);
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      dialog.close();
  });
  document.body.append(dialog);
  content.prepend(toolbar, grid);
  toolbar.append(status);
  const source = [
    ...content.querySelectorAll<HTMLElement>(
      '#caspr-dashboard-widgets > article, .caspr-grades-overview',
    ),
  ];
  source.forEach((node) => {
    const anchor = node.querySelector<HTMLAnchorElement>('a.leerlingAppTile');
    const name = node.classList.contains('caspr-clock-widget')
      ? 'Klok'
      : node.classList.contains('caspr-grades-overview')
        ? '📊 Resultaten'
        : node.querySelector('h2,h3,summary')?.textContent?.trim() ||
          node.textContent?.trim().slice(0, 80) ||
          'Widget';
    const id = anchor
      ? 'tile:' + new URL(anchor.href).pathname.toLowerCase()
      : node.tagName === 'ARTICLE'
        ? 'widget:' + node.classList[0]
        : node.classList.contains('caspr-grades-overview')
          ? 'widget:grades'
          : 'tile:extra-' +
            (node.querySelector('[data-caspr-chat]')
              ? 'chat'
              : node.textContent?.includes('Instellingen')
                ? 'settings'
                : 'games');
    const placeholder = document.createComment('Startscherm oorspronkelijke positie');
    node.before(placeholder);
    originals.set(id, { node, placeholder, title: name });
    node.removeAttribute('data-caspr-hidden');
  });
  function reconcile(next: HomeLayout): HomeLayout {
    const result = parseHome(next);
    const useDefault = result.items.length === 0;
    const widths: Record<string, number> = {
      'widget:caspr-welcome-widget': 3,
      'widget:caspr-agenda-widget': 2,
      'widget:grades': 2,
      'widget:caspr-today-widget': 2,
      'widget:caspr-delijn-widget': 2,
      'widget:caspr-nmbs-widget': 2,
      'widget:caspr-weather-widget': 2,
    };
    for (const [id, entry] of originals)
      if (!result.items.some((item) => item.id === id))
        result.items.push({
          id,
          kind: 'widget',
          title: entry.title,
          text: '',
          url: '',
          image: '',
          width: widths[id] || 1,
          height: 1,
          framed: true,
          hidden: ![
            'widget:caspr-welcome-widget',
            'widget:caspr-clock-widget',
            'widget:caspr-today-widget',
            'widget:caspr-agenda-widget',
            'widget:grades',
            'widget:caspr-weather-widget',
          ].includes(id),
        });
    if (useDefault) {
      const order = [
        'widget:caspr-welcome-widget',
        'widget:caspr-clock-widget',
        'widget:caspr-today-widget',
        'widget:caspr-agenda-widget',
        'widget:grades',
        'widget:caspr-weather-widget',
        'widget:caspr-delijn-widget',
        'widget:caspr-nmbs-widget',
        'widget:caspr-pomodoro',
        'widget:caspr-next-lesson-widget',
        'widget:caspr-countdown-widget',
        'widget:caspr-groupwork-widget',
        'widget:caspr-shortcuts-widget',
        'widget:caspr-progression',
      ];
      result.items.sort(
        (a, b) =>
          (order.indexOf(a.id) < 0 ? 100 : order.indexOf(a.id)) -
          (order.indexOf(b.id) < 0 ? 100 : order.indexOf(b.id)),
      );
      result.name = 'Schooldag';
    }
    return result;
  }
  function button(
    text: string,
    action: () => void | Promise<void>,
    parent: HTMLElement = actions,
  ) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    parent.append(b);
    b.addEventListener('click', () => {
      void Promise.resolve()
        .then(() => {
          if (!ready) throw new Error('De editor wordt nog geladen.');
          return action();
        })
        .catch((error) => {
          if (!disposed) status.textContent = error.message || 'Opslaan mislukt.';
        });
    });
    return b;
  }
  function persist() {
    const snapshot = parseHome(state);
    queue = queue
      .then(() => chrome.storage.local.set({ homeLayout: snapshot }))
      .catch(() => {
        if (!disposed) status.textContent = 'Opslaan mislukt. Probeer opnieuw.';
      });
  }
  function change(next: HomeLayout) {
    undo.push(parseHome(state));
    undo = undo.slice(-30);
    redo = [];
    state = reconcile(next);
    render();
    persist();
  }
  function update(id: string, patch: Partial<HomeItem>) {
    change({
      ...state,
      items: state.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  }
  function move(id: string, offset: number) {
    const items = [...state.items];
    const i = items.findIndex((item) => item.id === id),
      direction = offset < 0 ? -1 : 1;
    let j = i + direction;
    while (
      j >= 0 &&
      j < items.length &&
      (items[j].hidden || (items[j].kind === 'widget' && !originals.has(items[j].id)))
    )
      j += direction;
    if (i < 0 || j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    change({ ...state, items });
  }
  let dragged = '';
  const availabilityObserver = new MutationObserver((entries) => {
    for (const entry of entries) {
      const node = entry.target as HTMLElement;
      const card = node.parentElement;
      if (!card?.classList.contains('caspr-home-card')) continue;
      const item = state.items.find((item) => item.id === card.dataset.widget);
      card.hidden = Boolean(item?.hidden || node.hidden);
    }
  });
  for (const { node } of originals.values())
    availabilityObserver.observe(node, { attributes: true, attributeFilter: ['hidden'] });
  function measureCard(node: Element): void {
    if (disposed || grid.dataset.default === 'true') return;
    const card = node.parentElement;
    if (!card || card.hidden || !card.classList.contains('caspr-home-card')) return;
    const css = getComputedStyle(grid);
    if (css.display !== 'grid') return;
    const rowHeight = parseFloat(css.gridAutoRows),
      gap = parseFloat(css.rowGap) || 0;
    if (!Number.isFinite(rowHeight) || rowHeight <= 0) return;
    const minimum = Number(card.dataset.height || 1) * 110;
    const height = Math.max(minimum, node.getBoundingClientRect().height);
    const span = `span ${Math.max(1, Math.ceil((height + gap) / (rowHeight + gap)))}`;
    if (card.style.gridRow !== span) card.style.gridRow = span;
  }
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) measureCard(entry.target);
  });
  function render() {
    if (disposed) return;
    resizeObserver.disconnect();
    grid.replaceChildren();
    grid.dataset.editing = String(editing);
    toolbar.dataset.editing = String(editing);
    const expected = [
      ['widget:caspr-welcome-widget', 3],
      ['widget:caspr-clock-widget', 1],
      ['widget:caspr-today-widget', 2],
      ['widget:caspr-agenda-widget', 2],
      ['widget:grades', 2],
      ['widget:caspr-weather-widget', 2],
    ] as const;
    const visible = state.items.filter(
      (item) => !item.hidden && (item.kind !== 'widget' || originals.has(item.id)),
    );
    grid.dataset.default = String(
      !editing &&
        visible.length === expected.length &&
        visible.every(
          (item, index) =>
            item.id === expected[index][0] &&
            item.width === expected[index][1] &&
            item.height === 1,
        ),
    );
    list.replaceChildren();
    for (const item of state.items) {
      const original = originals.get(item.id);
      if (item.kind === 'widget' && !original) continue;
      const wrapper = document.createElement('div');
      wrapper.className = 'caspr-home-card';
      wrapper.dataset.framed = String(item.framed);
      wrapper.dataset.widget = item.id;
      wrapper.hidden = item.hidden || Boolean(original?.node.hidden);
      wrapper.style.gridColumn = `span ${item.width}`;
      wrapper.dataset.height = String(item.height);
      wrapper.style.gridRow = `span ${Math.ceil((item.height * 110 + 12) / 20)}`;
      if (original) wrapper.append(original.node);
      else {
        const article = document.createElement('article');
        const h = document.createElement('h3');
        h.textContent = item.title;
        article.append(h);
        if (item.kind === 'text') {
          const p = document.createElement('p');
          p.textContent = item.text;
          p.style.whiteSpace = 'pre-wrap';
          article.append(p);
        }
        if (item.kind === 'image' && item.image) {
          const img = document.createElement('img');
          img.src = item.image;
          img.alt = item.text || item.title;
          article.append(img);
        }
        if (item.kind === 'link') {
          const a = document.createElement('a');
          a.textContent = item.text || 'Openen';
          if (item.url) {
            a.href = item.url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
          }
          article.append(a);
        }
        wrapper.append(article);
      }
      wrapper.draggable = editing;
      if (editing) {
        const grip = document.createElement('span');
        grip.className = 'caspr-home-card-grip';
        grip.textContent = '⋮⋮ Verplaatsen';
        grip.setAttribute('aria-hidden', 'true');
        wrapper.append(grip);
      }
      wrapper.addEventListener('dragstart', (e) => {
        if (!editing) return;
        dragged = item.id;
        e.dataTransfer?.setData('text/plain', item.id);
      });
      wrapper.addEventListener('dragover', (e) => {
        if (editing && dragged) e.preventDefault();
      });
      wrapper.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!editing || !dragged || dragged === item.id) return;
        const items = state.items.filter((i) => i.id !== dragged);
        const moving = state.items.find((i) => i.id === dragged);
        if (moving) {
          const bounds = wrapper.getBoundingClientRect();
          const after = e.clientY > bounds.top + bounds.height / 2;
          const targetIndex = items.findIndex((i) => i.id === item.id);
          items.splice(targetIndex + (after ? 1 : 0), 0, moving);
          change({ ...state, items });
        }
        dragged = '';
      });
      wrapper.addEventListener('dragend', () => {
        dragged = '';
      });
      wrapper.addEventListener(
        'click',
        (e) => {
          if (editing) {
            e.preventDefault();
            e.stopPropagation();
          }
        },
        true,
      );
      grid.append(wrapper);
      if (!wrapper.hidden && wrapper.firstElementChild) {
        measureCard(wrapper.firstElementChild);
        resizeObserver.observe(wrapper.firstElementChild);
      }
      const row = document.createElement('section');
      row.className = 'caspr-home-row';
      const grip = document.createElement('button');
      grip.type = 'button';
      grip.className = 'caspr-home-row-grip';
      grip.textContent = '⋮⋮';
      grip.draggable = true;
      grip.title = 'Sleep om te verplaatsen · pijltjestoetsen om te verschuiven';
      grip.setAttribute('aria-label', `${item.title} verplaatsen`);
      grip.addEventListener('dragstart', (event) => {
        dragged = item.id;
        row.classList.add('caspr-home-dragging');
        event.dataTransfer?.setData('text/plain', item.id);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
      });
      grip.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        event.preventDefault();
        move(item.id, event.key === 'ArrowUp' ? -1 : 1);
        list
          .querySelector<HTMLElement>(
            `[data-home-item="${item.id}"] .caspr-home-row-grip`,
          )
          ?.focus();
      });
      row.dataset.homeItem = item.id;
      row.addEventListener('dragover', (event) => {
        if (!dragged || dragged === item.id) return;
        event.preventDefault();
        const after =
          event.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2;
        row.dataset.drop = after ? 'after' : 'before';
      });
      row.addEventListener('dragleave', () => delete row.dataset.drop);
      row.addEventListener('drop', (event) => {
        event.preventDefault();
        if (!dragged || dragged === item.id) return;
        const moving = state.items.find((value) => value.id === dragged);
        const items = state.items.filter((value) => value.id !== dragged);
        const target = items.findIndex((value) => value.id === item.id);
        if (moving && target >= 0) {
          items.splice(target + (row.dataset.drop === 'after' ? 1 : 0), 0, moving);
          dragged = '';
          change({ ...state, items });
        }
      });
      grip.addEventListener('dragend', () => {
        dragged = '';
        row.classList.remove('caspr-home-dragging');
        list
          .querySelectorAll<HTMLElement>('[data-drop]')
          .forEach((target) => delete target.dataset.drop);
      });
      list.append(row);
      const name = document.createElement('strong');
      name.textContent = item.title;
      const identity = document.createElement('div');
      identity.className = 'caspr-home-row-identity';
      const icon = document.createElement('span');
      icon.className = 'caspr-home-row-icon';
      icon.setAttribute('aria-hidden', 'true');
      const icons: Record<string, string> = {
        'widget:caspr-welcome-widget': '👋',
        'widget:caspr-clock-widget': '🕒',
        'widget:caspr-today-widget': '📅',
        'widget:caspr-agenda-widget': '📝',
        'widget:grades': '📊',
        'widget:caspr-delijn-widget': '🚌',
        'widget:caspr-nmbs-widget': '🚆',
        'widget:caspr-weather-widget': '🌤️',
        'widget:caspr-pomodoro': '🎯',
        'widget:caspr-groupwork-widget': '🤝',
        'widget:caspr-progression': '🏆',
        'widget:caspr-shortcuts-widget': '🔗',
        'widget:caspr-next-lesson-widget': '🔔',
        'widget:caspr-countdown-widget': '⏳',
      };
      icon.textContent =
        icons[item.id] ||
        (item.kind === 'image' ? '🖼️' : item.kind === 'link' ? '🔗' : '📝');
      name.textContent = item.title.replace(
        /^[\p{Extended_Pictographic}\uFE0F\u200D]+\s*/u,
        '',
      );
      identity.append(grip, icon, name);
      row.append(identity);
      const toggle = (text: string, key: 'hidden' | 'framed', checked: boolean) => {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = checked;
        input.setAttribute('aria-label', `${text}: ${item.title}`);
        input.addEventListener('change', () =>
          update(item.id, { [key]: key === 'hidden' ? !input.checked : input.checked }),
        );
        label.append(input, document.createTextNode(text));
        row.append(label);
      };
      toggle('Zichtbaar', 'hidden', !item.hidden);
      toggle('Kader', 'framed', item.framed);
      for (const key of ['width', 'height'] as const) {
        const label = document.createElement('label');
        label.textContent = key === 'width' ? 'Breedte' : 'Hoogte';
        const select = document.createElement('select');
        select.setAttribute(
          'aria-label',
          `${key === 'width' ? 'Breedte' : 'Hoogte'}: ${item.title}`,
        );
        for (let i = 1; i <= 4; i++) {
          const option = document.createElement('option');
          option.value = String(i);
          option.textContent = String(i);
          select.append(option);
        }
        select.value = String(item[key]);
        select.addEventListener('change', () =>
          update(item.id, { [key]: Number(select.value) }),
        );
        label.append(select);
        row.append(label);
      }
      const order = document.createElement('div');
      order.className = 'caspr-home-order';
      row.append(order);
      button('↑', () => move(item.id, -1), order);
      button('↓', () => move(item.id, 1), order);
      const arrows = order.querySelectorAll('button');
      arrows[0].setAttribute('aria-label', `${item.title} omhoog`);
      arrows[1].setAttribute('aria-label', `${item.title} omlaag`);
      if (item.kind !== 'widget') {
        button(
          'Bewerken',
          () => {
            const name = prompt('Titel', item.title);
            if (name === null) return;
            const text = prompt(
              item.kind === 'image' ? 'Beschrijving' : 'Tekst',
              item.text,
            );
            if (text === null) return;
            let url = item.url;
            if (item.kind === 'link') {
              const value = prompt('Link (https://...)', url);
              if (value === null) return;
              url = safeLink(value);
              if (!url) throw new Error('Gebruik een geldige http- of https-link.');
            }
            update(item.id, { title: name, text, url });
          },
          row,
        );
        button(
          'Verwijderen',
          () => change({ ...state, items: state.items.filter((i) => i.id !== item.id) }),
          row,
        );
      }
    }
    applyFilters();
    renderPresets();
  }
  function renderPresets() {
    presets.replaceChildren();
    const label = document.createElement('p');
    label.textContent = `Layout: ${state.name}`;
    presets.append(label);
    library.forEach((layout, index) => {
      const row = document.createElement('div');
      row.className = 'caspr-studio-saved';
      presets.append(row);
      button(layout.name, () => change(reconcile(layout)), row);
      button(
        'Verwijderen',
        async () => {
          const next = library.filter((_, i) => i !== index);
          await chrome.storage.local.set({ homeLibrary: next });
          library = next;
          renderPresets();
        },
        row,
      );
    });
  }
  button(
    '🧩 Startscherm aanpassen',
    () => {
      editing = true;
      editButton.textContent = 'Klaar met aanpassen';
      editButton.setAttribute('aria-pressed', 'true');
      render();
      dialog.showModal();
    },
    toolbar,
  );
  const editButton = button(
    'Verslepen aanzetten',
    () => {
      editing = !editing;
      editButton.textContent = editing ? 'Klaar met aanpassen' : 'Verslepen aanzetten';
      editButton.setAttribute('aria-pressed', String(editing));
      render();
    },
    toolbar,
  );
  button(
    'Ongedaan maken',
    () => {
      const previous = undo.pop();
      if (!previous) return;
      redo.push(parseHome(state));
      state = reconcile(previous);
      render();
      persist();
    },
    toolbar,
  );
  button(
    'Opnieuw uitvoeren',
    () => {
      const next = redo.pop();
      if (!next) return;
      undo.push(parseHome(state));
      state = reconcile(next);
      render();
      persist();
    },
    toolbar,
  );
  button('Op pagina verslepen', () => {
    editing = true;
    editButton.textContent = 'Klaar met aanpassen';
    editButton.setAttribute('aria-pressed', 'true');
    render();
    dialog.close();
    status.textContent =
      'Pak een widget bij ⋮⋮ Verplaatsen. Klik daarna op Klaar met aanpassen.';
    grid.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  button('Layout bewaren', async () => {
    if (library.length >= 12) throw new Error('Je kunt maximaal 12 layouts bewaren.');
    const name = prompt('Naam voor deze layout', state.name);
    if (!name) return;
    const layout = parseHome({ ...state, name });
    const next = [...library, layout];
    await chrome.storage.local.set({ homeLibrary: next });
    library = next;
    state = layout;
    persist();
    renderPresets();
  });
  button('Standaard schoollayout', () => change(reconcile(parseHome(null))));
  button('Schoolwidgets toevoegen', async () => {
    await queue;
    const data = await chrome.storage.local.get(['dashboard', 'timeOptions']);
    await chrome.storage.local.set({
      dashboard: {
        ...parseDashboard(data.dashboard),
        widgets: true,
        welcome: false,
        clock: true,
        shortcuts: true,
      },
      timeOptions: {
        ...parseTimeOptions(data.timeOptions),
        countdown: true,
        nextLesson: true,
      },
    });
  });
  for (const kind of ['text', 'link', 'image'] as const)
    button(
      kind === 'text'
        ? 'Tekst toevoegen'
        : kind === 'link'
          ? 'Snelkoppeling toevoegen'
          : 'Afbeelding toevoegen',
      () => {
        if (state.items.length >= 60) throw new Error('Maximaal 60 elementen.');
        const title = prompt(
          'Titel',
          kind === 'text'
            ? 'Mijn notitie'
            : kind === 'image'
              ? 'Mijn afbeelding'
              : 'Mijn link',
        );
        if (title === null) return;
        const item: HomeItem = {
          id: 'custom:' + crypto.randomUUID(),
          kind,
          title,
          text: '',
          url: '',
          image: '',
          width: 1,
          height: 1,
          framed: true,
          hidden: false,
        };
        if (kind === 'image') {
          imageUpload.onchange = () => {
            const file = imageUpload.files?.[0];
            if (!file) return;
            void (async () => {
              if (
                !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
                file.size > 15000000
              )
                throw new Error('Kies JPG, PNG of WebP van maximaal 15 MB.');
              const bitmap = await createImageBitmap(file);
              const canvas = document.createElement('canvas');
              const ratio = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
              canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
              canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
              canvas
                .getContext('2d')!
                .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
              bitmap.close();
              item.image = canvas.toDataURL('image/jpeg', 0.8);
              if (item.image.length >= 1500000)
                throw new Error('Afbeelding is te groot.');
              if (!disposed) change({ ...state, items: [...state.items, item] });
            })().catch((e) => {
              status.textContent = e.message;
            });
          };
          imageUpload.value = '';
          imageUpload.click();
          return;
        }
        const text = prompt(kind === 'text' ? 'Tekst' : 'Link (https://...)', '');
        if (text === null) return;
        if (kind === 'text') item.text = text;
        else {
          item.url = safeLink(text);
          if (!item.url) throw new Error('Ongeldige link.');
        }
        change({ ...state, items: [...state.items, item] });
      },
    );
  const imageUpload = document.createElement('input');
  imageUpload.type = 'file';
  imageUpload.accept = 'image/jpeg,image/png,image/webp';
  imageUpload.hidden = true;
  dialog.append(imageUpload);
  button('Ontwerp exporteren', async () => {
    await queue;
    const data = await chrome.storage.local.get('studioActive');
    const blob = new Blob(
      [
        JSON.stringify(
          {
            format: 'caspr-design',
            version: 1,
            layout: parseHome(state),
            theme: data.studioActive ? parseStudio(data.studioActive) : null,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'caspr-ontwerp.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const upload = document.createElement('input');
  upload.type = 'file';
  upload.accept = '.json,application/json';
  upload.hidden = true;
  dialog.append(upload);
  button('Ontwerp importeren', () => upload.click());
  upload.addEventListener('change', () => {
    const file = upload.files?.[0];
    if (!file) return;
    void (async () => {
      if (file.size > 18000000) throw new Error('Ontwerpbestand is te groot.');
      const data = JSON.parse(await file.text());
      if (
        data?.format !== 'caspr-design' ||
        data.version !== 1 ||
        !Array.isArray(data.layout?.items)
      )
        throw new Error('Geen geldig CASPR++ ontwerp.');
      const next = reconcile(parseHome(data.layout));
      if (
        !confirm(
          `Ontwerp “${next.name}” importeren met ${next.items.length} elementen? Je huidige layout kun je ongedaan maken. Het theme wordt ook vervangen.`,
        )
      )
        return;
      if (disposed) return;
      await queue;
      await chrome.storage.local.set({
        studioActive: data.theme ? parseStudio(data.theme) : null,
      });
      change(next);
      status.textContent = 'Ontwerp geïmporteerd.';
    })().catch((e) => {
      status.textContent = e.message;
    });
    upload.value = '';
  });
  const changed = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area !== 'local' || disposed) return;
    if (changes.homeLibrary) {
      library = Array.isArray(changes.homeLibrary.newValue)
        ? changes.homeLibrary.newValue.slice(0, 12).map(parseHome)
        : [];
      renderPresets();
    }
  };
  chrome.storage.onChanged.addListener(changed);
  void chrome.storage.local
    .get(['homeLayout', 'homeLibrary', 'homeRefinementVersion'])
    .then((data) => {
      if (disposed) return;
      state = reconcile(parseHome(data.homeLayout));
      if (data.homeRefinementVersion !== 4) {
        void chrome.storage.local
          .set({ homeLayout: parseHome(state), homeRefinementVersion: 4 })
          .catch(() => {});
      }
      library = Array.isArray(data.homeLibrary)
        ? data.homeLibrary.slice(0, 12).map(parseHome)
        : [];
      ready = true;
      render();
    })
    .catch(() => {
      if (!disposed) {
        ready = true;
        state = reconcile(parseHome(null));
        render();
        status.textContent = 'Instellingen laden mislukt.';
      }
    });
  return () => {
    disposed = true;
    resizeObserver.disconnect();
    availabilityObserver.disconnect();
    chrome.storage.onChanged.removeListener(changed);
    for (const { node, placeholder } of originals.values()) placeholder.replaceWith(node);
    grid.remove();
    toolbar.remove();
    dialog.remove();
  };
}
