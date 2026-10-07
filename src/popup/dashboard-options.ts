import { parseDashboard } from '../common/dashboard';

export function setupDashboardOptions(status: HTMLElement): void {
  const enabled = document.getElementById('dashboard-enabled') as HTMLInputElement;
  const widgets = document.getElementById('widgets-enabled') as HTMLInputElement;
  const welcome = document.getElementById('welcome-enabled') as HTMLInputElement;
  const clock = document.getElementById('clock-enabled') as HTMLInputElement;
  const shortcuts = document.getElementById('shortcuts-enabled') as HTMLInputElement;

  const syncWidgets = () => {
    welcome.checked = settings.welcome;
    clock.checked = settings.clock;
    shortcuts.checked = settings.shortcuts;
  };

  const photo = document.getElementById('background-photo') as HTMLInputElement;
  const remove = document.getElementById('remove-photo') as HTMLButtonElement;
  const photoStatus = document.getElementById('photo-status')!;
  const glass = document.getElementById('glass-enabled') as HTMLInputElement;
  const transparency = document.getElementById('glass-transparency') as HTMLInputElement;
  const glassValue = document.getElementById('glass-value')!;

  const controls = [
    enabled,
    widgets,
    welcome,
    clock,
    shortcuts,
    glass,
    transparency,
    photo,
    remove,
  ];

  const syncGlass = () => {
    glass.checked = settings.glass;
    transparency.value = String(settings.transparency);
    glassValue.textContent = `${settings.transparency}%`;
  };

  let settings = parseDashboard(undefined);
  const lock = (locked: boolean) =>
    controls.forEach((control) => {
      control.disabled = locked;
    });

  const showPhoto = () => {
    photoStatus.textContent = settings.photo
      ? 'Eigen foto ingesteld.'
      : 'Themakleuren als achtergrond.';
  };

  lock(true);

  chrome.storage.local
    .get('dashboard')
    .then((data) => {
      settings = parseDashboard(data.dashboard);

      enabled.checked = settings.enabled;
      widgets.checked = settings.widgets;

      syncWidgets();
      syncGlass();

      showPhoto();

      lock(false);
    })
    .catch(() => {
      status.textContent = 'Dashboardinstellingen laden mislukt.';
    });

  const save = async () => {
    await chrome.storage.local.set({ dashboard: settings });
    showPhoto();

    status.textContent = 'Dashboard bijgewerkt.';
  };

  transparency.addEventListener('input', () => {
    glassValue.textContent = `${transparency.value}%`;
  });

  for (const control of [
    enabled,
    widgets,
    welcome,
    clock,
    shortcuts,
    glass,
    transparency,
  ])
    control.addEventListener('change', async () => {
      lock(true);
      const previous = settings;

      settings = parseDashboard({
        ...settings,
        enabled: enabled.checked,
        widgets: widgets.checked,
        welcome: welcome.checked,
        clock: clock.checked,
        shortcuts: shortcuts.checked,
        glass: glass.checked,
        transparency: Number(transparency.value),
      });

      try {
        await save();
      } catch {
        settings = previous;

        enabled.checked = settings.enabled;
        widgets.checked = settings.widgets;

        syncWidgets();
        syncGlass();

        status.textContent = 'Opslaan mislukt.';
      } finally {
        lock(false);
      }
    });

  remove.addEventListener('click', async () => {
    lock(true);

    const previous = settings;
    settings = { ...settings, photo: '' };

    try {
      await save();
      photo.value = '';
    } catch {
      settings = previous;
      status.textContent = 'Foto verwijderen mislukt.';
    } finally {
      lock(false);
    }
  });

  photo.addEventListener('change', async () => {
    const file = photo.files?.[0];
    if (!file) return;

    lock(true);

    const previous = settings;
    let bitmap: ImageBitmap | undefined;

    try {
      if (
        !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
        file.size > 20 * 1024 * 1024
      )
        throw new Error('Kies een JPG, PNG of WebP van maximaal 20 MB.');

      bitmap = await createImageBitmap(file);

      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');

      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Foto kon niet worden verwerkt.');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const image = canvas.toDataURL('image/jpeg', 0.8);
      if (image.length >= 3000000)
        throw new Error('Deze foto is te groot. Kies een kleinere foto.');

      settings = { ...settings, photo: image };
      await save();
    } catch (error) {
      settings = previous;
      status.textContent =
        error instanceof Error ? error.message : 'Foto opslaan mislukt.';
    } finally {
      bitmap?.close();
      photo.value = '';
      lock(false);
    }
  });
}
