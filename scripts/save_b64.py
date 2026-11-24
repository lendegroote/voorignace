#!/usr/bin/env python3
"""Decode the longest base64 run in a file (or stdin) and write it as a binary file.

Usage: save_b64.py <input file | -> <output file>

Used to turn a Figma `exportAsync` result (returned as base64 by the MCP tool,
sometimes saved to a file by the client) into an SVG or PDF file.
"""
import base64
import os
import re
import sys


def detect(data: bytes) -> str:
    head = data[:512].lstrip()
    if head.startswith(b"%PDF"):
        return "PDF"
    if head.startswith(b"\x89PNG"):
        return "PNG"
    if head.startswith(b"<svg") or (head.startswith(b"<?xml") and b"<svg" in data[:2048]):
        return "SVG"
    if head[:3] == b"\xff\xd8\xff":
        return "JPG"
    return "unknown"


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__.strip())
        return 1
    src, dst = sys.argv[1], sys.argv[2]
    text = sys.stdin.read() if src == "-" else open(src, encoding="utf-8", errors="ignore").read()
    runs = re.findall(r"[A-Za-z0-9+/]{200,}={0,2}", text)
    if not runs:
        print("error: no base64 data found in input")
        return 2
    b64 = max(runs, key=len)
    b64 += "=" * (-len(b64) % 4)
    data = base64.b64decode(b64)
    os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True)
    with open(dst, "wb") as f:
        f.write(data)
    print(f"ok {dst} | {len(data) / 1024:.1f} KB | type {detect(data)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
