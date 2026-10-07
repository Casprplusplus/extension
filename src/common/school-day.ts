import type { Lesson } from './time-widgets';
export const schoolDate = (time: number) =>
  new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Brussels',
  }).format(time);
export function schoolDayLessons(lessons: Lesson[], now: number) {
  const weekday = (time: number) =>
    new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      timeZone: 'Europe/Brussels',
    }).format(time);
  const weekend = ['Sat', 'Sun'].includes(weekday(now));
  const future = lessons
    .filter((l) => l.start >= now && !['Sat', 'Sun'].includes(weekday(l.start)))
    .sort((a, b) => a.start - b.start)[0];
  const target = weekend ? future?.start : now;
  return {
    weekend,
    target,
    lessons:
      target === undefined
        ? []
        : lessons
            .filter((l) => schoolDate(l.start) === schoolDate(target))
            .sort((a, b) => a.start - b.start),
  };
}
