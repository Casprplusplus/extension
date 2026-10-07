export interface DashboardSettings {
  enabled: boolean;
  widgets: boolean;
  welcome: boolean;
  clock: boolean;
  shortcuts: boolean;
  photo: string;
  glass: boolean;
  transparency: number;
}

export function parseDashboard(value: unknown): DashboardSettings {
  const data = (
    value && typeof value === 'object' ? value : {}
  ) as Partial<DashboardSettings>;

  return {
    enabled: typeof data.enabled === 'boolean' ? data.enabled : true,
    widgets: typeof data.widgets === 'boolean' ? data.widgets : true,
    welcome: data.welcome !== false,
    clock: data.clock !== false,
    shortcuts: data.shortcuts !== false,
    glass: typeof data.glass === 'boolean' ? data.glass : true,
    transparency:
      typeof data.transparency === 'number' && Number.isFinite(data.transparency)
        ? Math.round(Math.max(0, Math.min(85, data.transparency)))
        : 35,
    photo:
      typeof data.photo === 'string' &&
      /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data.photo) &&
      data.photo.length < 3000000
        ? data.photo
        : '',
  };
}
