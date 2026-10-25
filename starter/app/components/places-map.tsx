"use client"

import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { useEffect, useMemo, useState } from "react"
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet"
import { cityPosition, sitePosition } from "@/lib/geo"
import type { PlaceRow } from "@/lib/present/types"

export type MapRoute = { key: string; from: { city: string; country: string }; to: { city: string; country: string }; live: boolean }

// OpenStreetMap's standard tiles need no key. A CSS filter on the tile pane makes them quiet and follows the theme.
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

/** A pin for one site. The selected site uses the accent colour; a site with waiting work gets an amber ring. */
function siteIcon(place: PlaceRow, selected: boolean) {
  const size = selected ? 22 : 14
  const ring = place.needPerson > 0 ? "box-shadow:0 0 0 2px var(--background),0 0 0 3.5px var(--warning);" : "box-shadow:0 0 0 2px var(--background);"
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;${ring}background:${selected ? "var(--primary)" : "var(--foreground)"}"></div>`,
  })
}

function TileFilter({ filter }: { filter: string }) {
  const map = useMap()
  useEffect(() => { map.getPane("tilePane")!.style.filter = filter }, [map, filter])
  return null
}

function FitTo({ points }: { points: [number, number][] }) {
  const map = useMap()
  const key = points.map((point) => point.join(",")).join(";")
  useEffect(() => {
    if (!points.length) return
    if (points.length === 1) map.flyTo(points[0], 7, { duration: 0.6 })
    else map.flyToBounds(L.latLngBounds(points), { padding: [60, 60], maxZoom: 7, duration: 0.6 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return null
}

export default function PlacesMap({ places, selectedId, routes, onSelect }: {
  places: PlaceRow[]; selectedId: string | null; routes: MapRoute[]; onSelect: (id: string) => void
}) {
  const dark = useDark()
  const pins = useMemo(() => places.flatMap((place) => {
    const position = sitePosition(place.id, place.city, place.country)
    return position ? [{ place, position }] : []
  }), [places])
  const lines = routes.flatMap((route) => {
    const from = cityPosition(route.from.city, route.from.country)
    const to = cityPosition(route.to.city, route.to.country)
    return from && to ? [{ ...route, points: [from, to] as [number, number][] }] : []
  })
  const selected = pins.find((pin) => pin.place.id === selectedId)
  const focus = selected ? [selected.position, ...lines.flatMap((line) => line.points)] : pins.map((pin) => pin.position)

  return <MapContainer center={[56, 14]} zoom={4} zoomControl={false} attributionControl className="size-full bg-muted" style={{ background: "var(--muted)" }}>
    <TileFilter filter={dark ? TILE_FILTER.dark : TILE_FILTER.light} />
    <TileLayer url={TILES} maxZoom={19} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
    {lines.map((line) => <Polyline key={line.key} positions={line.points} pathOptions={{ color: "var(--primary)", weight: line.live ? 3 : 2, opacity: line.live ? 0.9 : 0.45, dashArray: line.live ? undefined : "6 6" }} />)}
    {pins.map(({ place, position }) => <Marker key={place.id} position={position} icon={siteIcon(place, place.id === selectedId)} zIndexOffset={place.id === selectedId ? 1000 : 0} eventHandlers={{ click: () => onSelect(place.id) }}>
      <Tooltip direction="top" offset={[0, -8]} opacity={1}>
        <span className="text-xs"><b>{place.name}</b><br />{place.address ? `${place.address}, ` : ""}{place.city} · {place.orders} orders{place.needPerson ? ` · ${place.needPerson} need a person` : ""}</span>
      </Tooltip>
    </Marker>)}
    <FitTo points={focus} />
  </MapContainer>
}
