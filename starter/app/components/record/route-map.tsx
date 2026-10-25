"use client"

import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { useEffect } from "react"
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet"

/** A small route map: start, end, and the car's estimated point on the straight line between them. */
export default function RouteMap({ from, to, car, carLabel }: { from: [number, number]; to: [number, number]; car: [number, number] | null; carLabel: string }) {
  const dot = (color: string, size: number, pulse = false) => L.divIcon({
    className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};box-shadow:0 0 0 3px var(--background)${pulse ? `,0 0 0 12px color-mix(in oklch, ${color} 25%, transparent)` : ""}"></div>`,
  })
  return <MapContainer center={from} zoom={5} zoomControl={false} attributionControl={false} dragging={false} scrollWheelZoom={false} doubleClickZoom={false} className="size-full" style={{ background: "var(--muted)" }}>
    <Quiet />
    <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
    <Polyline positions={[from, to]} pathOptions={{ color: "var(--primary)", weight: 2.5, dashArray: "6 6" }} />
    {car && <Polyline positions={[from, car]} pathOptions={{ color: "var(--primary)", weight: 3 }} />}
    <Marker position={from} icon={dot("var(--foreground)", 10)} />
    <Marker position={to} icon={dot("var(--foreground)", 10)} />
    {car && <Marker position={car} icon={dot("var(--primary)", 16, true)}><Tooltip direction="top" offset={[0, -10]} permanent><span className="text-xs">{carLabel}</span></Tooltip></Marker>}
    <Fit points={[from, to]} />
  </MapContainer>
}

function Quiet() {
  const map = useMap()
  useEffect(() => {
    const apply = () => {
      const dark = document.documentElement.classList.contains("dark")
      map.getPane("tilePane")!.style.filter = dark ? "grayscale(0.9) invert(1) hue-rotate(180deg) brightness(0.8) contrast(0.85)" : "grayscale(0.85) contrast(0.9) brightness(1.05)"
    }
    apply()
    const observer = new MutationObserver(apply)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [map])
  return null
}

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => { map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 9 }) }, [map, points])
  return null
}
