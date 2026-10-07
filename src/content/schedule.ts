import type { Lesson } from '../common/time-widgets';
import { accountScope } from '../common/account-scope';
import { parseDashboard } from '../common/dashboard';
import { getCurrentUser, isStudentEmail } from '../common/user';

let pending: ReturnType<typeof setTimeout>;
let lastSignature = '';

async function capture(): Promise<void> {
  if (!isStudentEmail(getCurrentUser()?.email)) return;
  const settings = await chrome.storage.local.get('dashboard');
  if (!parseDashboard(settings.dashboard).enabled) return;

  const lessons: Lesson[] = [];

  for (const column of document.querySelectorAll('.fc-timegrid-col[data-date]')) {
    const date = column.getAttribute('data-date');
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    for (const event of column.querySelectorAll('.fc-event-main')) {
      const text = event.textContent || '';
      const match = text.match(
        /Lesuur\s+\d+:\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/,
      );

      if (!match) continue;
      const teacher = event.querySelector('[id^="leerkracht_"]')?.textContent || '';
      const room = event.querySelector('[id^="lokaal_"]')?.textContent || '';
      const subject = text
        .replace(match[0], '')
        .replace(teacher, '')
        .replace(room, '')
        .trim();

      const start = Date.parse(`${date}T${match[1].padStart(2, '0')}:${match[2]}:00`);
      const end = Date.parse(`${date}T${match[3].padStart(2, '0')}:${match[4]}:00`);

      if (Number.isFinite(start) && end > start)
        lessons.push({
          start,
          end,
          subject: subject.slice(0, 80),
          room: room.trim().slice(0, 40),
        });
    }
  }

  const scope = accountScope();
  const signature = JSON.stringify({ scope, lessons });

  if (lessons.length && scope && signature !== lastSignature) {
    const latest = await chrome.storage.local.get('dashboard');
    if (
      !parseDashboard(latest.dashboard).enabled ||
      !isStudentEmail(getCurrentUser()?.email)
    )
      return;

    await chrome.storage.local.set({
      lessonCache: { captured: Date.now(), scope, lessons },
    });

    lastSignature = signature;
  }
}

const queue = () => {
  clearTimeout(pending);

  pending = setTimeout(() => {
    void capture().catch(console.error);
  }, 400);
};

const container = document.querySelector('.main-content');
if (container)
  new MutationObserver(queue).observe(container, { childList: true, subtree: true });

queue();
