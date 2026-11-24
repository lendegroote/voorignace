#!/usr/bin/env python3
"""Make a Figma SVG export safe for Adobe Illustrator.

Usage: fix_svg.py <file.svg> [more.svg ...]     (files are rewritten in place)

Figma exports inside-aligned strokes as a path with a doubled stroke width,
masked by the shape itself (<mask id="...-inside-...">). Illustrator drops
these masks, so the strokes disappear or render twice as thick. The mask is
replaced by a clipPath with the same geometry, which Illustrator supports and
which gives the same visual result.

Outside-aligned stroke masks (id contains "-outside-") use an inverted
luminance mask that a clipPath cannot express. They are left alone and
reported, so they can be checked by eye.
"""
import re
import sys


def fix(svg: str):
    inside = re.findall(r'<mask id="([^"]*-inside-[^"]*)"', svg)
    for mid in inside:
        pat = re.compile(r'<mask id="%s"[^>]*>(.*?)</mask>' % re.escape(mid), re.S)
        svg = pat.sub(lambda m: '<clipPath id="%s">%s</clipPath>' % (mid, m.group(1)), svg)
        svg = svg.replace('mask="url(#%s)"' % mid, 'clip-path="url(#%s)"' % mid)
    outside = re.findall(r'<mask id="([^"]*-outside-[^"]*)"', svg)
    return svg, len(inside), len(outside)


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__.strip())
        return 1
    for path in sys.argv[1:]:
        with open(path, encoding="utf-8") as f:
            svg = f.read()
        svg, n_in, n_out = fix(svg)
        with open(path, "w", encoding="utf-8") as f:
            f.write(svg)
        note = f" | {n_out} outside-stroke mask(s) kept, check them in Illustrator" if n_out else ""
        print(f"ok {path} | {n_in} inside-stroke mask(s) converted{note}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
