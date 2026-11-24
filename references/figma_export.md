# Exporting from Figma

The skill works with any Figma MCP connection that can run plugin code in the open file. The examples use the Figma Console MCP (`figma_execute`, Desktop Bridge plugin running in Figma Desktop).

## 1. Read the selection

```js
const sel = figma.currentPage.selection;
return sel.map(n => {
  const solid = ('fills' in n && Array.isArray(n.fills))
    ? n.fills.filter(f => f.visible !== false && f.type === 'SOLID') : [];
  const bg = solid.length === 1 && n.fills.length === 1
    ? '#' + ['r','g','b'].map(k => Math.round(solid[0].color[k] * 255).toString(16).padStart(2, '0')).join('')
    : null;
  return { id: n.id, name: n.name, type: n.type, w: n.width, h: n.height, bg };
});
```

`bg` is filled only when the frame has exactly one visible solid fill. Use it for `--bg`.

## 2. Export one node

Export one node per call. Return the file as base64.

**SVG (Illustrator)**

```js
const n = await figma.getNodeByIdAsync('NODE_ID');
const bytes = await n.exportAsync({ format: 'SVG', svgOutlineText: true, svgIdAttribute: false });
return figma.base64Encode(bytes);
```

`svgOutlineText: true` converts text to vector outlines. The result prints exactly as designed and needs no fonts, but the text is no longer editable. When the user needs live, editable text, export with `svgOutlineText: false`, make sure the same fonts are installed on the computer, and expect small differences in line breaks (Adobe applications set text slightly wider than Figma).

**PDF (InDesign)**

```js
const n = await figma.getNodeByIdAsync('NODE_ID');
const bytes = await n.exportAsync({ format: 'PDF' });
return figma.base64Encode(bytes);
```

## 3. Save the base64 as a file

A large result is often written to a file by the MCP client instead of being shown inline. Either way, save it with:

```bash
python3 <skill>/scripts/save_b64.py "<tool result file or ->" "<output file>"
```

The script takes the longest base64 run from the input (a file, or stdin with `-`), decodes it and writes the output file. It prints the size and the file type it detected (SVG or PDF). Check that the type matches what was requested.

## 4. Removing helper layers

Dimension lines, die-cut lines, notes or presentation overlays inside a frame must not end up in the print file. Do not edit the original:

```js
const src = await figma.getNodeByIdAsync('NODE_ID');
const clone = src.clone();
clone.x = src.x; clone.y = src.y + src.height + 200;   // out of the way
clone.findAll(n => /^(dimension|diecut|die-cut|note|guide)/i.test(n.name)).forEach(n => n.remove());
const bytes = await clone.exportAsync({ format: 'PDF' });
clone.remove();
return figma.base64Encode(bytes);
```

Adjust the name pattern to the file. Confirm with the user which layers are helpers when it is not obvious from their names.

## 5. Things to know

- `exportAsync` respects the frame clip. Content outside the frame is cut off, which is what a print file needs.
- Effects (drop shadows, blurs) export as raster in SVG and PDF. Check their resolution in the final PDF.
- Figma exports colour as RGB. The Adobe document is CMYK, so colours are converted. Bright blues, greens and purples change the most.
- Variables and styles are exported as their resolved values.
