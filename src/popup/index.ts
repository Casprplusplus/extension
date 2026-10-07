import { CASPR_URL } from '../common/config';
import { parseSettings } from '../common/themes';
import { setupDashboardOptions } from './dashboard-options';
import { setupTimeOptions } from './time-options';
const status = document.getElementById('status')!;
const version = document.createElement('p');
version.className = 'popup-version';
version.textContent = `CASPR++ · versie ${chrome.runtime.getManifest().version}`;
document.querySelector('.popup-footer')?.append(version);
const accountNotice = document.createElement('p');
accountNotice.className = 'popup-card';
accountNotice.setAttribute('role', 'status');
accountNotice.textContent =
  'Open CASPR en meld je aan met je leerlingaccount (ll-e-mailadres) om CASPR++ te gebruiken.';
const settingsCards = Array.from(
  document.querySelectorAll<HTMLElement>('section.popup-card'),
);
settingsCards.forEach((card) => {
  card.hidden = true;
});
document.querySelector('.popup-brand')?.after(accountNotice);
void chrome.tabs
  .query({ active: true, currentWindow: true })
  .then(async (tabs) => {
    if (!tabs[0]?.id) return;
    const result = await chrome.tabs.sendMessage(tabs[0].id, {
      type: 'caspr:student-access',
    });
    if (result?.allowed) {
      accountNotice.hidden = true;
      settingsCards.forEach((card) => {
        card.hidden = false;
      });
    }
  })
  .catch(() => {});

const applyPopupTheme = (value: unknown) => {
  document.documentElement.dataset.casprDashboard = parseSettings(value).theme;
};

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.loginTheme)
    applyPopupTheme(changes.loginTheme.newValue);
});

setupDashboardOptions(status);
setupTimeOptions(status);

const enabled = document.getElementById('theme-enabled') as HTMLInputElement;
const theme = document.getElementById('theme') as HTMLSelectElement;
const splash = document.getElementById('splash-enabled') as HTMLInputElement;
const controls = [enabled, theme, splash];

controls.forEach((control) => {
  control.disabled = true;
});

chrome.storage.local
  .get('loginTheme')
  .then((data) => {
    const settings = parseSettings(data.loginTheme);
    applyPopupTheme(settings);

    enabled.checked = settings.enabled;
    theme.value = settings.theme;
    splash.checked = settings.splash;

    controls.forEach((control) => {
      control.disabled = false;
    });
  })
  .catch(() => {
    status.textContent = 'Thema-instellingen konden niet worden geladen.';
  });

controls.forEach((control) =>
  control.addEventListener('change', async () => {
    applyPopupTheme({ theme: theme.value });

    try {
      await chrome.storage.local.set({
        loginTheme: parseSettings({
          enabled: enabled.checked,
          theme: theme.value,
          splash: splash.checked,
        }),
      });
      status.textContent =
        'Thema opgeslagen. Een geopende loginpagina past zich direct aan.';
    } catch {
      status.textContent = 'Thema opslaan mislukt.';
    }
  }),
);

document.getElementById('open')!.addEventListener('click', async () => {
  try {
    await chrome.tabs.create({ url: CASPR_URL });
  } catch (error) {
    status.textContent = `Openen mislukt: ${error instanceof Error ? error.message : String(error)}`;
  }
});
