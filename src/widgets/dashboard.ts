import { mountGroupwork } from './groupwork';
import { addTimeWidgets } from './time';
import { setText } from '../common/dom';
import type { ThemeSettings } from '../common/themes';
import type { TimeOptions } from '../common/time-widgets';
import type { DashboardSettings } from '../common/dashboard';
import { emoji } from '../common/emoji';
import { mountPomodoro } from './pomodoro';
import { mountProgression } from './progression';

export function mountDashboardWidgets(
  content: HTMLElement,
  tiles: HTMLAnchorElement[],
  theme: ThemeSettings,
  timeOptions: TimeOptions,
  lessonCache: unknown,
  joke: string,
  dashboard: DashboardSettings,
): () => void {
  const widgets = document.createElement('section');
  widgets.id = 'caspr-dashboard-widgets';
  widgets.setAttribute('aria-label', 'Dashboardwidgets');

  const welcome = document.createElement('article');
  welcome.className = 'caspr-welcome-widget';

  const eyebrow = document.createElement('span');
  eyebrow.textContent = 'JOUW SCHOOLDAG';

  const title = document.createElement('h2');
  const hour = new Date().getHours();

  title.append(
    document.createTextNode(
      hour < 12 ? 'Goedemorgen ' : hour < 18 ? 'Goedemiddag ' : 'Goedenavond ',
    ),

    emoji(hour < 12 ? '☀️' : hour < 18 ? '✨' : '🌙'),
  );

  const line = document.createElement('p');
  line.textContent = joke;
  line.hidden = !theme.splash;

  welcome.append(eyebrow, title, line);

  const clock = document.createElement('article');
  clock.className = 'caspr-clock-widget';

  const time = document.createElement('time');
  const date = document.createElement('p');

  let displayedMinute = -1;

  const updateClock = () => {
    const now = new Date();
    const minute = Math.floor(now.getTime() / 60000);

    if (minute === displayedMinute) return;
    displayedMinute = minute;

    time.dateTime = now.toISOString();

    setText(
      time,
      now.toLocaleTimeString('nl-BE', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    );

    setText(
      date,
      now.toLocaleDateString('nl-BE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    );
  };

  updateClock();
  clock.append(time, date);

  const shortcuts = document.createElement('article');
  shortcuts.className = 'caspr-shortcuts-widget';

  const heading = document.createElement('h3');
  heading.textContent = 'Snel naar';
  shortcuts.append(heading);

  for (const path of [
    '/leerlingapp/Agenda',
    '/leerlingapp/Uurrooster',
    '/leerlingapp/Berichten',
  ]) {
    const original = tiles.find(
      (tile) => tile.getAttribute('href')?.toLowerCase() === path.toLowerCase(),
    );
    if (!original) continue;

    const link = document.createElement('a');
    link.href = original.href;
    link.textContent = path.split('/').pop()!;

    shortcuts.append(link);
  }

  if (dashboard.welcome) widgets.append(welcome);
  if (dashboard.clock) widgets.append(clock);
  if (dashboard.shortcuts) widgets.append(shortcuts);

  const updateTimeWidgets = addTimeWidgets(widgets, timeOptions, lessonCache);

  updateTimeWidgets();
  const cleanupPomodoro = mountPomodoro(widgets);
  const cleanupProgression = mountProgression(widgets);
  const cleanupGroupwork = mountGroupwork(widgets);

  content.prepend(widgets);
  if (!widgets.children.length) {
    widgets.remove();
    return () => {};
  }

  let timer: ReturnType<typeof setInterval> | undefined;

  const stop = () => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
  };

  const resume = () => {
    stop();

    if (document.hidden) return;

    updateClock();
    updateTimeWidgets();

    timer = setInterval(
      () => {
        updateClock();
        updateTimeWidgets();
      },
      timeOptions.countdown ? 1000 : 30000,
    );
  };

  document.addEventListener('visibilitychange', resume);
  resume();

  return () => {
    cleanupPomodoro();
    cleanupProgression();
    cleanupGroupwork();
    stop();

    document.removeEventListener('visibilitychange', resume);
    widgets.remove();
  };
}
