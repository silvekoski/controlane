import type { CSSProperties, ReactNode } from "react"

export type Criterion = "Who" | "The problem" | "The control room" | "The agent" | "The model" | "How I built it" | "Try it"
export const TRUTH = "Fictional data, every action is simulated"

const i = (n: number) => ({ "--i": n }) as CSSProperties

/** The slide frame: criterion chip, headline, one supporting line, the visual, and the footer. */
export function Slide({ n, chip, title, sub, foot, children }: {
  n: number; chip: Criterion; title: string; sub?: string; foot?: ReactNode; children: ReactNode
}) {
  return <section className="slide" aria-label={`Slide ${n}`}>
    <div className="in" style={i(0)}><span className="d-chip">{chip}</span></div>
    <h1 className="in" style={i(1)}>{title}</h1>
    {sub && <p className="sub in" style={i(2)}>{sub}</p>}
    <div className="body">{children}</div>
    <div className="foot">{foot}<span className="num">{String(n).padStart(2, "0")} / 10</span></div>
  </section>
}

export const In = ({ n, className = "", style, children }: { n: number; className?: string; style?: CSSProperties; children: ReactNode }) =>
  <div className={`in ${className}`} style={{ ...i(n), ...style }}>{children}</div>

/** A flat crop of an app capture. Crop values are in source pixels; the overlay gets the scale. */
export function Shot({ src, alt, crop, width, className = "", style, overlay }: {
  src: string; alt: string; crop: [number, number, number, number]; width: number; className?: string; style?: CSSProperties
  overlay?: (at: (x: number, y: number) => CSSProperties) => ReactNode
}) {
  const [x, y, w, h] = crop
  const s = width / w
  const at = (px: number, py: number): CSSProperties => ({ position: "absolute", left: (px - x) * s, top: (py - y) * s })
  return <div className={`d-shot ${className}`} style={{ width, height: h * s, ...style }}>
    <img src={src} alt={alt} style={{ left: -x * s, top: -y * s, width: 2880 * s }} />
    {overlay?.(at)}
  </div>
}

export const Badge = ({ n }: { n: number | string }) => <span className="d-badge">{n}</span>

export const TONE: Record<string, string> = {
  good: "var(--deck-good)", warning: "var(--warning)", critical: "var(--danger)", grey: "var(--deck-grey)", accent: "var(--primary)",
}

/** Horizontal bars from zero. The best value is in the accent colour, the rest in grey. */
export function BarCompare({ title, unit, max, rows, start = 0 }: {
  title: string; unit: string; max: number; rows: readonly { label: string; value: number; best?: boolean }[]; start?: number
}) {
  return <div className="d-card" style={{ padding: "28px 32px" }}>
    <div style={{ fontSize: 24, fontWeight: 600 }}>{title}</div>
    <div style={{ display: "grid", gap: 18, marginTop: 24 }}>
      {rows.map((r, k) => <div key={r.label} style={{ display: "grid", gridTemplateColumns: "130px 1fr", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: 20, color: r.best ? "var(--primary)" : "var(--muted-foreground)", fontWeight: r.best ? 600 : 400 }}>{r.label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="grow-x" style={{ ...i(start + k), height: 30, borderRadius: 4, width: `${(r.value / max) * 72}%`, background: r.best ? "var(--primary)" : "var(--deck-grey)" }} />
          <span className="d-mono" style={{ fontSize: 22, fontWeight: r.best ? 600 : 400 }}>{r.value}{unit}</span>
        </div>
      </div>)}
    </div>
  </div>
}

/** Arrow head marker for SVG diagrams. */
export const ArrowDefs = () => <defs>
  <marker id="deck-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
    <path d="M0 0 10 5 0 10z" fill="var(--muted-foreground)" />
  </marker>
</defs>
