import { defaults } from '../common/themes';
import './backend';
import { parseDashboard } from '../common/dashboard';

async function initializeSettings(): Promise<void> {
  const stored = await chrome.storage.local.get(['loginTheme', 'dashboard']);
  const missing: Record<string, unknown> = {};
  if (stored.loginTheme === undefined) missing.loginTheme = { ...defaults };
  if (stored.dashboard === undefined) missing.dashboard = parseDashboard(undefined);
  if (Object.keys(missing).length) await chrome.storage.local.set(missing);
}

chrome.runtime.onInstalled.addListener(() => {
  void initializeSettings().catch((error) => {
    console.error('CASPR++: standaardinstellingen konden niet worden opgeslagen.', error);
  });
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'panic-disable') return;
  void (async () => {
    const stored = await chrome.storage.local.get(['loginTheme', 'dashboard']);
    await chrome.storage.local.set({
      loginTheme: { ...(stored.loginTheme || defaults), enabled: false },
      dashboard: { ...parseDashboard(stored.dashboard), enabled: false },
    });
  })().catch(console.error);
});
