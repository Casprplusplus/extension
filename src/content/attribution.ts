import { parseDashboard } from '../common/dashboard';
export function mountAttribution(): void {
  let enabled = false;
  let revision = 0;
  const credit = document.createElement('p');
  credit.className = 'caspr-attribution';
  credit.textContent = `CASPR++ v${chrome.runtime.getManifest().version} · © 2026 Louis D'Haen`;
  const place = () => {
    if (!enabled) {
      credit.remove();
      return;
    }
    const host =
      document.querySelector('.copyright') ||
      document.querySelector('.page-container .main-content') ||
      document.querySelector('.page-container') ||
      document.body;
    if (host && credit.parentElement !== host) host.append(credit);
  };
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.dashboard) return;
    revision++;
    enabled = parseDashboard(changes.dashboard.newValue).enabled;
    place();
  });
  const initial = revision;
  void chrome.storage.local
    .get('dashboard')
    .then((data) => {
      if (revision !== initial) return;
      enabled = parseDashboard(data.dashboard).enabled;
      place();
    })
    .catch(() => {});
  const observer = new MutationObserver(place);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
}
