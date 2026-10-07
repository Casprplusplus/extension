import type { Grade } from './grades';
export async function gradeAwards(
  grades: Grade[],
): Promise<{ key: string; xp: number }[]> {
  const awards = new Map<string, number>();
  for (const grade of grades) {
    if (
      !grade.xpSource ||
      !Number.isFinite(grade.earned) ||
      !Number.isFinite(grade.maximum) ||
      grade.maximum <= 0 ||
      grade.earned < 0 ||
      grade.earned > grade.maximum
    )
      continue;
    const bytes = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(grade.xpSource),
    );
    const key = [...new Uint8Array(bytes)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    const xp = 10 + Math.floor((grade.earned / grade.maximum) * 90);
    awards.set(key, Math.max(awards.get(key) || 0, xp));
  }
  return [...awards].map(([key, xp]) => ({ key, xp }));
}
