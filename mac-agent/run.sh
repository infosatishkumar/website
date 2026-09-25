#!/bin/bash
# Start the agent from Terminal (useful for seeing logs).
cd "$(dirname "$0")"
exec ./.venv/bin/python -m agent.main "$@"
