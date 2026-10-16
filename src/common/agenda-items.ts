export interface AgendaItem {
  title: string;
  start: number;
  kind: 'test' | 'task';
}
export function agendaKind(title: string): AgendaItem['kind'] | null {
  if (/toets|examen|test\b|overhoring/i.test(title)) return 'test';
  return /taak|deadline|huiswerk|opdracht|inlever/i.test(title) ? 'task' : null;
}
export function parseAgendaItems(value: unknown): AgendaItem[] {
  if (!Array.isArray(value) || value.length > 2000)
    throw new Error('Onverwacht agendaantwoord.');
  const items: AgendaItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw.title !== 'string' || typeof raw.start !== 'string') continue;
    const template = document.createElement('template');
    template.innerHTML = raw.title.slice(0, 10000);
    const title = (template.content.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 250);
    const kind = agendaKind(title),
      start = Date.parse(raw.start);
    if (kind && Number.isFinite(start)) items.push({ title, start, kind });
  }
  return items.sort((a, b) => a.start - b.start);
}
