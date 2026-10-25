// The model illustrations in public/car-images. Orders with the same model share one; it is not a photo of that car.

const SLUGS = new Set([
  "audi-q5", "audi-q8-e-tron", "audi-rs-6", "bentley-continental-gt", "bentley-flying-spur", "bmw-5-series", "bmw-i4", "bmw-i5", "bmw-m4", "bmw-x5",
  "ferrari-296-gtb", "ferrari-roma", "mercedes-benz-c-class", "mercedes-benz-e-class", "mercedes-benz-eqe", "mercedes-benz-glc", "mercedes-benz-s-class",
  "polestar-2", "porsche-911-carrera", "porsche-macan", "porsche-panamera", "porsche-taycan", "skoda-enyaq", "skoda-octavia", "tesla-model-3", "tesla-model-y",
  "toyota-corolla", "toyota-rav4", "volkswagen-golf", "volkswagen-id-4", "volvo-v60",
])

export function carImage(vehicle: string): string | null {
  const slug = vehicle.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  return SLUGS.has(slug) ? `/car-images/${slug}.webp` : null
}
