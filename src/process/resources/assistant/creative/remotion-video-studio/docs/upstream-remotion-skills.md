# Upstream Remotion Skills

The package vendors the complete official Remotion skill tree from the upstream repository.

- Upstream repo: `https://github.com/remotion-dev/skills`
- Upstream commit: `f34abef3e80ca73b3a5337f17e9c7a7ddcf418ea`
- Upstream package: `@remotion/skills`
- Upstream package version observed during research: `4.0.457`
- Upstream root copied: `skills/remotion/`
- Upstream main skill name: `remotion-best-practices`

## ContextGo Mapping

The original upstream `skills/remotion/` tree is copied into:

```text
official-skills/skills/remotion/
```

ContextGo limits every directory to at most 10 direct children, while upstream keeps all rule files directly under `rules/`. To preserve the complete source while satisfying the project structure rule, rule files are grouped by topic:

- `rules/core/`: compositions, metadata, parameters, sequencing, timing, transitions, trimming
- `rules/media/`: audio, videos, images, GIFs, Lottie, transparent videos
- `rules/captions/`: subtitles, caption display, transcription, SRT import, voiceover
- `rules/tools/`: FFmpeg, silence detection, duration and dimension probing
- `rules/visual/`: 3D, audio visualization, HTML canvas, effects, Mapbox, measurement, SFX, Tailwind, text animations
- `rules/fonts/`: Google fonts and local fonts
- `rules/assets/`: upstream TSX example assets

Relative markdown links were updated to match the grouped paths. Content is otherwise preserved from the upstream source.

## Inventory

- `skills/remotion/SKILL.md`
- `skills/remotion/rules/3d.md`
- `skills/remotion/rules/audio-visualization.md`
- `skills/remotion/rules/audio.md`
- `skills/remotion/rules/calculate-metadata.md`
- `skills/remotion/rules/compositions.md`
- `skills/remotion/rules/display-captions.md`
- `skills/remotion/rules/ffmpeg.md`
- `skills/remotion/rules/get-audio-duration.md`
- `skills/remotion/rules/get-video-dimensions.md`
- `skills/remotion/rules/get-video-duration.md`
- `skills/remotion/rules/gifs.md`
- `skills/remotion/rules/google-fonts.md`
- `skills/remotion/rules/html-in-canvas.md`
- `skills/remotion/rules/images.md`
- `skills/remotion/rules/import-srt-captions.md`
- `skills/remotion/rules/light-leaks.md`
- `skills/remotion/rules/local-fonts.md`
- `skills/remotion/rules/lottie.md`
- `skills/remotion/rules/mapbox.md`
- `skills/remotion/rules/measuring-dom-nodes.md`
- `skills/remotion/rules/measuring-text.md`
- `skills/remotion/rules/parameters.md`
- `skills/remotion/rules/sequencing.md`
- `skills/remotion/rules/sfx.md`
- `skills/remotion/rules/silence-detection.md`
- `skills/remotion/rules/subtitles.md`
- `skills/remotion/rules/tailwind.md`
- `skills/remotion/rules/text-animations.md`
- `skills/remotion/rules/timing.md`
- `skills/remotion/rules/transcribe-captions.md`
- `skills/remotion/rules/transitions.md`
- `skills/remotion/rules/transparent-videos.md`
- `skills/remotion/rules/trimming.md`
- `skills/remotion/rules/videos.md`
- `skills/remotion/rules/voiceover.md`
- `skills/remotion/rules/assets/charts-bar-chart.tsx`
- `skills/remotion/rules/assets/text-animations-typewriter.tsx`
- `skills/remotion/rules/assets/text-animations-word-highlight.tsx`
