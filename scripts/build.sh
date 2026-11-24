#!/bin/bash
# Build an Adobe print file (Illustrator or InDesign) from Figma exports
# and export a checked print PDF. Options: see SKILL.md step 5, or run with --help.
exec python3 "$(cd "$(dirname "$0")" && pwd)/build.py" "$@"
