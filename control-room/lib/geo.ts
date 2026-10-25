// City centres for the cities in the packet (the same table as starter/lib/geo.ts).
// The packet has no coordinates, so the live map draws each route between its two cities.

export type LatLng = [number, number];

const CITY: Record<string, LatLng> = {
  "Helsinki|FI": [60.1699, 24.9384], "Espoo|FI": [60.2055, 24.6559], "Vantaa|FI": [60.2934, 25.0378], "Oulu|FI": [65.0121, 25.4651],
  "Lahti|FI": [60.9827, 25.6612], "Turku|FI": [60.4518, 22.2666], "Tampere|FI": [61.4978, 23.761], "Seinäjoki|FI": [62.7903, 22.8403],
  "Hamburg|DE": [53.5511, 9.9937], "Cologne|DE": [50.9375, 6.9603], "Munich|DE": [48.1351, 11.582], "Frankfurt|DE": [50.1109, 8.6821],
  "Leipzig|DE": [51.3397, 12.3731], "Berlin|DE": [52.52, 13.405], "Düsseldorf|DE": [51.2277, 6.7735], "Stuttgart|DE": [48.7758, 9.1829],
  "Copenhagen|DK": [55.6761, 12.5683], "Odense|DK": [55.4038, 10.4024], "Aarhus|DK": [56.1629, 10.2039],
  "Stockholm|SE": [59.3293, 18.0686], "Malmö|SE": [55.605, 13.0038], "Gothenburg|SE": [57.7089, 11.9746],
  "Lyon|FR": [45.764, 4.8357], "Lille|FR": [50.6292, 3.0573], "Marseille|FR": [43.2965, 5.3698], "Paris|FR": [48.8566, 2.3522],
  "Rotterdam|NL": [51.9244, 4.4777], "Antwerp|BE": [51.2194, 4.4025], "Vienna|AT": [48.2082, 16.3738], "Graz|AT": [47.0707, 15.4395],
};

export function cityPosition(city: string | null | undefined, country?: string | null): LatLng | null {
  if (!city) return null;
  if (country && CITY[`${city}|${country}`]) return CITY[`${city}|${country}`];
  const key = Object.keys(CITY).find((k) => k.startsWith(`${city}|`));
  return key ? CITY[key] : null;
}

/** Distance in metres between two points (haversine). */
export function metres(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6371000 * Math.asin(Math.sqrt(h)));
}

/** The point at a distance (metres) along a path of points. Clamped to the path ends. */
export function alongPath(path: LatLng[], distanceM: number): LatLng {
  if (distanceM <= 0) return path[0];
  let left = distanceM;
  for (let i = 1; i < path.length; i++) {
    const leg = metres(path[i - 1], path[i]);
    if (left <= leg && leg > 0) {
      const f = left / leg;
      return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * f, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * f];
    }
    left -= leg;
  }
  return path[path.length - 1];
}

export function pathLength(path: LatLng[]): number {
  let m = 0;
  for (let i = 1; i < path.length; i++) m += metres(path[i - 1], path[i]);
  return m;
}
