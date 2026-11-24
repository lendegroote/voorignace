#!/usr/bin/env python3
"""Print the page boxes, page count and PDF/X version of print PDFs.

Usage: check_pdf.py <file.pdf> [more.pdf ...]

Uses `pdfinfo` (poppler) for the boxes when it is installed, otherwise reads
them from the file directly. Sizes are in millimetres, first page.
"""
import re
import shutil
import subprocess
import sys

PT_MM = 25.4 / 72


def boxes_pdfinfo(path):
    out = subprocess.run(["pdfinfo", "-box", path], capture_output=True, text=True).stdout
    res, pages = {}, None
    for line in out.splitlines():
        m = re.match(r"(MediaBox|TrimBox|BleedBox):\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)", line)
        if m:
            x0, y0, x1, y1 = map(float, m.groups()[1:])
            res[m.group(1)] = (x1 - x0, y1 - y0)
        m = re.match(r"Pages:\s+(\d+)", line)
        if m:
            pages = int(m.group(1))
    return res, pages


def boxes_raw(data):
    res = {}
    for key in ("MediaBox", "TrimBox", "BleedBox"):
        m = re.search(rb"/%s\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]" % key.encode(), data)
        if m:
            x0, y0, x1, y1 = map(float, m.groups())
            res[key] = (x1 - x0, y1 - y0)
    pages = len(re.findall(rb"/Type\s*/Page[^s]", data)) or None
    return res, pages


def pdfx_version(data):
    m = re.search(rb"/GTS_PDFXVersion\s*\(([^)]*)\)", data) or re.search(rb"GTS_PDFXVersion>([^<]*)<", data) \
        or re.search(rb'GTS_PDFXVersion="([^"]*)"', data)
    return m.group(1).decode("latin-1") if m else "none"


def fmt(wh):
    return f"{wh[0] * PT_MM:.1f} x {wh[1] * PT_MM:.1f} mm"


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__.strip())
        return 1
    rc = 0
    for path in sys.argv[1:]:
        try:
            data = open(path, "rb").read()
        except OSError as e:
            print(f"{path} | error: {e}")
            rc = 2
            continue
        res, pages = boxes_pdfinfo(path) if shutil.which("pdfinfo") else ({}, None)
        if not res:
            res, pages = boxes_raw(data)
        parts = [f"{k} {fmt(res[k])}" for k in ("TrimBox", "BleedBox", "MediaBox") if k in res]
        marks = "unknown"
        if "MediaBox" in res and "BleedBox" in res:
            mb, bb = res["MediaBox"], res["BleedBox"]
            marks = "yes" if (mb[0] - bb[0] > 1 or mb[1] - bb[1] > 1) else "no"
        print(f"{path.split('/')[-1]} | pages {pages or '?'} | " + ", ".join(parts)
              + f" | PDF/X: {pdfx_version(data)} | marks space: {marks}")
    return rc


if __name__ == "__main__":
    sys.exit(main())
