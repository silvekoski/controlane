import type { ReactNode } from "react"
import { IDEAS } from "./data/ideas"
import { AssumptionsSlide, QuestionsSlide, SourcesSlide, VoteSlide } from "./slides/ask"
import { BundlesSlide, MatrixSlide, RecommendSlide, ScatterSlide } from "./slides/choice"
import { CheckIn, Carpool, DataStick, GpsStop, JudgeLoop, Scooters, Strike, VoiceDesk } from "./slides/ideas"
import { HeardSlide, MapSlide, PatternSlide, RulesSlide, TitleSlide } from "./slides/intro"

type P = { index: number; section: string }
type Entry = { section: string; render: (p: P) => ReactNode }

const A = "Intro", B = "The ideas", Cc = "The choice", D = "The ask"
const SLIDES: Entry[] = [
  { section: A, render: () => <TitleSlide /> },
  { section: B, render: (p) => <MapSlide {...p} /> },
  { section: B, render: (p) => <Carpool {...p} /> },
  { section: B, render: (p) => <Strike {...p} /> },
  { section: B, render: (p) => <Scooters {...p} /> },
  { section: B, render: (p) => <GpsStop {...p} /> },
  { section: B, render: (p) => <CheckIn {...p} /> },
  { section: B, render: (p) => <DataStick {...p} /> },
  { section: B, render: (p) => <VoiceDesk {...p} /> },
  { section: B, render: (p) => <JudgeLoop {...p} /> },
]

export const Deck = () => {
  const print = new URLSearchParams(location.search).has("print")
  void IDEAS
  return (
    <div className={`deck ${print ? "print" : "screen"}`}>
      {SLIDES.map((s, i) => <div key={i} className="slide-wrap">{s.render({ index: i + 1, section: s.section })}</div>)}
    </div>
  )
}
