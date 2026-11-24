# voorignace

A Claude Code skill that rebuilds a Figma selection as a print-ready Adobe Illustrator or InDesign file and exports a verified PDF/X print PDF.

## What it does

1. Reads the frames selected in Figma (read-only, the Figma file is never changed).
2. Asks which application to build in (Illustrator or InDesign), confirms the PDF standard (PDF/X-1a:2001 by default), the final print size and the bleed and crop mark settings.
3. Exports the frames from Figma: SVG for Illustrator, PDF for InDesign.
4. Builds a CMYK working file in millimetres, one artboard or page per frame, with document bleed.
5. Exports the print PDF and checks the trim, bleed and media boxes and the PDF/X version.
6. Reports the files and the points to check before sending to print.

| | Illustrator | InDesign |
|---|---|---|
| Best for | Logos, cards, packaging, signage, vector artwork | Multi-page documents, layouts, printer templates |
| Figma export | SVG, text outlined | PDF per frame |
| Artwork in the file | Editable vectors | Linked vector PDFs in `Links/` (exact Figma look) |
| Working file | `.ai` | `.indd` + `Links/` |

## Requirements

- macOS (the scripts drive the Adobe applications through AppleScript).
- Adobe Illustrator and/or Adobe InDesign, 2024 or later. Tested with the 2026 and 2027 releases.
- Python 3.9 or later.
- Claude Code with a Figma connection that can run plugin code in the open file. Recommended: the Figma Console MCP with the Desktop Bridge plugin running in Figma Desktop.
- Optional: poppler (`brew install poppler`) for more reliable PDF box checks and previews.
- The first run asks macOS for permission to let the terminal control Illustrator or InDesign. Allow it in System Settings > Privacy & Security > Automation.

## Installation

Copy or clone the `voorignace` folder into your Claude Code skills folder:

```bash
cp -R voorignace ~/.claude/skills/voorignace
chmod +x ~/.claude/skills/voorignace/scripts/*.sh ~/.claude/skills/voorignace/scripts/*.py
```

Restart Claude Code. The skill is then available as `/voorignace`.

## Usage

Select one or more frames in Figma, then in Claude Code:

```
/voorignace
```

or describe the task, for example "rebuild the selected business card in Illustrator for print". Claude asks the open questions before it builds anything.

### Running the build script directly

The build script can also be used without Claude, with exports you made yourself:

```bash
scripts/build.sh --app illustrator \
  --src front.svg --src back.svg \
  --out "~/Desktop/Business card print" --name BusinessCard \
  --width 85 --height 55 --bleed 3 --marks yes \
  --preset "[PDF/X-1a:2001]" --bg "#46085F" --labels "Front,Back"
```

| Option | Default | Meaning |
|---|---|---|
| `--app` | required | `illustrator` or `indesign` |
| `--src` | required | Exported file (SVG or PDF for Illustrator, PDF for InDesign). Repeat for more artboards or pages. |
| `--out` | required | Output folder, created when missing |
| `--name` | required | File base name without extension |
| `--width`, `--height` | required | Trim size in mm |
| `--bleed` | `3` | Bleed in mm, `0` for none |
| `--marks` | `yes` | Crop marks in the PDF (`yes` or `no`) |
| `--preset` | `[PDF/X-1a:2001]` | Adobe PDF preset name as shown in the application, or `none` for no PDF |
| `--bg` | none | Background colour `#RRGGBB`, drawn under the artwork across the full bleed |
| `--src-has-bleed` | off | The exports already include the bleed area |
| `--labels` | file names | Comma separated artboard or page names |

Existing working files and PDFs are never overwritten: use a new `--name` (for example with `_v2`).

## Files

```
voorignace/
  SKILL.md                   Instructions Claude follows
  README.md                  This file
  references/
    figma_export.md          Reading the selection and exporting from Figma
    adobe_notes.md           Known issues and fixes per application
  scripts/
    build.sh / build.py      Dispatcher: prepares sources, runs the build, checks the PDF
    build_illustrator.jsx    Illustrator build and PDF export
    build_indesign.jsx       InDesign build and PDF export
    fix_svg.py               Converts Figma inside-stroke masks to clipping paths
    save_b64.py              Saves a base64 Figma export as a file
    check_pdf.py             Prints page boxes and PDF/X version of a PDF
```

## Safety

- Figma is only read. Helper layers are removed from temporary clones, which are deleted after export.
- The Adobe scripts only work on documents they create themselves and never use the active document. Open documents and unsaved work are left alone.
- Existing files are never overwritten.

## Limitations

- Colours are exported from Figma as RGB and converted to CMYK. Brand colours with defined CMYK values should be checked and corrected in the working file.
- Illustrator: text is outlined by default. Live text needs the same fonts installed and can wrap slightly differently.
- InDesign: artwork is placed as linked PDFs, not rebuilt as native InDesign objects. This keeps the look exact; edit the design in Figma and run the skill again.
- Illustrator stores bleed in whole points, so 3 mm becomes 3.17 mm.
- PDF pages cannot exceed 5080 mm per side. For larger formats, build at a scale agreed with the printer.

## Troubleshooting

See `references/adobe_notes.md`.
