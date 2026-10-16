import { CASPR_URL } from '../common/config';
import { parseDashboard } from '../common/dashboard';
import { setupTimeOptions } from './time-options';

const status = document.getElementById('status')!;
const version = document.createElement('p');
version.className = 'popup-version';
version.textContent = `CASPR++ · versie ${chrome.runtime.getManifest().version}`;
document.querySelector('.popup-footer')?.append(version);
setupTimeOptions(status);

const toggles = [
  ['dashboard-enabled', 'enabled'],
  ['widgets-enabled', 'widgets'],
] as const;
for (const [id, key] of toggles) {
  const input = document.getElementById(id) as HTMLInputElement;
  input.disabled = true;
  void chrome.storage.local
    .get('dashboard')
    .then((data) => {
      input.checked = parseDashboard(data.dashboard)[key];
      input.disabled = false;
    })
    .catch(() => {
      status.textContent = 'Instellingen laden mislukt.';
    });
  input.addEventListener('change', async () => {
    const value = input.checked;
    input.disabled = true;
    try {
      const data = await chrome.storage.local.get('dashboard');
      await chrome.storage.local.set({
        dashboard: { ...parseDashboard(data.dashboard), [key]: value },
      });
      status.textContent = 'Instelling opgeslagen.';
    } catch {
      input.checked = !value;
      status.textContent = 'Opslaan mislukt. Probeer opnieuw.';
    } finally {
      input.disabled = false;
    }
  });
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.dashboard) return;
  const settings = parseDashboard(changes.dashboard.newValue);
  for (const [id, key] of toggles) {
    const input = document.getElementById(id) as HTMLInputElement;
    if (!input.disabled) input.checked = settings[key];
  }
});
document.getElementById('open')!.addEventListener('click', async () => {
  try {
    await chrome.tabs.create({ url: CASPR_URL });
  } catch {
    status.textContent = 'CASPR openen mislukt. Probeer opnieuw.';
  }
});
