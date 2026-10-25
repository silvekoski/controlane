"use client"

import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { useEffect, useMemo, useState } from "react"
import { Circle, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet"
import type { LatLng, StopView, TrackedCar } from "./control"
import { rankedPlaces } from "./stop-check"

/* Maps for the GPS stop check. LiveMap shows every car on the road at the clock time.
   StopMap shows one stop: the car, the stop rule's radius and the places nearby, numbered by Jev's rank. */

const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
const TILE_FILTER = {
  light: "grayscale(0.85) contrast(0.9) brightness(1.05)",
  dark: "grayscale(0.9) invert(1) hue-rotate(180deg) brightness(0.8) contrast(0.85)",
}

function useDark() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const root = document.documentElement
    const read = () => setDark(root.classList.contains("dark"))
    read()
    const observer = new MutationObserver(read)
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])
  return dark
}

// SVG paths take colours as attributes, and attributes cannot read CSS variables, so read the value.
function useColor(name: string) {
  const dark = useDark()
  const [value, setValue] = useState("#888")
  useEffect(() => { setValue(getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888") }, [name, dark])
  return value
}

function TileFilter() {
  const map = useMap()
  const dark = useDark()
  useEffect(() => { map.getPane("tilePane")!.style.filter = dark ? TILE_FILTER.dark : TILE_FILTER.light }, [map, dark])
  return null
}

function Fit({ points, maxZoom, fly = true }: { points: LatLng[]; maxZoom: number; fly?: boolean }) {
  const map = useMap()
  const key = points.map((point) => point.map((n) => n.toFixed(3)).join(",")).join(";")
  useEffect(() => {
    if (!points.length) return
    const bounds = L.latLngBounds(points)
    if (fly) map.flyToBounds(bounds, { padding: [48, 48], maxZoom, duration: 0.6 })
    else map.fitBounds(bounds, { padding: [32, 32], maxZoom })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return null
}

function dot(color: string, size: number, opts: { ring?: string; pulse?: boolean; hollow?: boolean } = {}) {
  const shadow = [`0 0 0 2px var(--background)`, opts.ring ? `0 0 0 4px ${opts.ring}` : "", opts.pulse ? `0 0 0 10px color-mix(in oklch, ${color} 22%, transparent)` : ""].filter(Boolean).join(",")
  const fill = opts.hollow ? `background:var(--background);border:2px dashed ${color};` : `background:${color};`
  return L.divIcon({
    className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;${fill}box-shadow:${shadow}"></div>`,
  })
}

function numbered(rank: number, top: boolean) {
  const size = top ? 24 : 20
  return L.divIcon({
    className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;display:grid;place-items:center;font:600 11px/1 var(--font-sans,system-ui);color:${top ? "var(--primary-foreground)" : "var(--foreground)"};background:${top ? "var(--primary)" : "var(--background)"};border:1.5px solid ${top ? "var(--primary)" : "var(--foreground)"};box-shadow:0 1px 3px rgb(0 0 0 / 0.2)">${rank}</div>`,
  })
}

const pct = (p: number | null | undefined) => (p == null ? "" : `${Math.round(p * 100)}%`)

function StopLayers({ stop, car }: { stop: StopView; car: string }) {
  const warning = useColor("--warning")
  const ranked = rankedPlaces(stop)
  const ranking = Boolean(stop.ranking)
  return <>
    <Circle center={[stop.lat, stop.lng]} radius={150} pathOptions={{ color: warning, weight: 1.5, dashArray: "4 4", fillColor: warning, fillOpacity: 0.1 }} />
    {ranked.map(({ place, rank }) => <Marker key={place.id} position={[place.lat, place.lng]} icon={numbered(rank, ranking && rank === 1 && (stop.ranking?.places[0]?.id === place.id))}>
      <Tooltip direction="top" offset={[0, -10]} opacity={1}>
        <span className="text-xs"><b>{place.name}</b><br />{place.typeLabel} · {place.distanceM} m{place.openNow == null ? "" : place.openNow ? " · open" : " · closed"}{place.probability != null ? <><br />Jev: {pct(place.probability)} likely the reason</> : null}</span>
      </Tooltip>
    </Marker>)}
    <Marker position={[stop.lat, stop.lng]} icon={dot("var(--warning)", 16, { pulse: true })} zIndexOffset={1000}>
      <Tooltip direction="bottom" offset={[0, 10]} permanent opacity={1}><span className="text-xs font-medium">{car} · {stop.stoppedMinutes} min</span></Tooltip>
    </Marker>
  </>
}

/** One stop up close. Used on the decision card. */
export function StopMap({ stop, car }: { stop: StopView; car: string }) {
  const points = useMemo<LatLng[]>(() => [[stop.lat, stop.lng], ...stop.places.map((p): LatLng => [p.lat, p.lng])], [stop])
  return <MapContainer center={[stop.lat, stop.lng]} zoom={16} zoomControl={false} attributionControl={false} scrollWheelZoom={false} className="size-full" style={{ background: "var(--muted)" }}>
    <TileFilter />
    <TileLayer url={TILES} maxZoom={19} />
    <StopLayers stop={stop} car={car} />
    <Fit points={points} maxZoom={17} fly={false} />
  </MapContainer>
}

function carIcon(car: TrackedCar, selected: boolean) {
  const size = selected ? 18 : car.status === "moving" ? 10 : 14
  const card = car.event?.runStatus === "card"
  if (car.status === "signal_lost") return dot("var(--muted-foreground)", size, { hollow: true, ring: selected ? "var(--primary)" : undefined })
  if (car.status === "stopped") return dot(card ? "var(--danger)" : "var(--warning)", size, { pulse: true, ring: selected ? "var(--primary)" : undefined })
  if (car.status === "arrived") return dot("var(--muted-foreground)", size, { ring: selected ? "var(--primary)" : undefined })
  return dot(selected ? "var(--primary)" : "var(--foreground)", size, { ring: selected ? "var(--primary)" : undefined })
}

/** Every car on the road. A selected stop zooms in and shows its places. */
export default function LiveMap({ cars, selected, onSelect }: { cars: TrackedCar[]; selected: string | null; onSelect: (orderId: string | null) => void }) {
  const chosen = cars.find((car) => car.orderId === selected)
  const stop = chosen?.event?.stop ?? null
  const primary = useColor("--primary")
  const muted = useColor("--muted-foreground")
  const focus = useMemo<LatLng[]>(() => {
    if (stop) return [[stop.lat, stop.lng], ...stop.places.map((p): LatLng => [p.lat, p.lng])]
    if (chosen) return [chosen.from.at, chosen.to.at, chosen.at]
    return cars.map((car) => car.at)
    // Fit again only when the selection changes, not on every position update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, stop?.places.length, cars.length > 0])
  return <MapContainer center={[56, 14]} zoom={4} zoomControl={false} attributionControl className="size-full" style={{ background: "var(--muted)" }}>
    <TileFilter />
    <TileLayer url={TILES} maxZoom={19} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
    {cars.map((car) => <Polyline key={`line-${car.orderId}`} positions={car.path} pathOptions={{ color: car.orderId === selected ? primary : muted, weight: car.orderId === selected ? 2.5 : 1.25, opacity: car.orderId === selected ? 0.9 : 0.4, dashArray: "5 6" }} />)}
    {stop && chosen && <StopLayers stop={stop} car={chosen.car} />}
    {cars.filter((car) => !(stop && car.orderId === selected)).map((car) => <Marker key={car.orderId} position={car.at} icon={carIcon(car, car.orderId === selected)} zIndexOffset={car.status === "stopped" ? 800 : car.orderId === selected ? 900 : 0} eventHandlers={{ click: () => onSelect(car.orderId) }}>
      <Tooltip direction="top" offset={[0, -8]} opacity={1}>
        <span className="text-xs"><b>{car.car}</b> · {car.orderRef}<br />{car.driver} · {car.from.city} → {car.to.city}<br />{car.status === "stopped" ? `Standing ${car.stoppedFor}` : car.status === "signal_lost" ? `No GPS for ${car.gpsAge.replace(/ ago$/, "")}` : car.status === "arrived" ? "Arrived" : "Moving"}</span>
      </Tooltip>
    </Marker>)}
    <Fit points={focus} maxZoom={stop ? 16 : chosen ? 8 : 6} />
  </MapContainer>
}
