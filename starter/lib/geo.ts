// Public city centres (latitude, longitude) for every city in the dataset.
// The dataset has no coordinates, so the places map shows each site at its city, not at its street address.

export const CITY_POSITION: Record<string, [number, number]> = {
  "Helsinki|FI": [60.1699, 24.9384], "Espoo|FI": [60.2055, 24.6559], "Vantaa|FI": [60.2934, 25.0378], "Oulu|FI": [65.0121, 25.4651],
  "Lahti|FI": [60.9827, 25.6612], "Turku|FI": [60.4518, 22.2666], "Tampere|FI": [61.4978, 23.761], "Seinäjoki|FI": [62.7903, 22.8403],
  "Hamburg|DE": [53.5511, 9.9937], "Cologne|DE": [50.9375, 6.9603], "Munich|DE": [48.1351, 11.582], "Frankfurt|DE": [50.1109, 8.6821],
  "Leipzig|DE": [51.3397, 12.3731], "Berlin|DE": [52.52, 13.405], "Düsseldorf|DE": [51.2277, 6.7735], "Stuttgart|DE": [48.7758, 9.1829],
  "Copenhagen|DK": [55.6761, 12.5683], "Odense|DK": [55.4038, 10.4024], "Aarhus|DK": [56.1629, 10.2039],
  "Stockholm|SE": [59.3293, 18.0686], "Malmö|SE": [55.605, 13.0038], "Gothenburg|SE": [57.7089, 11.9746],
  "Lyon|FR": [45.764, 4.8357], "Lille|FR": [50.6292, 3.0573], "Marseille|FR": [43.2965, 5.3698], "Paris|FR": [48.8566, 2.3522],
  "Rotterdam|NL": [51.9244, 4.4777], "Antwerp|BE": [51.2194, 4.4025], "Vienna|AT": [48.2082, 16.3738], "Graz|AT": [47.0707, 15.4395],
}

export function cityPosition(city: string, country?: string | null): [number, number] | null {
  if (country) return CITY_POSITION[`${city}|${country}`] ?? null
  const key = Object.keys(CITY_POSITION).find((item) => item.startsWith(`${city}|`))
  return key ? CITY_POSITION[key] : null
}

/**
 * A stable made-up position 1–4 km from the city centre. The sites and their street addresses are fictional
 * (the geocoder found none of them), so the map uses this approximate point and says so.
 */
export function sitePosition(siteId: string, city: string, country?: string | null): [number, number] | null {
  const centre = cityPosition(city, country)
  if (!centre) return null
  let hash = 2166136261
  for (const char of siteId) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0
  const angle = (hash % 360) * Math.PI / 180
  const km = 1 + ((hash >>> 9) % 300) / 100
  const lat = centre[0] + (km / 111) * Math.sin(angle)
  const lon = centre[1] + (km / (111 * Math.cos(centre[0] * Math.PI / 180))) * Math.cos(angle)
  return [Number(lat.toFixed(5)), Number(lon.toFixed(5))]
}
