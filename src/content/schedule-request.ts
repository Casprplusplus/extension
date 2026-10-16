import { accountScope } from '../common/account-scope';
import { parseScheduleResponse } from '../common/schedule-response';

let inFlight: Promise<boolean> | undefined;
let activeController: AbortController | undefined;

export function cancelScheduleRequests(): void {
  activeController?.abort();
}

let lastAttempt = 0;
let lastScope = '';

function titleParts(html: string): { subject: string; room: string } {
  const template = document.createElement('template');
  template.innerHTML = html;

  const room = template.content.querySelector('[id^="lokaal_"]')?.textContent || '';

  template.content
    .querySelectorAll('[id^="leerkracht_"], [id^="lokaal_"], script, style')
    .forEach((e) => e.remove());
  template.content
    .querySelectorAll('br')
    .forEach((e) => e.replaceWith(document.createTextNode(' ')));

  return { subject: template.content.textContent || '', room };
}

export function refreshSchedule(force = false): Promise<boolean> {
  const scope = accountScope();
  if (location.origin !== 'https://kolvw.caspr.be' || !scope)
    return Promise.resolve(false);

  if (inFlight) return inFlight;
  if (!force && scope === lastScope && Date.now() - lastAttempt < 5 * 60000)
    return Promise.resolve(false);

  lastAttempt = Date.now();
  lastScope = scope;

  inFlight = (async () => {
    const controller = new AbortController();
    activeController = controller;

    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(end.getDate() + 14);

      const url = new URL('/leerlingapp/GetUurrooster', location.origin);
      url.searchParams.set('start', start.toISOString());
      url.searchParams.set('end', end.toISOString());

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'same-origin',
        redirect: 'error',
        cache: 'no-store',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      if (!response.ok || !response.headers.get('content-type')?.includes('json'))
        throw new Error('Uurrooster niet beschikbaar; controleer je CASPR-sessie');

      const lessons = parseScheduleResponse(await response.json(), titleParts);

      if (controller.signal.aborted || scope !== accountScope()) return false;

      await chrome.storage.local.set({
        lessonCache: {
          captured: Date.now(),
          scope,
          source: 'request',
          lessons,
        },
      });

      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
      activeController = undefined;
    }
  })().finally(() => {
    inFlight = undefined;
  });

  return inFlight;
}
