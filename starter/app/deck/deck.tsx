"use client"

import { useCallback, useEffect, useState } from "react"
import { NOTES } from "./notes"
import { slides } from "./slides"
import "./deck.css"

/** The stage: one 1920 x 1080 slide scaled to the window, or every slide stacked for print. */
export function Deck({ qr, print }: { qr: string; print: boolean }) {
  const all = slides(qr)
  const [at, setAt] = useState(0)
  const [notes, setNotes] = useState(false)
  const [scale, setScale] = useState(0)

  const go = useCallback((n: number) => {
    const next = Math.max(0, Math.min(all.length - 1, n))
    setAt(next)
    history.replaceState(null, "", `#${next + 1}`)
  }, [all.length])

  useEffect(() => {
    const fromHash = () => { const n = parseInt(location.hash.slice(1), 10); if (n >= 1) setAt(Math.min(n, all.length) - 1) }
    fromHash()
    window.addEventListener("hashchange", fromHash)
    return () => window.removeEventListener("hashchange", fromHash)
  }, [all.length])

  useEffect(() => {
    const fit = () => setScale(Math.min(innerWidth / 1920, (innerHeight - (notes ? innerHeight * 0.28 : 0)) / 1080) * 0.96)
    fit()
    window.addEventListener("resize", fit)
    return () => window.removeEventListener("resize", fit)
  }, [notes])

  useEffect(() => {
    if (print) return
    const key = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") go(at + 1)
      else if (e.key === "ArrowLeft" || e.key === "PageUp") go(at - 1)
      else if (e.key === "Home") go(0)
      else if (e.key === "End") go(all.length - 1)
      else if (/^[0-9]$/.test(e.key)) go(e.key === "0" ? 9 : Number(e.key) - 1)
      else if (e.key === "n" || e.key === "N") setNotes((v) => !v)
      else if (e.key === "f" || e.key === "F") document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()
      else if (e.key === "t" || e.key === "T") document.documentElement.classList.toggle("dark")
      else return
      e.preventDefault()
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [at, all.length, go, print])

  if (print) return <div className="deck-print">{all.map((S, k) => <S key={k} />)}</div>

  const Current = all[at]
  return <div className="deck-screen" onClick={() => go(at + 1)}>
    <div style={{ height: notes ? "72vh" : "100%", display: "grid", placeItems: "center" }}>
      <div style={{ width: 1920 * scale, height: 1080 * scale }}>
        <div className="deck-stage" style={{ transform: `scale(${scale})`, visibility: scale ? "visible" : "hidden" }}>
          <Current key={at} />
        </div>
      </div>
    </div>
    {notes && <div className="deck-notes" onClick={(e) => e.stopPropagation()}><b>Slide {at + 1}.</b> {NOTES[at]}</div>}
  </div>
}
