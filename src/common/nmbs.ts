export interface RailStation {
  id: string;
  name: string;
}
export interface RailDeparture {
  vehicle: string;
  serviceDate: string;
  train: string;
  destination: string;
  time: number;
  delay: number;
  platform: string;
  platformChanged: boolean;
  cancelled: boolean;
}
export function parseRailStation(value: unknown): RailStation | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Partial<RailStation>;
  return typeof data.id === 'string' &&
    /^BE\.NMBS\.\d{9}$/.test(data.id) &&
    typeof data.name === 'string'
    ? { id: data.id, name: data.name.slice(0, 150) }
    : null;
}
export function parseRailDepartures(data: any): RailDeparture[] {
  const raw = data?.departures?.departure;
  const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return items
    .filter(
      (item: any) =>
        String(item.left) !== '1' &&
        Number.isFinite(Number(item.time)) &&
        Number(item.time) > 0,
    )
    .map((item: any) => ({
      vehicle: String(item.vehicle || ''),
      serviceDate: String(item.departureConnection || '').match(/\/(\d{8})\//)?.[1] || '',
      train: String(item.vehicleinfo?.shortname || item.vehicle || '').replace(
        /^BE\.NMBS\./,
        '',
      ),
      destination: String(item.station || 'Onbekende bestemming'),
      time: Number(item.time) * 1000,
      delay: Math.max(0, Number(item.delay) || 0) * 1000,
      platform: String(item.platform || '?'),
      platformChanged: String(item.platforminfo?.normal) === '0',
      cancelled: String(item.canceled) === '1',
    }))
    .sort((a: RailDeparture, b: RailDeparture) => a.time + a.delay - (b.time + b.delay));
}
