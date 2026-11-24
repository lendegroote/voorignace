#!/usr/bin/env python3
"""Build an Adobe print file from Figma exports and export a checked print PDF.

Run through build.sh. See SKILL.md (step 5) and README.md for the options.
"""
import argparse
import filecmp
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
EXT = {"illustrator": ".ai", "indesign": ".indd"}
APP = {
    "illustrator": os.environ.get("VOORIGNACE_ILLUSTRATOR", ""),
    "indesign": os.environ.get("VOORIGNACE_INDESIGN", ""),
}
BUNDLE = {"illustrator": "com.adobe.illustrator", "indesign": "com.adobe.InDesign"}


def fail(msg: str) -> None:
    print(f"error: {msg}")
    sys.exit(2)


def app_ref(app: str) -> str:
    name = APP[app]
    return f'application "{name}"' if name else f'application id "{BUNDLE[app]}"'


def run_adobe(app: str, cfg: dict, tmp: str) -> list:
    """Write the config + loader script, run it in the app, return the log lines."""
    script = os.path.join(HERE, f"build_{app}.jsx")
    cfg = dict(cfg, log=os.path.join(tmp, f"log_{app}_{int(time.time() * 1000)}.txt"))
    loader = os.path.join(tmp, f"run_{app}.jsx")
    with open(loader, "w", encoding="ascii") as f:
        f.write("var CFG = " + json.dumps(cfg, ensure_ascii=True) + ";\n")
        f.write("$.evalFile(new File(" + json.dumps(script, ensure_ascii=True) + "));\n")
    if app == "indesign":
        call = f'do script (POSIX file {json.dumps(loader)}) language javascript'
    else:
        call = f'do javascript file (POSIX file {json.dumps(loader)})'
    osa = f"with timeout of 1800 seconds\ntell {app_ref(app)}\n{call}\nend tell\nend timeout"
    proc = subprocess.run(["osascript", "-e", osa], capture_output=True, text=True)
    lines = []
    if os.path.exists(cfg["log"]):
        with open(cfg["log"], encoding="utf-8", errors="replace") as f:
            lines = [l for l in f.read().splitlines() if l.strip()]
    if proc.returncode != 0:
        lines.append("error: osascript: " + proc.stderr.strip())
    if not lines:
        lines.append("error: no log written, the script did not run to the end")
    return lines


def main() -> int:
    p = argparse.ArgumentParser(description="Figma export to Adobe print file + PDF")
    p.add_argument("--app", required=True, choices=list(EXT))
    p.add_argument("--src", required=True, action="append", help="exported file, repeat for more pages")
    p.add_argument("--out", required=True, help="output folder")
    p.add_argument("--name", required=True, help="file base name, no extension")
    p.add_argument("--width", required=True, type=float, help="trim width in mm")
    p.add_argument("--height", required=True, type=float, help="trim height in mm")
    p.add_argument("--bleed", type=float, default=3.0, help="bleed in mm (default 3)")
    p.add_argument("--marks", choices=["yes", "no"], default="yes", help="crop marks (default yes)")
    p.add_argument("--preset", default="[PDF/X-1a:2001]", help='Adobe PDF preset name, or "none"')
    p.add_argument("--bg", default="", help="background colour #RRGGBB, fills the bleed")
    p.add_argument("--src-has-bleed", action="store_true", help="exports already include the bleed")
    p.add_argument("--labels", default="", help="comma separated artboard/page names")
    a = p.parse_args()

    srcs = [os.path.abspath(s) for s in a.src]
    for s in srcs:
        if not os.path.isfile(s):
            fail(f"source not found: {s}")
    if a.bg and not (len(a.bg) == 7 and a.bg.startswith("#")):
        fail("--bg must look like #RRGGBB")
    if a.width <= 0 or a.height <= 0 or a.bleed < 0:
        fail("width and height must be positive, bleed zero or more")

    out = os.path.abspath(a.out)
    os.makedirs(out, exist_ok=True)
    work = os.path.join(out, a.name + EXT[a.app])
    if os.path.exists(work):
        fail(f"{work} already exists. Pick another --name (for example add _v2).")
    pdf = os.path.join(out, a.name + ".pdf")
    if os.path.exists(pdf) and a.preset.lower() != "none":
        fail(f"{pdf} already exists. Pick another --name (for example add _v2).")

    tmp = tempfile.mkdtemp(prefix="voorignace_")
    try:
        # Prepare sources
        if a.app == "illustrator":
            ready = []
            for i, s in enumerate(srcs):
                d = os.path.join(tmp, f"src_{i + 1:02d}{os.path.splitext(s)[1].lower()}")
                shutil.copyfile(s, d)
                if d.endswith(".svg"):
                    sys.stdout.flush()
                    subprocess.run([sys.executable, os.path.join(HERE, "fix_svg.py"), d], check=True)
                ready.append(d)
        else:
            links = os.path.join(out, "Links")
            os.makedirs(links, exist_ok=True)
            ready = []
            for s in srcs:
                d = os.path.join(links, os.path.basename(s))
                if os.path.abspath(s) != os.path.abspath(d):
                    # Reuse an identical file already in Links/, otherwise pick a free numbered name.
                    stem, ext = os.path.splitext(d)
                    n = 2
                    while os.path.exists(d) and not filecmp.cmp(s, d, shallow=False):
                        d = f"{stem}_{n}{ext}"
                        n += 1
                    if not os.path.exists(d):
                        shutil.copyfile(s, d)
                ready.append(d)

        labels = [l.strip() for l in a.labels.split(",")] if a.labels else []
        labels += [os.path.splitext(os.path.basename(s))[0] for s in srcs[len(labels):]]
        marks = a.marks == "yes"
        preset = "none" if a.preset.lower() == "none" else a.preset

        cfg = {
            "src": ready, "labels": labels, "out": out, "name": a.name,
            "work": work, "pdf": "" if preset == "none" else pdf,
            "width": a.width, "height": a.height, "bleed": a.bleed, "marks": marks,
            "preset": preset, "bg": a.bg, "srcHasBleed": a.src_has_bleed,
        }
        log = run_adobe(a.app, cfg, tmp)

        for l in log:
            print(l, flush=True)
        if any(l.startswith("error") for l in log):
            return 3
        if os.path.exists(pdf):
            print("check:", flush=True)
            subprocess.run([sys.executable, os.path.join(HERE, "check_pdf.py"), pdf])
        return 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
