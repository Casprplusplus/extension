export interface HomeItem {
  id: string;
  kind: 'widget' | 'text' | 'image' | 'link';
  title: string;
  text: string;
  url: string;
  image: string;
  width: number;
  height: number;
  framed: boolean;
  hidden: boolean;
}
export interface HomeLayout {
  name: string;
  items: HomeItem[];
}
export function safeLink(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 2000) return '';
  try {
    const url = new URL(value, 'https://kolvw.caspr.be');
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : '';
  } catch {
    return '';
  }
}
export function parseHome(value: unknown): HomeLayout {
  const data = (value && typeof value === 'object' ? value : {}) as Record<
    string,
    unknown
  >;
  const seen = new Set<string>();
  const items: HomeItem[] = [];
  if (Array.isArray(data.items))
    for (const raw of data.items.slice(0, 60)) {
      if (
        !raw ||
        typeof raw !== 'object' ||
        typeof raw.id !== 'string' ||
        !/^[a-z0-9_:/.-]{1,200}$/i.test(raw.id) ||
        seen.has(raw.id)
      )
        continue;
      if (!['widget', 'text', 'image', 'link'].includes(raw.kind)) continue;
      seen.add(raw.id);
      const string = (v: unknown, max: number) =>
        typeof v === 'string' ? v.slice(0, max) : '';
      const number = (v: unknown, fallback: number, max: number) =>
        typeof v === 'number' && Number.isFinite(v)
          ? Math.round(Math.max(1, Math.min(max, v)))
          : fallback;
      items.push({
        id: raw.id,
        kind: raw.kind,
        title: string(raw.title, 80),
        text: string(raw.text, 2000),
        url: safeLink(raw.url),
        image:
          typeof raw.image === 'string' &&
          raw.image.length < 1500000 &&
          /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(raw.image)
            ? raw.image
            : '',
        width: number(raw.width, 1, 4),
        height: number(raw.height, 1, 4),
        framed: raw.framed !== false,
        hidden: raw.hidden === true,
      });
    }
  return {
    name:
      typeof data.name === 'string'
        ? data.name.trim().slice(0, 60) || 'Mijn startscherm'
        : 'Mijn startscherm',
    items,
  };
}
