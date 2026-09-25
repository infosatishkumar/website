#!/bin/bash
# Checks voice, microphone and speech recognition. Send a screenshot of the output if something fails.
cd "$(dirname "$0")"
exec ./.venv/bin/python -m agent.mictest
