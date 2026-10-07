export interface Grade {
  subject: string;
  earned: number;
  maximum: number;
  xpSource?: string;
}

export function parseScore(
  text: string,
): { earned: number; maximum: number } | undefined {
  const match = text
    .trim()
    .match(/^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)(?:\s*\(\d+(?:[.,]\d+)?%\))?$/);

  if (!match) return;

  const earned = Number(match[1].replace(',', '.'));
  const maximum = Number(match[2].replace(',', '.'));

  if (maximum <= 0 || earned > maximum) return;

  return { earned, maximum };
}

export function summarizeGrades(grades: Grade[]) {
  const groups = new Map<
    string,
    { subject: string; earned: number; maximum: number; count: number }
  >();

  for (const grade of grades) {
    if (
      !grade ||
      typeof grade.subject !== 'string' ||
      !Number.isFinite(grade.earned) ||
      !Number.isFinite(grade.maximum) ||
      grade.maximum <= 0 ||
      grade.earned < 0 ||
      grade.earned > grade.maximum
    )
      continue;

    const group = groups.get(grade.subject) || {
      subject: grade.subject,
      earned: 0,
      maximum: 0,
      count: 0,
    };

    group.earned += grade.earned;
    group.maximum += grade.maximum;
    group.count++;

    groups.set(grade.subject, group);
  }

  return [...groups.values()].map((group) => ({
    ...group,
    percentage: (group.earned / group.maximum) * 100,
  }));
}
