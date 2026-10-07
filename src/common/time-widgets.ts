export interface Lesson {
  start: number;
  end: number;
  subject: string;
  room: string;
}

export interface TimeOptions {
  countdown: boolean;
  nextLesson: boolean;
  target: string;
  label: string;
}

export function parseTimeOptions(value: unknown): TimeOptions {
  const data = (value && typeof value === 'object' ? value : {}) as Partial<TimeOptions>;

  return {
    countdown: data.countdown !== false,
    nextLesson: data.nextLesson !== false,
    target:
      typeof data.target === 'string' && Number.isFinite(Date.parse(data.target))
        ? data.target
        : '',
    label: typeof data.label === 'string' ? data.label.slice(0, 60) : '',
  };
}

export function countdownTarget(
  options: TimeOptions,
  now: Date,
  lessons: Lesson[] = [],
): Date | undefined {
  if (options.target) return new Date(options.target);

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const day = (timestamp: number) => formatter.format(timestamp);
  const today = day(now.getTime());

  const valid = lessons.filter(
    (lesson) =>
      Number.isFinite(lesson.start) &&
      Number.isFinite(lesson.end) &&
      lesson.end > lesson.start,
  );

  let chosen = valid.filter((lesson) => day(lesson.start) === today);

  if (!chosen.length) {
    const next = nextLesson(valid, now.getTime());
    if (!next) return undefined;

    chosen = valid.filter((lesson) => day(lesson.start) === day(next.start));
  }

  return new Date(Math.max(...chosen.map((lesson) => lesson.end)));
}

export function nextLesson(lessons: Lesson[], now: number): Lesson | undefined {
  let next: Lesson | undefined;

  for (const lesson of lessons) {
    if (lesson.start > now && (!next || lesson.start < next.start)) next = lesson;
  }

  return next;
}

export function nextSchoolLesson(lessons: Lesson[], now: number): Lesson | undefined {
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'Europe/Brussels',
  });

  if (!['Fri', 'Sat', 'Sun'].includes(weekday.format(now)))
    return nextLesson(lessons, now);

  return nextLesson(
    lessons.filter((lesson) => !['Sat', 'Sun'].includes(weekday.format(lesson.start))),
    now,
  );
}
