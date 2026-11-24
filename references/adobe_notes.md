# Adobe notes and troubleshooting

Lessons from production use of this pipeline. Read when a build fails or the output does not match Figma.

## General

- Scripts are sent with `osascript` and run as ExtendScript inside the application. The dispatcher writes a small config file and loads the build script from it, so paths with spaces and non-ASCII characters are safe.
- Every script keeps a reference to the document it created. Never use `activeDocument`: a user with several open documents can have the script land in the wrong one.
- Long runs: the dispatcher uses an AppleScript timeout of 1800 seconds. When Adobe shows a modal dialog (missing fonts, profile mismatch), the script waits. The scripts switch alerts off where the application allows it.
- Two versions of an application installed side by side: set `VOORIGNACE_ILLUSTRATOR` or `VOORIGNACE_INDESIGN` to the exact application name, for example `export VOORIGNACE_INDESIGN="Adobe InDesign 2026"`.
- Network or cloud-synced folders can disappear for a moment during sync, which gives "operation was cancelled" errors on save. The dispatcher creates the output folder right before building. Build locally and move the result when this repeats.

## Illustrator

- Strokes missing after import: Figma writes inside and outside strokes as `<mask>` elements, Illustrator drops them. Run `scripts/fix_svg.py` on the SVG (the dispatcher also does this automatically). Other masks (gradient or alpha masks) are kept, Illustrator renders those as opacity masks.
- Size is set from the SVG's own artboard, not from the group bounds. A clipped group can report bounds larger than its visible area, so bounds-based scaling places the artwork wrong.
- Bleed is a document setting (File > Document Setup), the artboard stays the trim size. Illustrator scripting stores bleed in whole points: 3 mm is written as 9 pt (3.17 mm). Printers accept this.
- Units in the Transform panel are an application preference (Illustrator > Settings > Units). Scripts cannot change them reliably. The artboard size is exact regardless.
- Colours look duller after export: the SVG is RGB and the document CMYK. Check critical brand colours and set their CMYK values by hand when the printer or brand guide specifies them.

## InDesign

- Figma artwork is placed as linked PDF files (in `Links/`). This keeps gradients, blend modes and effects exactly as in Figma. Pasting Figma vectors natively into InDesign loses radial and masked gradients.
- Keep `Links/` next to the `.indd`. Moving the `.indd` alone breaks the links.
- Placed PDFs can look empty on screen with GPU preview on. That is a display issue only. Use View > Display Performance > High Quality, or check the exported PDF.
- Very large pages: a PDF page cannot exceed 5080 mm (200 inch) on either side, including bleed and marks. Build at 1:10 and tell the printer the scale, or ask the printer how they want it.
- Units: the scripts set measurement to millimetres for their own run only and restore the previous setting.
- PDF/X-1a flattens transparency. When gradients show visible bands or stripes after export, try PDF/X-4:2010 if the printer accepts it.

## PDF check

`scripts/check_pdf.py` reads the first page of each PDF:

- `MediaBox`, `TrimBox`, `BleedBox` in mm.
- PDF/X version. PDF/X-1a:2001 files report `PDF/X-1:2001` in the header field, which is correct.
- `marks space` is `yes` when the MediaBox is larger than the BleedBox, which means room was made for crop marks.

The check does not replace opening the PDF. Always look at a rendered preview.
