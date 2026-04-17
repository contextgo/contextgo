# Export Modes

The runner produces every artifact through a declared export mode. Mode choice
must be recorded in the build note.

## Supported Export Modes

| Mode            | Output               | Typical Source          | Notes                                                 |
| --------------- | -------------------- | ----------------------- | ----------------------------------------------------- |
| `pptx-static`   | `.pptx`              | brief, report           | static deck without Morph animations                  |
| `pptx-morph`    | `.pptx` + build flow | brief, report           | delegates the deck build to `morph-ppt` (see below)   |
| `pdf-report`    | `.pdf`               | report, structured data | report-style PDF with cover, TOC, sections            |
| `pdf-handout`   | `.pdf`               | brief, infographic plan | one-page or multi-page handout                        |
| `infographic`   | `.png` / `.svg`      | structured data, brief  | static infographic for sharing                        |
| `markdown-spec` | `.md`                | any                     | machine-readable artifact spec for downstream tooling |

## Mode Selection Rules

1. honor an explicit user request for a mode
2. otherwise select the simplest mode that satisfies the artifact type
3. only choose `pptx-morph` when narrative motion adds explanatory value
4. always emit `markdown-spec` alongside the primary export so the build is
   reproducible from a versionable source

## Build Outputs

Every export produces, at minimum:

- the primary artifact file
- `build-notes.md` summarizing inputs, recipe, theme, mode, and key decisions
- `assets.json` listing every embedded image, chart, and font
- `failures.json` listing any pages, slides, or panels that failed QC and why

## Reproducibility

Build outputs must let a later run recreate the artifact from the same input.
That means:

- recording the exact recipe id and version
- recording the exact theme id or inline theme spec
- recording the resolved input shape and any normalization decisions
- pinning third-party tooling versions when they materially change output

## Handoff to `morph-ppt`

When `pptx-morph` is selected, the runner:

- prepares the normalized input and recipe
- hands off to the `morph-ppt` skill for animation planning and PPTX build
- consumes the resulting build note as part of its own QC pass
- does not attempt to manage Morph animation state itself

See `morph-integration.md` for the boundary contract.
