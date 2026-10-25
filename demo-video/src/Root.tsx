import React from "react"
import { Composition } from "remotion"
import { SCENE_COMPONENTS, Video } from "./Video"
import { FPS, H, W } from "./lib/tokens"
import { SCENES, TOTAL_FRAMES } from "./lib/timing"
import { Thumbnail } from "./Thumbnail"

// Scene lengths come from the voiceover durations in src/lib/vo-timing.json (measured with ffprobe when the audio is made).
export const Root: React.FC = () => (
  <>
    <Composition id="ControlaneDemo" component={Video} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} />
    <Composition id="Thumbnail" component={Thumbnail} durationInFrames={1} fps={FPS} width={1280} height={720} />
    {/* One composition per scene, for previews in Remotion Studio. */}
    {SCENES.map((s) => (
      <Composition key={s.id} id={`Scene-${s.id}`} component={SCENE_COMPONENTS[s.id]} durationInFrames={s.frames} fps={FPS} width={W} height={H} />
    ))}
  </>
)
