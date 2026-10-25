import type { CSSProperties, ReactNode } from "react"
import { CRITERIA, type Idea, type Tone as ToneName } from "./data/ideas"

export const Chip = ({ tone = "neutral", children }: { tone?: ToneName; children: ReactNode }) => (
  <span className={`chip ${tone}`}>{children}</span>
)
export const Badge = ({ n, size = "" }: { n: number | string; size?: "" | "lg" | "sm" }) => <span className={`badge ${size}`}>{n}</span>
export const Src = ({ t, style }: { t: string; style?: CSSProperties }) => <span className="src" style={style}>{t}</span>
export const Caps = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => <div className="caps" style={style}>{children}</div>
export const Card = ({ tone = "", className = "", style, children }: { tone?: string; className?: string; style?: CSSProperties; children?: ReactNode }) => (
  <div className={`card ${tone} ${className}`} style={style}>{children}</div>
)
export const Tone = ({ tone = "", style, children }: { tone?: string; style?: CSSProperties; children: ReactNode }) => (
  <div className={`tone ${tone}`} style={style}>{children}</div>
)
export const Dots = ({ n, max = 3 }: { n: number; max?: number }) => (
  <span className="dots">{Array.from({ length: max }, (_, i) => <i key={i} className={i < n ? "on" : ""} />)}</span>
)
export const Arrow = ({ v = false, color }: { v?: boolean; color?: string }) => (
  <svg className={`arr ${v ? "v" : ""}`} style={color ? { color } : undefined} viewBox="0 0 56 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12h46M40 4l10 8-10 8" />
  </svg>
)
export const Buttons = () => (
  <div className="row gap16">
    <span className="btn primary">Accept</span><span className="btn">Change</span><span className="btn">Reject + why</span>
  </div>
)
export const Quote = ({ children, tag }: { children: ReactNode; tag: string }) => (
  <div className="quote">&ldquo;{children}&rdquo;<Src t={tag} /></div>
)
export const ScoreStrip = ({ scores }: { scores: number[] }) => (
  <div className="score">
    {CRITERIA.map((c, i) => <div key={c}><span>{c}</span><Dots n={scores[i]} /></div>)}
  </div>
)

// Slide frame: title block, body and footer. `index` is the 1-based position in the deck.
export const Slide = ({ eyebrow, title, sub, lead, children, index, section }: {
  eyebrow?: ReactNode; title: string; sub?: string; lead?: ReactNode; children: ReactNode; index: number; section: string
}) => (
  <div className="slide">
    <div className="s-head">
      <div className="eyebrow">{lead}{eyebrow}</div>
      <h1 className="s-title">{title}</h1>
      {sub && <p className="s-sub">{sub}</p>}
    </div>
    <div className="s-body">{children}</div>
    <div className="s-foot"><span><b>Bahn</b> &nbsp;Control Room</span><span>{section} &nbsp;·&nbsp; {index}</span></div>
  </div>
)

export const IdeaSlide = ({ idea, index, section, children }: { idea: Idea; index: number; section: string; children: ReactNode }) => (
  <Slide
    index={index} section={section} title={idea.name} sub={idea.promise}
    lead={<Badge n={idea.n} />}
    eyebrow={<span className="row gap8">{idea.tags.map(([l, t]) => <Chip key={l} tone={t}>{l}</Chip>)}</span>}
  >
    <div className="idea">
      <div className="left">
        <Caps>Today</Caps>
        <p className="today">{idea.today}</p>
        <Quote tag={idea.tag}>{idea.quote}</Quote>
        <Caps style={{ marginTop: 6 }}>The human moment</Caps>
        <p className="moment">{idea.moment}</p>
      </div>
      <div className="right">{children}</div>
    </div>
    <ScoreStrip scores={idea.scores} />
  </Slide>
)
