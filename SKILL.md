---
name: voorignace
description: Rebuild the current Figma selection as a print-ready Adobe file (Illustrator or InDesign) and export a PDF/X print PDF with size, bleed and crop mark checks. Asks which Adobe application to build in and confirms the PDF standard (PDF/X-1a:2001 by default) before starting. Use when the user invokes /voorignace, or asks to turn a Figma frame or selection into an Illustrator or InDesign file, make a print file or printer PDF from Figma, or "rebuild this in Adobe".
---

# voorignace: Figma selection to Adobe print file

Turns one or more selected Figma frames into a native Adobe working file plus a verified print PDF. The Figma file is only read, never changed. Open Adobe documents of the user are never touched: the scripts create, save and close only their own documents.

Read `README.md` for requirements and installation. Read `references/figma_export.md` before exporting from Figma, and `references/adobe_notes.md` when a build step fails or the output looks wrong.

## Step 1. Read the selection

1. Get the current Figma selection (Figma Console MCP: `figma_get_selection`, or `figma_execute` with the snippet in `references/figma_export.md`).
2. For each selected node record: id, name, type, width and height in px, and the background fill when it is one solid colour.
3. Nothing selected, or the selection is not a frame, component, group or section: stop and ask the user to select the frame(s) to rebuild.
4. Several frames with different sizes: they become separate output files, one per size. Same size: one document with one artboard or page per frame.

## Step 2. Ask before building (one AskUserQuestion call)

Ask these questions together. Put the recommended option first.

1. **Application.** "Which Adobe application should the file be rebuilt in?"
   - Illustrator (Recommended for logos, cards, packaging, signage, any vector artwork)
   - InDesign (multi-page documents, printer templates, layouts with many pages)
2. **PDF standard.** "Export the print PDF as PDF/X-1a:2001?"
   - Yes, PDF/X-1a:2001 (Recommended, the common printer default: CMYK only, transparency flattened, fonts embedded)
   - PDF/X-4:2010 (keeps live transparency, better for gradients and soft shadows if the printer accepts it)
   - No PDF, working file only
3. **Size.** "What is the final printed size?" Offer the size derived from Figma at 1 px = 1 pt (`px * 0.3528 mm`) as the first option, plus common formats that fit the aspect ratio (A4, A5, A3). The user can type any size in mm.
4. **Bleed and crop marks.** "Bleed and crop marks?"
   - 3 mm bleed with crop marks (Recommended for anything trimmed after printing)
   - 3 mm bleed, no marks (some large-format printers and roll-up banners ask for this)
   - No bleed, no marks

Then confirm in one line before building, for example:
`Illustrator, 2 artboards of 85 x 55 mm, 3 mm bleed, crop marks, PDF/X-1a:2001, output to <folder>. Build it?`

Skip a question only when the user already answered it in the request. If the user gives the output folder, use it. Otherwise ask for it once, or default to a new folder `<FrameName> print/` on the Desktop.

## Step 3. Export from Figma

Follow `references/figma_export.md`. Per application:

| Application | Figma export | Why |
|---|---|---|
| Illustrator | SVG, text outlined | Editable vectors in Illustrator |
| InDesign | PDF, one per frame | Vector, gradients and effects keep their exact look when placed |

- Export the frame itself, so its clip and background come along.
- Remove helper layers that must not print (dimension lines, die-cut guides, notes) from a temporary clone, export the clone, delete the clone. Never edit the original frame.
- Save every export into `<output>/Links/` (InDesign) or the scratchpad (Illustrator SVGs).
- Illustrator only: run `scripts/fix_svg.py <file.svg>` on every SVG. Figma writes inside and outside strokes as SVG masks, which Illustrator drops. The script turns those masks into clipping paths with the same geometry.

## Step 4. Bleed

A Figma frame is usually the trim size, so there is no artwork in the bleed area.

- Frame background is one solid colour: pass it with `--bg "#RRGGBB"`. The build places a rectangle in that colour under the artwork, covering the full bleed.
- Frame has an image, gradient or pattern that runs to the edge: tell the user the bleed will be empty (white) and offer two fixes: enlarge the frame in a Figma copy by the bleed (3 mm = 8.5 px at 1 px = 1 pt) and export again with `--src-has-bleed`, or accept white bleed for now.
- Frame already contains the bleed (it is trim size + 2 x bleed): pass `--src-has-bleed`. Width and height stay the trim size.

## Step 5. Build and export

Run the dispatcher. It writes the working file, exports the PDF and prints a check of every PDF:

```bash
<skill>/scripts/build.sh \
  --app illustrator|indesign \
  --src "<export1>" [--src "<export2>" ...] \
  --out "<output folder>" --name "<FileBase>" \
  --width <trim mm> --height <trim mm> \
  [--bleed 3] [--marks yes|no] [--preset "[PDF/X-1a:2001]"|"[PDF/X-4:2010]"|none] \
  [--bg "#RRGGBB"] [--src-has-bleed]
```

Output, in `--out`:
- `<FileBase>.ai` or `<FileBase>.indd`: the working file.
- `<FileBase>.pdf`: the print PDF.
- `Links/`: placed files (InDesign), kept next to the working file.

Builds of large files can take minutes. Run the dispatcher in the background when the selection holds many frames or large images.

## Step 6. Verify, do not trust "ok"

1. Read the check lines printed by the build: `TrimBox` must equal the trim size, `BleedBox` trim + 2 x bleed, `MediaBox` larger than the BleedBox when crop marks are on, and the PDF/X version must match the chosen standard. A PDF/X-1a:2001 file reports `PDF/X-1:2001` in its header. That is correct.
2. Render a preview and look at it next to a Figma screenshot of the same frame:
   ```bash
   sips -s format png -Z 1200 "<FileBase>.pdf" --out "<scratchpad>/preview.png"
   ```
   Check: all elements present, no missing strokes, no helper lines, gradients and images in place, text not reflowed.
3. Fix and rebuild when something differs. Common causes and fixes are in `references/adobe_notes.md`.

## Step 7. Report

Keep the report short and factual:
- Paths of the working file and the PDF.
- Trim size, bleed, crop marks, PDF standard, page or artboard count.
- Points the user must check before sending to print: colours converted from RGB to CMYK (they can look duller, compare against a proof), fonts (outlined, or must be installed or sent along), image resolution under 300 ppi at final size, empty bleed.
- Remind the user to open the PDF and check it before sending it to the printer.

## Rules

- Figma is read-only. Export from clones when something must be removed, and delete the clone afterwards.
- Never use `activeDocument` in Adobe scripts and never close documents the scripts did not create. Users often have unsaved work open.
- Never overwrite an existing working file. The dispatcher refuses when `<FileBase>.ai` or `.indd` already exists in the output folder; ask the user for a new name or a version suffix (`_v2`).
- Do not guess a print size. Ask, or use the confirmed answer.
- Do not invent printer specifications. When the printer delivered a template or a spec sheet, follow it and tell the user where it differs from the defaults above.
