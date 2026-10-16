export interface WeatherPlace {
  name: string;
  latitude: number;
  longitude: number;
}
export function parseWeatherPlace(value: unknown): WeatherPlace | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Partial<WeatherPlace>;
  return typeof data.name === 'string' &&
    typeof data.latitude === 'number' &&
    Number.isFinite(data.latitude) &&
    Math.abs(data.latitude) <= 90 &&
    typeof data.longitude === 'number' &&
    Number.isFinite(data.longitude) &&
    Math.abs(data.longitude) <= 180
    ? {
        name: data.name.slice(0, 160),
        latitude: data.latitude,
        longitude: data.longitude,
      }
    : null;
}
export function weatherDescription(code: number, day = true): [string, string] {
  if (code === 0) return [day ? '☀️' : '🌙', 'Helder'];
  if (code === 1 || code === 2) return [day ? '🌤️' : '☁️', 'Licht bewolkt'];
  if (code === 3) return ['☁️', 'Bewolkt'];
  if (code === 45 || code === 48) return ['🌫️', 'Mist'];
  if ([51, 53, 55, 56, 57].includes(code)) return ['🌦️', 'Motregen'];
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return ['🌧️', 'Regen'];
  if ([71, 73, 75, 77, 85, 86].includes(code)) return ['🌨️', 'Sneeuw'];
  if ([95, 96, 99].includes(code)) return ['⛈️', 'Onweer'];
  return ['🌡️', 'Weer'];
}
