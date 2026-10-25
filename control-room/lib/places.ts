import { metres, type LatLng } from "./geo";
import type { NearbyPlace } from "./types";

// The places lookup for a GPS stop. With GOOGLE_MAPS_API_KEY it asks Google Places
// (Nearby Search, the "New" API) for real places around the point. Without a key, or when
// Google fails, it returns the simulated places of the event, so the demo runs offline.
// PLACES_PROVIDER=simulated forces the simulated list.

export type SimulatedPlace = Omit<NearbyPlace, "distanceM">;

const GOOGLE_URL = "https://places.googleapis.com/v1/places:searchNearby";
const FIELDS = "places.id,places.displayName,places.primaryType,places.types,places.location,places.currentOpeningHours.openNow";

// Google place types, mapped to the few kinds that tell a stop's cause apart.
const KIND: [RegExp, string][] = [
  [/gas_station/, "fuel_station"],
  [/electric_vehicle_charging_station/, "ev_charging"],
  [/rest_stop/, "rest_area"],
  [/car_repair|car_wash|tire/, "car_repair"],
  [/restaurant|cafe|coffee|bakery|meal_takeaway|food/, "food"],
  [/parking|truck_stop/, "parking"],
  [/lodging|hotel|motel/, "hotel"],
  [/supermarket|convenience_store|grocery|store/, "shop"],
  [/hospital|doctor|pharmacy/, "medical"],
  [/police/, "police"],
];

function kindOf(types: string[]): string {
  for (const t of types) for (const [re, kind] of KIND) if (re.test(t)) return kind;
  return "other";
}

type GooglePlace = {
  id: string;
  displayName?: { text?: string };
  primaryType?: string;
  types?: string[];
  location?: { latitude: number; longitude: number };
  currentOpeningHours?: { openNow?: boolean };
};

async function google(at: LatLng, radiusM: number, key: string): Promise<NearbyPlace[]> {
  const res = await fetch(GOOGLE_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS },
    body: JSON.stringify({
      maxResultCount: 10,
      rankPreference: "DISTANCE",
      locationRestriction: { circle: { center: { latitude: at[0], longitude: at[1] }, radius: radiusM } },
    }),
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Google Places returned ${res.status}`);
  const body = (await res.json()) as { places?: GooglePlace[] };
  return (body.places ?? [])
    .filter((p) => p.location)
    .map((p) => {
      const pos: LatLng = [p.location!.latitude, p.location!.longitude];
      return {
        id: `g-${p.id}`,
        name: p.displayName?.text ?? "Unnamed place",
        type: kindOf([p.primaryType ?? "", ...(p.types ?? [])]),
        lat: pos[0],
        lng: pos[1],
        distanceM: metres(at, pos),
        openNow: p.currentOpeningHours?.openNow ?? null,
      };
    });
}

export async function nearbyPlaces(at: LatLng, radiusM: number, simulated: SimulatedPlace[]): Promise<{ provider: "google" | "simulated"; places: NearbyPlace[]; note?: string }> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (key && process.env.PLACES_PROVIDER !== "simulated") {
    try {
      const places = await google(at, radiusM, key);
      return { provider: "google", places: places.sort((a, b) => a.distanceM - b.distanceM) };
    } catch (e) {
      const sim = withDistance(at, simulated, radiusM);
      return { provider: "simulated", places: sim, note: `Google Places failed (${(e as Error).message}). These are the simulated places.` };
    }
  }
  return { provider: "simulated", places: withDistance(at, simulated, radiusM) };
}

function withDistance(at: LatLng, places: SimulatedPlace[], radiusM: number): NearbyPlace[] {
  return places
    .map((p) => ({ ...p, distanceM: metres(at, [p.lat, p.lng]) }))
    .filter((p) => p.distanceM <= radiusM)
    .sort((a, b) => a.distanceM - b.distanceM);
}
