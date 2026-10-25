import React from "react"
import { AbsoluteFill, Img, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion"
import { BrandMark, Captions, Card, CornerBug, SceneLabel, Wordmark } from "../components"
import { C, F } from "../lib/tokens"
import { cue, scene } from "../lib/timing"
import { DEEP, ease, POP, UI } from "../lib/motion"
import { allUnseen, bahnator, data, runs, SOURCE_LINE, unseen } from "../lib/metrics"

const ID = "07-bahnator"
const pct = (v: number) => `${(v * 100).toFixed(1).replace(/\.0$/, "")}%`

const Title: React.FC<{ children: React.ReactNode; at?: number }> = ({ children, at = 0 }) => {
  const o = ease(useCurrentFrame(), at, at + 14)
  return <div style={{ position: "absolute", left: 300, right: 300, top: 104, textAlign: "center", fontFamily: F.sans, fontSize: 44, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.2, color: C.ink, opacity: o, textWrap: "balance" as never }}>{children}</div>
}
const Source: React.FC = () => <div style={{ position: "absolute", left: 0, right: 0, top: 890, textAlign: "center", fontFamily: F.sans, fontSize: 18, color: C.muted }}>{SOURCE_LINE}</div>
const Logo: React.FC<{ file: string; height: number; width?: number }> = ({ file, height, width }) => <Img src={staticFile(`logos/${file}`)} style={{ height, width: width ?? "auto", display: "block" }} />
/** A one-colour mark with its own aspect ratio, as a mask. */
const Mask: React.FC<{ file: string; w: number; h: number; color?: string }> = ({ file, w, h, color = C.ink }) => (
  <div style={{ width: w, height: h, background: color, WebkitMaskImage: `url(${staticFile(`logos/${file}`)})`, WebkitMaskSize: "contain", WebkitMaskRepeat: "no-repeat", WebkitMaskPosition: "left center" }} />
)

/**
 * The model in 3D. Transformer layers fly in and stack while the stack turns slowly.
 * A pulse runs up through the layers. After the voice names the LoRA adapter, an adapter snaps onto each layer as the pulse passes.
 * The image part at the bottom stays grey.
 */
const Layers: React.FC<{ lora: number }> = ({ lora }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const n = 11
  const turn = -46 + 14 * ease(frame, 0, 400)
  const period = 46
  const pulse = ((frame % period) / period) * (n + 2) - 1
  return (
    <div style={{ position: "absolute", inset: 0, perspective: 1500 }}>
      <div style={{ position: "absolute", left: 120, top: 150, width: 320, height: 320, transformStyle: "preserve-3d", transform: `rotateX(60deg) rotateZ(${turn}deg)` }}>
        {Array.from({ length: n }).map((_, i) => {
          const image = i === 0
          const inP = spring({ frame: frame - 6 - i * 3, fps, config: DEEP })
          const bob = Math.sin(frame / 18 + i * 0.7) * 3
          const near = Math.max(0, 1 - Math.abs(pulse - i))
          // The adapter attaches when the first pulse after the cue reaches this layer.
          const attachAt = lora + Math.ceil(((i + 1) / (n + 2)) * period)
          const a = image ? 0 : spring({ frame: frame - attachAt, fps, config: POP })
          const burst = image ? 0 : ease(frame, attachAt, attachAt + 4) * ease(frame, attachAt + 4, attachAt + 22, 1, 0)
          const z = (i * 30 - 150) * inP + (1 - inP) * -700 + bob
          return (
            <div key={i} style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: `translateZ(${z}px)`, opacity: inP }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: 20,
                background: image ? "linear-gradient(135deg, #ececef, #dcdce1)" : `linear-gradient(135deg, rgba(255,255,255,0.96), rgba(236,236,250,${0.6 + 0.4 * near}))`,
                boxShadow: image ? `0 0 0 1.5px ${C.input}` : `0 0 0 1.5px ${near > 0.2 ? C.accent : C.border}, 0 0 ${30 * near}px ${near > 0.1 ? C.accent : "transparent"}` }}>
                {image && <div style={{ position: "absolute", inset: 40, borderRadius: 10, backgroundImage: "radial-gradient(#c4c4cc 2px, transparent 2px)", backgroundSize: "18px 18px" }} />}
                {!image && <div style={{ position: "absolute", left: 24, top: 24, right: 110, bottom: 24, borderRadius: 10, backgroundImage: `linear-gradient(90deg, ${C.border} 1px, transparent 1px)`, backgroundSize: "22px 100%", opacity: 0.8 }} />}
              </div>
              {!image && (
                <div style={{ position: "absolute", right: 18, top: 18, width: 74, height: 284, borderRadius: 12, opacity: Math.min(1, a * 1.5),
                  transform: `translateX(${(1 - a) * 160}px) translateZ(${(1 - a) * 60 + 2}px)`,
                  background: `linear-gradient(180deg, ${C.accentTop}, ${C.accent})`, boxShadow: `0 0 ${10 + 40 * burst}px ${C.accent}` }} />
              )}
            </div>
          )
        })}
        {/* Tokens rising through the stack. */}
        {Array.from({ length: 10 }).map((_, k) => {
          const t = ((frame + k * 17) % 90) / 90
          return <div key={`t${k}`} style={{ position: "absolute", left: 60 + ((k * 53) % 200), top: 60 + ((k * 89) % 200), width: 10, height: 10, borderRadius: 9, background: C.accent,
            transform: `translateZ(${-150 + t * 360}px)`, opacity: ease(frame, 40, 60) * Math.sin(t * Math.PI) }} />
        })}
      </div>
      <div style={{ position: "absolute", left: 40, top: 610, display: "flex", gap: 26, fontFamily: F.sans, fontSize: 20, color: C.muted, whiteSpace: "nowrap", opacity: ease(frame, 40, 56) }}>
        <span><span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 4, background: C.accent, marginRight: 8, verticalAlign: -1 }} />My LoRA adapter on each layer</span>
        <span><span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 4, background: "#d4d4d8", marginRight: 8, verticalAlign: -1 }} />Image part, unchanged</span>
      </div>
    </div>
  )
}

/** The model, its base model and Laya, with their logos. */
const NameCard: React.FC = () => {
  const frame = useCurrentFrame()
  const liquid = cue(ID, "Liquid")
  const lora = cue(ID, "LoRA")
  const laya = cue(ID, "also")
  const up = (at: number) => ({ opacity: ease(frame, at, at + 14), transform: `translateY(${(1 - ease(frame, at, at + 14)) * 12}px)` })
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 290, top: 200, width: 840 }}>
        <div style={{ fontFamily: F.sans, fontSize: 22, color: C.muted, ...up(2) }}>My fine-tuned model</div>
        <div style={{ marginTop: 10, fontFamily: F.mono, fontSize: 50, fontWeight: 600, whiteSpace: "nowrap", letterSpacing: "-0.02em", backgroundImage: `linear-gradient(180deg, ${C.accentTop}, ${C.accent})`, WebkitBackgroundClip: "text", color: "transparent", ...up(6) }}>{bahnator.name}</div>
        <Card style={{ marginTop: 34, padding: "22px 26px", display: "flex", alignItems: "center", gap: 22, ...up(liquid - 6) }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, width: 210 }}><Mask file="liquid.svg" w={54} h={54} /><Mask file="liquid-text.svg" w={136} h={54} /></div>
          <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 22 }}>
            <div style={{ fontFamily: F.sans, fontSize: 26, fontWeight: 600, color: C.ink }}>Liquid AI d1-3B</div>
            <div style={{ fontFamily: F.sans, fontSize: 21, color: C.muted, marginTop: 4 }}>3 billion parameters · reads text and images</div>
            <div style={{ fontFamily: F.sans, fontSize: 21, color: C.accent, marginTop: 4, opacity: ease(frame, lora, lora + 12) }}>+ my {bahnator.method} adapter, {bahnator.trainableParams} trainable parameters</div>
          </div>
        </Card>
        <Card style={{ marginTop: 18, padding: "22px 26px", display: "flex", alignItems: "center", gap: 22, ...up(laya) }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, width: 210 }}><Logo file="laya.png" height={62} /><Wordmark text="Laya" size={36} /></div>
          <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 22 }}>
            <div style={{ fontFamily: F.sans, fontSize: 26, fontWeight: 600, color: C.ink }}>Laya, also fine-tuned</div>
            <div style={{ fontFamily: F.sans, fontSize: 21, color: C.muted, marginTop: 4 }}>421 million parameters · decision model by ConvAI Innovations</div>
          </div>
        </Card>
      </div>
      <div style={{ position: "absolute", left: 1160, top: 120, width: 600, height: 700 }}><Layers lora={lora} /></div>
    </AbsoluteFill>
  )
}

/** The seven training runs, on cloud GPUs. */
const Runs: React.FC<{ base: number }> = ({ base }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const six = cue(ID, "six") - base
  const one = cue(ID, "d1", 1) - base
  return (
    <AbsoluteFill>
      <Title>{data.trainingRuns} training runs: six for Laya, one for d1</Title>
      <div style={{ position: "absolute", left: 160, right: 160, top: 300, display: "flex", gap: 16, justifyContent: "center" }}>
        {runs.map((r, i) => {
          const at = r.winner ? one : six + i * 4
          const p = spring({ frame: frame - at, fps, config: POP })
          return (
            <div key={r.name} style={{ width: 196, opacity: Math.min(1, p * 1.5), transform: `translateY(${(1 - p) * 30}px)` }}>
              <Card style={{ padding: "20px 18px", height: 150, boxShadow: r.winner ? `0 0 0 2px ${C.accent}, 0 16px 34px -16px rgba(92,98,210,0.5)` : undefined }}>
                <div style={{ fontFamily: F.mono, fontSize: 16, color: C.muted }}>Run {i + 1}</div>
                <div style={{ marginTop: 8, fontFamily: F.sans, fontSize: 25, fontWeight: 600, color: r.winner ? C.accent : C.ink }}>{r.name}</div>
                <div style={{ marginTop: 8, fontFamily: F.sans, fontSize: 17, color: C.muted, lineHeight: 1.3 }}>{r.note}</div>
              </Card>
              {r.winner && <div style={{ marginTop: 12, textAlign: "center", fontFamily: F.mono, fontSize: 18, color: C.accent, opacity: ease(frame, one + 12, one + 24) }}>bahnator</div>}
            </div>
          )
        })}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 600, display: "flex", justifyContent: "center", alignItems: "center", gap: 48, opacity: ease(frame, 10, 24) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}><Logo file="nvidia-color.svg" height={46} /><span style={{ fontFamily: F.sans, fontSize: 24, color: C.ink }}>NVIDIA RTX GPUs</span></div>
        <div style={{ width: 1, height: 40, background: C.border }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}><Logo file="verda.svg" height={40} width={154} /><span style={{ fontFamily: F.sans, fontSize: 24, color: C.ink }}>cloud, Finland</span></div>
      </div>
    </AbsoluteFill>
  )
}

/** G1: 15,000 unique cases from 676 families. 203 families slide behind glass before training. */
const Split: React.FC<{ base: number }> = ({ base }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const fifteen = cue(ID, "fifteen") - base
  const show = cue(ID, "six", 1) - base
  const lock = cue(ID, "two") - base
  const held = cue(ID, "four", 1) - base
  const rest = cue(ID, "trained", 1) - base
  const n = 26, size = 16, gap = 4
  const heldRows = 8
  const cases = Math.round(data.uniqueCases * ease(frame, fifteen - 6, fifteen + 14))
  return (
    <AbsoluteFill>
      <Title at={lock + 10}>{data.heldOutFamilies} of {data.templateFamilies} template families were locked away before training</Title>
      <div style={{ position: "absolute", left: 300, top: 290 }}>
        <div style={{ position: "absolute", left: 0, top: -50, fontFamily: F.sans, fontSize: 26, fontWeight: 600, color: C.ink, opacity: ease(frame, show, show + 12) }}>{data.templateFamilies} template families</div>
        {Array.from({ length: data.templateFamilies }).map((_, i) => {
          const r = Math.floor(i / n), c = i % n
          const isHeld = r >= n - heldRows && i < data.templateFamilies - 5
          const appear = ease(frame, 2 + r * 1.2, 2 + r * 1.2 + 8)
          const slide = isHeld ? spring({ frame: frame - lock - (r - (n - heldRows)) * 2, fps, config: UI, durationInFrames: 26 }) : 0
          const used = !isHeld ? ease(frame, rest, rest + 20) : 0
          return <div key={i} style={{ position: "absolute", left: c * (size + gap) + slide * 640, top: r * (size + gap), width: size, height: size, borderRadius: 4,
            background: isHeld ? (slide > 0.5 ? "#c7cbf3" : C.accent) : used > 0.5 ? C.ok : C.accent, opacity: appear * (isHeld ? 1 : 1 - used * 0.5), transform: `scale(${appear})` }} />
        })}
        <div style={{ position: "absolute", left: 620, top: (n - heldRows) * (size + gap) - 18, width: n * (size + gap) + 30, height: heldRows * (size + gap) + 30, borderRadius: 16,
          background: "rgba(255,255,255,0.45)", backdropFilter: "blur(3px)", boxShadow: `inset 0 0 0 1.5px ${C.border}`, opacity: ease(frame, lock + 26, lock + 40) }} />
        <div style={{ position: "absolute", left: 620, top: (n - heldRows) * (size + gap) - 84, opacity: ease(frame, held, held + 12) }}>
          <div style={{ fontFamily: F.sans, fontSize: 26, fontWeight: 600, color: C.ink }}>Locked away: {data.heldOutFamilies} families</div>
          <div style={{ fontFamily: F.sans, fontSize: 22, color: C.muted, marginTop: 2 }}>{data.heldOutCases.toLocaleString("en-US")} cases the models never saw</div>
        </div>
        <div style={{ position: "absolute", left: 640, top: 0 }}>
          <div style={{ opacity: ease(frame, fifteen - 6, fifteen + 4) }}>
            <div style={{ fontFamily: F.mono, fontSize: 64, fontWeight: 600, color: C.ink }}>{cases.toLocaleString("en-US")}</div>
            <div style={{ fontFamily: F.sans, fontSize: 24, color: C.muted }}>unique synthetic cases</div>
          </div>
          <div style={{ marginTop: 22, fontFamily: F.sans, fontSize: 22, color: "#0f7a53", opacity: ease(frame, rest, rest + 12) }}>
            Training: {data.trainingRows.toLocaleString("en-US")} rows from the other {data.templateFamilies - data.heldOutFamilies} families
          </div>
        </div>
      </div>
    </AbsoluteFill>
  )
}

const TONES = { accent: C.accent, dark: "#71717a", mid: "#a1a1aa", light: "#d4d4d8" }

const Bar: React.FC<{ label: string; sub?: string; value: number; max: number; text: string; at: number; tone: keyof typeof TONES; width?: number; height?: number }> = ({ label, sub, value, max, text, at, tone, width = 860, height = 38 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const p = spring({ frame: frame - at, fps, config: UI, durationInFrames: 22 })
  const accent = tone === "accent"
  return (
    <div style={{ display: "grid", gridTemplateColumns: "400px 1fr", alignItems: "center", gap: 26, opacity: ease(frame, 2, 12) }}>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: F.sans, fontSize: 25, fontWeight: accent ? 650 : 500, color: accent ? C.accent : C.ink }}>{label}</div>
        {sub && <div style={{ fontFamily: F.sans, fontSize: 17, color: C.muted }}>{sub}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: (value / max) * width * p, height, borderRadius: 6, background: TONES[tone] }} />
        <div style={{ fontFamily: F.mono, fontSize: 28, fontWeight: 600, color: accent ? C.accent : C.ink, opacity: p > 0.9 ? 1 : 0 }}>{text}</div>
      </div>
    </div>
  )
}

/** G3: right answers for every checker on the unseen cases. */
const Accuracy: React.FC<{ base: number }> = ({ base }) => {
  const base3 = cue(ID, "sixty-five")
  const at = [cue(ID, "ninety-three"), cue(ID, "eighty-nine"), cue(ID, "eighty-eight"), base3, base3 + 6, base3 + 12].map((f) => f - base)
  return (
    <AbsoluteFill>
      <Title>Right answers on {data.heldOutCases.toLocaleString("en-US")} cases from unseen families</Title>
      <div style={{ position: "absolute", left: 140, top: 250, display: "flex", flexDirection: "column", gap: 22 }}>
        {allUnseen.map((m, i) => <Bar key={m.label} label={m.label} sub={m.sub} value={m.correct} max={1} text={pct(m.correct)} at={at[i]} tone={m.tone} />)}
      </div>
      <Source />
    </AbsoluteFill>
  )
}

/** G4: false alarms before and after fine-tuning, and Jev. */
const FalseAlarms: React.FC<{ base: number }> = ({ base }) => {
  const before = cue(ID, "thirty-three") - base
  const after = cue(ID, "five", 1) - base
  const jev = cue(ID, "raises") - base
  const d1 = allUnseen[3], b = allUnseen[0], j = allUnseen[1]
  return (
    <AbsoluteFill>
      <Title>Fine-tuning cut false alarms from 33% to 5%</Title>
      <div style={{ position: "absolute", left: 140, top: 330, display: "flex", flexDirection: "column", gap: 30 }}>
        <Bar label="Liquid d1-3B" sub="as released" value={d1.falseAlarms} max={0.35} text={pct(d1.falseAlarms)} at={before} tone="light" height={46} />
        <Bar label="bahnator-1.1-pro-preview" sub="after fine-tuning" value={b.falseAlarms} max={0.35} text={pct(b.falseAlarms)} at={after} tone="accent" height={46} />
        <Bar label="Jev" sub="commercial checker" value={j.falseAlarms} max={0.35} text={pct(j.falseAlarms)} at={jev} tone="dark" height={46} />
      </div>
      <Source />
    </AbsoluteFill>
  )
}

/** G5: time and cost per check. */
const Speed: React.FC<{ base: number }> = ({ base }) => {
  const fast = cue(ID, "twenty-two") - base
  const slow = cue(ID, "two", 1) - base
  const cost = cue(ID, "costs") - base
  const b = unseen.bahnator, j = unseen.jev
  return (
    <AbsoluteFill>
      <Title>{Math.round(b.ms)} ms against {Math.round(j.ms)} ms, at about a third of the cost</Title>
      <div style={{ position: "absolute", left: 140, top: 290, display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ marginLeft: 426, fontFamily: F.sans, fontSize: 22, color: C.muted }}>Time per check</div>
        <Bar label={b.label} value={b.ms} max={j.ms} text={`${Math.round(b.ms)} ms`} at={fast} tone="accent" width={760} />
        <Bar label={j.label} value={j.ms} max={j.ms} text={`${Math.round(j.ms)} ms`} at={slow} tone="dark" width={760} />
        <div style={{ marginLeft: 426, marginTop: 26, fontFamily: F.sans, fontSize: 22, color: C.muted }}>Cost per 1,000 checks</div>
        <Bar label={b.label} value={b.usdPer1000} max={j.usdPer1000} text={`$${b.usdPer1000.toFixed(4)}`} at={cost} tone="accent" width={760} />
        <Bar label={j.label} value={j.usdPer1000} max={j.usdPer1000} text={`$${j.usdPer1000.toFixed(3)}`} at={cost + 10} tone="dark" width={760} />
      </div>
      <Source />
    </AbsoluteFill>
  )
}

/** G6: the receipt for the winning run. */
const Receipt: React.FC<{ base: number }> = ({ base }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const p = spring({ frame, fps, config: DEEP })
  const mins = cue(ID, "twenty-four") - base
  const gpu = cue(ID, "NVIDIA") - base
  const verda = cue(ID, "Verda") - base
  const total = cue(ID, "thirty-three", 1) - base
  const usd = bahnator.sessionUsd * ease(frame, total - 40, total)
  const row = (k: string, v: React.ReactNode, at: number) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: `1px dashed ${C.border}`, opacity: ease(frame, at - 4, at + 6) }}>
      <span style={{ fontFamily: F.sans, fontSize: 24, color: C.muted }}>{k}</span><span style={{ fontFamily: F.mono, fontSize: 24, color: C.ink, display: "flex", alignItems: "center", gap: 12 }}>{v}</span>
    </div>
  )
  return (
    <AbsoluteFill>
      <Title>${bahnator.sessionUsd.toFixed(2)} to train the winner</Title>
      <div style={{ position: "absolute", left: 640, top: 220, width: 640, perspective: 1600 }}>
        <Card style={{ padding: "30px 36px", transform: `rotateX(${(1 - p) * 30}deg) translateY(${(1 - p) * 60}px)`, opacity: p }}>
          <div style={{ fontFamily: F.mono, fontSize: 18, color: C.muted }}>Training run · {bahnator.name}</div>
          {row("Training", `${bahnator.trainMinutes} min`, mins)}
          {row("Session", `${bahnator.sessionMinutes} min`, mins + 8)}
          {row("GPU", <><Logo file="nvidia-color.svg" height={30} />1× {bahnator.gpu}</>, gpu)}
          {row("Rate", `$${bahnator.gpuUsdPerHour} an hour`, gpu + 8)}
          {row("Cloud", <><Logo file="verda.svg" height={30} width={115} />Finland</>, verda)}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 20, opacity: ease(frame, total - 44, total - 36) }}>
            <span style={{ fontFamily: F.sans, fontSize: 28, fontWeight: 600, color: C.ink }}>Total</span>
            <span style={{ fontFamily: F.mono, fontSize: 56, fontWeight: 600, color: C.accent }}>${usd.toFixed(2)}</span>
          </div>
        </Card>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 870, display: "flex", justifyContent: "center", alignItems: "center", gap: 12, opacity: ease(frame, total + 10, total + 24) }}>
        <BrandMark name="huggingface" size={26} color={C.ink} />
        <span style={{ fontFamily: F.sans, fontSize: 20, color: C.muted }}>Base model: <span style={{ fontFamily: F.mono, color: C.ink }}>{bahnator.baseUrl}</span></span>
      </div>
    </AbsoluteFill>
  )
}

export const S7: React.FC = () => {
  const frame = useCurrentFrame()
  const r = cue(ID, "Seven") - 10
  const g1 = cue(ID, "My", 1) - 10
  const g3 = cue(ID, "unseen") - 14
  const g4 = cue(ID, "Fine-tuning") - 8
  const g5 = cue(ID, "Baan-ator", 2) - 8
  const g6 = cue(ID, "winning") - 8
  const end = scene(ID).frames
  const parts: [number, number, React.FC<{ base: number }>][] = [[r, g1, Runs], [g1, g3, Split], [g3, g4, Accuracy], [g4, g5, FalseAlarms], [g5, g6, Speed], [g6, end, Receipt]]
  return (
    <AbsoluteFill style={{ background: C.canvas }}>
      <Sequence durationInFrames={r}><AbsoluteFill style={{ opacity: ease(frame, r - 10, r, 1, 0) }}><NameCard /></AbsoluteFill></Sequence>
      {parts.map(([from, to, Part]) => (
        <Sequence key={from} from={from} durationInFrames={to - from}>
          <AbsoluteFill style={{ opacity: Math.min(ease(frame, from, from + 10), to === end ? 1 : ease(frame, to - 10, to, 1, 0)) }}><Part base={from} /></AbsoluteFill>
        </Sequence>
      ))}
      <SceneLabel n={7} text="The model" />
      <CornerBug />
      <Captions id={ID} />
    </AbsoluteFill>
  )
}
