import { Composition } from "remotion"
import { SCENES, Video, totalFrames } from "./Video"
import { SCENE_NUMBERS, sceneFrames } from "./timing"
import { FPS, H, W } from "./theme"

export const Root = () => (
  <>
    <Composition id="Ideas" component={Video} durationInFrames={totalFrames()} fps={FPS} width={W} height={H} />
    {/* One composition per scene, for previews in Remotion Studio. */}
    {SCENE_NUMBERS.filter((n) => SCENES[n]).map((n) => (
      <Composition key={n} id={`Scene${n}`} component={SCENES[n]} durationInFrames={sceneFrames(n)} fps={FPS} width={W} height={H} />
    ))}
  </>
)
