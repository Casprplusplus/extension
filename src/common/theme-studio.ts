import { parseDashboard } from './dashboard';
export const studioFonts = {
  system: 'system-ui, sans-serif',
  rounded: '"Trebuchet MS", sans-serif',
  serif: 'Georgia, serif',
  mono: 'Consolas, monospace',
} as const;
export interface StudioTheme {
  name: string;
  background: string;
  gradient: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  buttonText: string;
  line: string;
  soft: string;
  font: keyof typeof studioFonts;
  mode: 'solid' | 'gradient' | 'photo';
  photo: string;
  angle: number;
  glass: boolean;
  opacity: number;
  blur: number;
  radius: number;
  shadow: number;
}
export const studioDefault: StudioTheme = {
  name: 'Mijn theme',
  background: '#eef0fa',
  gradient: '#c5c0ff',
  surface: '#ffffff',
  text: '#232742',
  muted: '#646b85',
  accent: '#635bce',
  buttonText: '#ffffff',
  line: '#daddef',
  soft: '#ece9ff',
  font: 'system',
  mode: 'gradient',
  photo: '',
  angle: 120,
  glass: true,
  opacity: 85,
  blur: 18,
  radius: 18,
  shadow: 20,
};
export function parseStudio(value: unknown): StudioTheme {
  const data = (value && typeof value === 'object' ? value : {}) as Record<
    string,
    unknown
  >;
  const result = { ...studioDefault };
  for (const key of [
    'background',
    'gradient',
    'surface',
    'text',
    'muted',
    'accent',
    'buttonText',
    'line',
    'soft',
  ] as const)
    if (typeof data[key] === 'string' && /^#[0-9a-f]{6}$/i.test(data[key]))
      result[key] = data[key];
  // Older saved themes used these colors for borders and secondary surfaces.
  if (!data.line) result.line = result.muted;
  if (!data.soft) result.soft = result.gradient;
  for (const [key, max] of [
    ['angle', 360],
    ['opacity', 100],
    ['blur', 40],
    ['radius', 48],
    ['shadow', 60],
  ] as const)
    if (typeof data[key] === 'number' && Number.isFinite(data[key]))
      result[key] = Math.round(Math.max(0, Math.min(max, data[key])));
  if (typeof data.name === 'string')
    result.name = data.name.trim().slice(0, 60) || studioDefault.name;
  if (typeof data.font === 'string' && Object.hasOwn(studioFonts, data.font))
    result.font = data.font as StudioTheme['font'];
  if (data.mode === 'solid' || data.mode === 'gradient' || data.mode === 'photo')
    result.mode = data.mode;
  if (typeof data.glass === 'boolean') result.glass = data.glass;
  if (
    typeof data.photo === 'string' &&
    data.photo.length < 3000000 &&
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data.photo)
  )
    result.photo = data.photo;
  return result;
}
export const studioPresets: StudioTheme[] = [
  { ...studioDefault, name: 'Aurora' },
  {
    ...studioDefault,
    name: 'Midnight',
    line: '#35415c',
    soft: '#302d4d',
    background: '#101526',
    gradient: '#35315a',
    surface: '#1b2339',
    text: '#eff2ff',
    muted: '#b0bad3',
    accent: '#b4a9ff',
    buttonText: '#101526',
  },
  {
    ...studioDefault,
    name: 'Sunrise',
    line: '#ead1c5',
    soft: '#ffe6d4',
    background: '#fff2e7',
    gradient: '#ffd0ae',
    surface: '#fffaf5',
    text: '#492d2c',
    muted: '#85615c',
    accent: '#a74432',
  },
  {
    ...studioDefault,
    name: 'Forest',
    line: '#ccded0',
    soft: '#dcece0',
    background: '#eaf3ec',
    gradient: '#bad8bc',
    surface: '#fafff9',
    text: '#203c2d',
    muted: '#567460',
    accent: '#286345',
  },
  {
    ...studioDefault,
    name: 'Neon',
    line: '#49305e',
    soft: '#352346',
    background: '#100d24',
    gradient: '#32124a',
    surface: '#201633',
    text: '#faf0ff',
    muted: '#c4afd6',
    accent: '#e570ff',
    buttonText: '#100d24',
    radius: 12,
  },
  {
    ...studioDefault,
    name: 'Papier',
    line: '#d8d0bc',
    soft: '#eee8dc',
    background: '#eee8dc',
    gradient: '#eee8dc',
    surface: '#fffdf5',
    text: '#333026',
    muted: '#766e60',
    accent: '#76532e',
    font: 'serif',
    glass: false,
    mode: 'solid',
    radius: 4,
    shadow: 6,
  },
];
const properties = [
  '--d-bg',
  '--d-card',
  '--d-surface',
  '--d-text',
  '--d-muted',
  '--d-accent',
  '--d-button-text',
  '--d-line',
  '--d-soft',
  '--ct-bg',
  '--ct-card',
  '--ct-text',
  '--ct-muted',
  '--ct-accent',
  '--ct-glow',
  '--studio-background',
  '--studio-font',
  '--studio-radius',
  '--studio-shadow',
  '--studio-blur',
];
export function applyStudio(value: StudioTheme | null): void {
  const root = document.documentElement;
  if (!value) {
    root.removeAttribute('data-caspr-studio');
    for (const key of properties) root.style.removeProperty(key);
    return;
  }
  const t = parseStudio(value);
  root.dataset.casprStudio = 'true';
  const card =
    t.surface +
    Math.round(t.opacity * 2.55)
      .toString(16)
      .padStart(2, '0');
  const background =
    t.mode === 'photo' && t.photo
      ? `url("${t.photo}") center / cover fixed`
      : t.mode === 'gradient'
        ? `linear-gradient(${t.angle}deg, ${t.background}, ${t.gradient}) fixed`
        : t.background;
  const values = [
    t.background,
    card,
    t.surface,
    t.text,
    t.muted,
    t.accent,
    t.buttonText,
    t.line,
    t.soft,
    t.background,
    card,
    t.text,
    t.muted,
    t.accent,
    t.gradient,
    background,
    studioFonts[t.font],
    `${t.radius}px`,
    `0 ${Math.round(t.shadow / 3)}px ${t.shadow}px #00000030`,
    `${t.glass ? t.blur : 0}px`,
  ];
  properties.forEach((key, index) => root.style.setProperty(key, values[index]));
}
export function watchStudio(): void {
  let revision = 0;
  let enabled = false;
  let active: StudioTheme | null = null;
  const update = () => applyStudio(enabled ? active : null);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || (!changes.studioActive && !changes.dashboard)) return;
    revision++;
    if (changes.dashboard) enabled = parseDashboard(changes.dashboard.newValue).enabled;
    if (changes.studioActive)
      active = changes.studioActive.newValue
        ? parseStudio(changes.studioActive.newValue)
        : null;
    update();
  });
  const initial = revision;
  void chrome.storage.local
    .get(['studioActive', 'dashboard'])
    .then((data) => {
      if (initial !== revision) return;
      enabled = parseDashboard(data.dashboard).enabled;
      active = data.studioActive ? parseStudio(data.studioActive) : null;
      update();
    })
    .catch(() => {});
}
