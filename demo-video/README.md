# Controlane demo video

The pitch video for Controlane. Remotion draws it, and ElevenLabs makes the voice, the sound effects and the music. The output is `out/controlane-demo.mp4`: 1920 x 1080, 30 fps, H.264, AAC 48 kHz, -14 LUFS.

## Make it again

```sh
npm ci
cp .env.example .env        # the key needs Text to Speech, Sound Effects and Music
npm run capture             # screens from the app on :3000 and the engine on :3100 (read only)
npm run audio -- vo         # or: sfx, music. Add an id to make one file, e.g. vo 04-decision-card
npm run render              # renders, then masters the audio
npm run studio              # preview, one composition per scene
```

## Where things are

- `scripts/vo.json`: the voiceover. `say` holds the phonetic text for ElevenLabs, `show` holds the caption text. The `|` breaks must line up.
- `src/lib/metrics.ts`: every number on screen, with its source.
- `src/lib/timing.ts`: each scene lasts as long as its voiceover. `cue(id, word)` gives the frame of a spoken word.
- `src/scenes/S1.tsx` to `S9.tsx`: one file per scene.
- `public/ui`: the captures. The `06-*.jpg` stop-check captures come from `../screenshots/stop-check`, made in time travel to 21 Oct 09:47 UTC.
