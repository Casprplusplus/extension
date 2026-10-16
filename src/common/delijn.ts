export interface DeLijnStop {
  number: string;
  entity: string;
  name: string;
}
export interface DeLijnDeparture {
  entity: string;
  internalLine: string;
  direction: string;
  trip: string;
  line: string;
  destination: string;
  scheduled: string;
  expected: string;
  realtime: boolean;
  cancelled: boolean;
}
export interface DeLijnSettings {
  key: string;
  stop: DeLijnStop | null;
  lines: string;
}
export function parseDeLijnSettings(value: unknown): DeLijnSettings {
  const data = (
    value && typeof value === 'object' ? value : {}
  ) as Partial<DeLijnSettings>;
  const stop = data.stop;
  return {
    key: typeof data.key === 'string' ? data.key.trim().slice(0, 256) : '',
    lines: typeof data.lines === 'string' ? data.lines.slice(0, 100) : '',
    stop:
      stop && /^\d{1,8}$/.test(stop.number) && /^[1-5]$/.test(stop.entity)
        ? {
            number: stop.number,
            entity: stop.entity,
            name: String(stop.name).slice(0, 150),
          }
        : null,
  };
}
// De Lijn supplies local Belgian timestamps, without an offset.
export function deLijnTime(value: string): number {
  if (!value) return NaN;
  if (/Z$|[+-]\d\d:\d\d$/.test(value)) return Date.parse(value);
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(value)) return NaN;
  const utc = Date.parse(value + 'Z');
  let result = utc;
  for (let attempt = 0; attempt < 2; attempt++) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Brussels',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(result);
    const get = (key: string) => parts.find((part) => part.type === key)!.value;
    const wall = Date.parse(
      `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`,
    );
    result += utc - wall;
  }
  return result;
}
