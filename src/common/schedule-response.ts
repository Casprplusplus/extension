import type { Lesson } from './time-widgets';

export function parseScheduleResponse(
  value: unknown,
  titleParts: (html: string) => { subject: string; room: string },
): Lesson[] {
  if (!Array.isArray(value) || value.length > 1000)
    throw new Error('Onverwacht uurroosterantwoord');

  const lessons: Lesson[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') throw new Error('Ongeldig roosteritem');

    const event = item as Record<string, unknown>;

    if (
      typeof event.start !== 'string' ||
      typeof event.end !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T/.test(event.start) ||
      !/^\d{4}-\d{2}-\d{2}T/.test(event.end) ||
      typeof event.title !== 'string' ||
      event.title.length > 10000
    )
      throw new Error('Roosteritem mist concrete lesdatums');

    const start = Date.parse(event.start);
    const end = Date.parse(event.end);

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
      throw new Error('Ongeldige lestijd');

    const { subject, room } = titleParts(event.title);

    lessons.push({
      start,
      end,
      subject: subject.trim().slice(0, 80),
      room: room.trim().slice(0, 40),
    });
  }

  return lessons.sort((a, b) => a.start - b.start);
}
