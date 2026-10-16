import {
  applyStudio,
  parseStudio,
  studioDefault,
  studioFonts,
  studioPresets,
  type StudioTheme,
} from '../common/theme-studio';
export function mountThemeStudio(container: HTMLElement): () => void {
  const launch = document.createElement('button');
  launch.type = 'button';
  launch.textContent = '🎨 Theme Studio openen';
  launch.className = 'caspr-focus-toggle';
  container.append(launch);
  const dialog = document.createElement('dialog');
  dialog.className = 'caspr-community caspr-studio-dialog';
  dialog.setAttribute('aria-label', 'Theme Studio');
  const heading = document.createElement('h2');
  heading.textContent = '🎨 Theme Studio';
  const intro = document.createElement('p');
  intro.textContent =
    'Maak je eigen thema voor alle CASPR-pagina’s. Bekijk wijzigingen live en bewaar ze lokaal in deze browser.';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const form = document.createElement('div');
  form.className = 'caspr-studio-fields';
  const library = document.createElement('div');
  library.className = 'caspr-studio-library';
  const actions = document.createElement('div');
  actions.className = 'caspr-studio-actions';
  dialog.append(heading, intro, library, form, status, actions);
  document.body.append(dialog);
  let draft = { ...studioDefault };
  let original: StudioTheme | null = null;
  let saved: StudioTheme[] = [];
  let disposed = false;
  let generation = 0;
  const controls: Partial<
    Record<keyof StudioTheme, HTMLInputElement | HTMLSelectElement>
  > = {};
  const outputs: Partial<Record<keyof StudioTheme, HTMLOutputElement>> = {};
  const colorCodes = new Map<keyof StudioTheme, HTMLInputElement>();
  let fieldHost: HTMLElement = form;
  function section(title: string) {
    const group = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = title;
    group.append(legend);
    form.append(group);
    fieldHost = group;
  }
  function preview() {
    applyStudio(draft);
  }
  function sync() {
    for (const [key, input] of Object.entries(controls)) {
      const value = draft[key as keyof StudioTheme];
      if (input instanceof HTMLInputElement && input.type === 'checkbox')
        input.checked = Boolean(value);
      else input.value = String(value);
      const code = colorCodes.get(key as keyof StudioTheme);
      if (code) {
        code.value = String(value);
        code.setCustomValidity('');
      }
      const output = outputs[key as keyof StudioTheme];
      if (output) output.textContent = String(value);
      if (input instanceof HTMLInputElement && input.type === 'range')
        input.title = String(value);
    }
    preview();
  }
  function field(key: keyof StudioTheme, labelText: string, type: string, max?: number) {
    const label = document.createElement('label');
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = type;
    if (type === 'range') {
      input.min = '0';
      input.max = String(max);
    }
    if (type === 'text') input.maxLength = 60;
    const output = document.createElement('output');
    if (type === 'range') outputs[key] = output;
    input.addEventListener('input', () => {
      draft = parseStudio({
        ...draft,
        [key]:
          type === 'checkbox'
            ? input.checked
            : type === 'range'
              ? Number(input.value)
              : input.value,
      });
      if (type === 'range') output.textContent = input.value;
      preview();
    });
    controls[key] = input;
    label.append(input);
    if (type === 'color') {
      const code = document.createElement('input');
      code.type = 'text';
      code.maxLength = 7;
      code.pattern = '#[0-9a-fA-F]{6}';
      code.spellcheck = false;
      code.setAttribute('aria-label', `${labelText} als kleurcode`);
      code.placeholder = '#635bce';
      code.addEventListener('input', () => {
        const valid = /^#[0-9a-f]{6}$/i.test(code.value);
        code.setCustomValidity(valid ? '' : 'Gebruik een kleurcode zoals #635bce.');
        if (!valid) return;
        input.value = code.value;
        input.dispatchEvent(new Event('input'));
      });
      input.addEventListener('input', () => {
        code.value = input.value;
        code.setCustomValidity('');
      });
      const picker = document.createElement('div');
      picker.className = 'caspr-studio-color';
      picker.append(input, code);
      label.append(picker);
      colorCodes.set(key, code);
    }
    if (type === 'range') label.append(output);
    fieldHost.append(label);
  }
  function select(key: 'font' | 'mode', title: string, options: Record<string, string>) {
    const label = document.createElement('label');
    label.textContent = title;
    const input = document.createElement('select');
    for (const [value, text] of Object.entries(options)) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      input.append(option);
    }
    input.addEventListener('change', () => {
      draft = parseStudio({ ...draft, [key]: input.value });
      preview();
    });
    controls[key] = input;
    label.append(input);
    fieldHost.append(label);
  }
  section('Jouw thema');
  field('name', 'Naam', 'text');
  select(
    'font',
    'Lettertype',
    Object.fromEntries(
      Object.keys(studioFonts).map((key) => [
        key,
        (
          {
            system: 'Systeem',
            rounded: 'Rond',
            serif: 'Klassiek',
            mono: 'Monospace',
          } as Record<string, string>
        )[key],
      ]),
    ),
  );
  section('Kleuren');
  for (const [key, label] of [
    ['surface', 'Hoofdkleur · kaarten en panelen'],
    ['accent', 'Accentkleur'],
    ['text', 'Tekstkleur'],
    ['muted', 'Subtiele tekst'],
    ['buttonText', 'Tekst op knoppen'],
    ['line', 'Randen en scheidingslijnen'],
    ['soft', 'Subtiele vlakken'],
  ] as const)
    field(key, label, 'color');
  section('Achtergrond op alle pagina’s');
  select('mode', 'Type achtergrond', {
    solid: 'Effen kleur',
    gradient: 'Kleurverloop',
    photo: 'Eigen foto',
  });
  for (const [key, label] of [
    ['background', 'Achtergrondkleur'],
    ['gradient', 'Tweede kleur'],
  ] as const)
    field(key, label, 'color');
  field('angle', 'Richting kleurverloop', 'range', 360);
  section('Afwerking');
  field('glass', 'Glaseffect', 'checkbox');
  field('opacity', 'Dekking kaarten (%)', 'range', 100);
  field('blur', 'Glasvervaging (px)', 'range', 40);
  field('radius', 'Ronde hoeken (px)', 'range', 48);
  field('shadow', 'Schaduw (px)', 'range', 60);
  const photo = document.createElement('input');
  photo.type = 'file';
  photo.accept = 'image/jpeg,image/png,image/webp';
  photo.setAttribute('aria-label', 'Achtergrondfoto kiezen');
  const photoLabel = document.createElement('label');
  photoLabel.textContent = 'Eigen achtergrondfoto';
  photoLabel.append(photo);
  form.querySelectorAll('fieldset')[2].append(photoLabel);
  photo.addEventListener('change', () => {
    const file = photo.files?.[0];
    if (!file) return;
    const token = generation;
    void (async () => {
      if (
        !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
        file.size > 15000000
      )
        throw new Error('Kies een JPG, PNG of WebP van maximaal 15 MB.');
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
      canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const image = canvas.toDataURL('image/jpeg', 0.8);
      if (image.length >= 3000000)
        throw new Error('Deze foto is te groot. Kies een kleinere afbeelding.');
      if (disposed || token !== generation || !dialog.open) return;
      draft = { ...draft, photo: image, mode: 'photo' };
      sync();
      status.textContent = 'Foto toegevoegd.';
    })().catch((error) => {
      if (!disposed) status.textContent = error.message;
    });
  });
  function button(text: string, action: () => void | Promise<void>, parent = actions) {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = text;
    element.addEventListener('click', () => {
      element.disabled = true;
      void Promise.resolve()
        .then(action)
        .catch((error) => {
          status.textContent = error.message || 'Actie mislukt.';
        })
        .finally(() => {
          element.disabled = false;
        });
    });
    parent.append(element);
    return element;
  }
  function renderLibrary() {
    library.replaceChildren();
    const presetTitle = document.createElement('h3');
    presetTitle.textContent = 'Presets';
    library.append(presetTitle);
    for (const preset of studioPresets)
      button(
        preset.name,
        () => {
          draft = { ...preset };
          sync();
        },
        library,
      );
    const savedTitle = document.createElement('h3');
    savedTitle.textContent = 'Mijn themes';
    library.append(savedTitle);
    saved.forEach((theme, index) => {
      const row = document.createElement('div');
      row.className = 'caspr-studio-saved';
      library.append(row);
      button(
        theme.name,
        () => {
          draft = { ...theme };
          sync();
        },
        row,
      );
      button(
        'Dupliceren',
        async () => {
          if (saved.length >= 20) throw new Error('Je kunt maximaal 20 themes bewaren.');
          const next = [
            ...saved,
            { ...theme, name: theme.name.slice(0, 50) + ' (kopie)' },
          ];
          await chrome.storage.local.set({ studioLibrary: next });
          saved = next;
          renderLibrary();
        },
        row,
      );
      button(
        'Verwijderen',
        async () => {
          const next = saved.filter((_, i) => i !== index);
          await chrome.storage.local.set({ studioLibrary: next });
          saved = next;
          renderLibrary();
        },
        row,
      );
    });
  }
  button('Toepassen', async () => {
    const next = parseStudio(draft);
    await chrome.storage.local.set({ studioActive: next });
    original = next;
    status.textContent = 'Thema lokaal opgeslagen en toegepast op alle CASPR-pagina’s.';
  });
  button('Opslaan als nieuw theme', async () => {
    if (saved.length >= 20) throw new Error('Je kunt maximaal 20 themes bewaren.');
    const next = [...saved, parseStudio(draft)];
    await chrome.storage.local.set({ studioLibrary: next });
    saved = next;
    renderLibrary();
    status.textContent = 'Theme bewaard in je bibliotheek.';
  });
  button('Exporteren', () => {
    const blob = new Blob(
      [
        JSON.stringify(
          { format: 'caspr-theme', version: 1, theme: parseStudio(draft) },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'caspr-theme.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const upload = document.createElement('input');
  upload.type = 'file';
  upload.accept = '.json,application/json';
  upload.hidden = true;
  actions.append(upload);
  button('Importeren', () => upload.click());
  upload.addEventListener('change', () => {
    const file = upload.files?.[0];
    if (!file) return;
    const token = generation;
    void (async () => {
      if (file.size > 3200000) throw new Error('Themebestand is te groot.');
      const data = JSON.parse(await file.text());
      if (
        data?.format !== 'caspr-theme' ||
        data.version !== 1 ||
        !data.theme ||
        typeof data.theme !== 'object' ||
        Array.isArray(data.theme)
      )
        throw new Error('Dit is geen ondersteund CASPR++ themebestand.');
      if (disposed || token !== generation || !dialog.open) return;
      draft = parseStudio(data.theme);
      sync();
      status.textContent =
        'Import als preview geladen. Kies Toepassen of bewaar als nieuw theme.';
    })().catch((error) => {
      if (!disposed) status.textContent = error.message;
    });
    upload.value = '';
  });
  button('Foto verwijderen', () => {
    draft = { ...draft, photo: '', mode: 'gradient' };
    photo.value = '';
    sync();
  });
  button('Standaardtheme herstellen', async () => {
    await chrome.storage.local.remove('studioActive');
    original = null;
    applyStudio(null);
    status.textContent = 'Standaardtheme hersteld.';
  });
  button('Sluiten', () => dialog.close());
  dialog.addEventListener('close', () => {
    generation++;
    applyStudio(original);
  });
  launch.addEventListener('click', () => {
    const token = ++generation;
    launch.disabled = true;
    void chrome.storage.local
      .get(['studioActive', 'studioLibrary'])
      .then((data) => {
        if (disposed || token !== generation) return;
        original = data.studioActive ? parseStudio(data.studioActive) : null;
        draft = original ? { ...original } : { ...studioDefault };
        saved = Array.isArray(data.studioLibrary)
          ? data.studioLibrary.slice(0, 20).map(parseStudio)
          : [];
        status.textContent = '';
        renderLibrary();
        dialog.showModal();
        sync();
      })
      .catch(() => {
        status.textContent = 'Themes laden mislukt.';
      })
      .finally(() => {
        launch.disabled = false;
      });
  });
  return () => {
    disposed = true;
    generation++;
    if (dialog.open) applyStudio(original);
    dialog.remove();
    launch.remove();
  };
}
