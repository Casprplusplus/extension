import { parseTimeOptions } from '../common/time-widgets';
export function setupTimeOptions(status: HTMLElement): void {
  const countdown = document.getElementById('countdown-enabled') as HTMLInputElement;
  const lesson = document.getElementById('next-lesson-enabled') as HTMLInputElement;
  const label = document.getElementById('countdown-label') as HTMLInputElement;
  const target = document.getElementById('countdown-target') as HTMLInputElement;
  const save = document.getElementById('save-time-widgets') as HTMLButtonElement;
  const controls = [countdown, lesson, label, target, save];

  const lock = (disabled: boolean) =>
    controls.forEach((e) => {
      e.disabled = disabled;
    });

  lock(true);

  chrome.storage.local
    .get('timeOptions')
    .then((data) => {
      const options = parseTimeOptions(data.timeOptions);

      countdown.checked = options.countdown;
      lesson.checked = options.nextLesson;
      label.value = options.label;

      if (options.target) {
        const date = new Date(options.target);
        target.value = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
      }

      lock(false);
    })
    .catch(() => {
      status.textContent = 'Widgetinstellingen laden mislukt.';
    });

  save.addEventListener('click', async () => {
    if (target.value && !target.checkValidity()) {
      target.reportValidity();
      return;
    }

    lock(true);

    try {
      await chrome.storage.local.set({
        timeOptions: parseTimeOptions({
          countdown: countdown.checked,
          nextLesson: lesson.checked,
          label: label.value,
          target: target.value ? new Date(target.value).toISOString() : '',
        }),
      });

      status.textContent =
        'Widgets opgeslagen. Je rooster wordt automatisch opgehaald op het dashboard.';
    } catch {
      status.textContent = 'Widgetinstellingen opslaan mislukt.';
    } finally {
      lock(false);
    }
  });
}
