#!/bin/bash
# Start Karishma.  ./run.sh          -> voice mode
#                  ./run.sh --text   -> keyboard mode
cd "$(dirname "$0")"
source .venv/bin/activate
exec python -m karishma "$@"
