#!/bin/bash
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install it from https://nodejs.org/ and run this again."
  read -r -p "Press Return to close..." _
  exit 1
fi
node server.js &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null' EXIT
sleep 1
if kill -0 "$server_pid" 2>/dev/null; then
  open 'http://127.0.0.1:4173'
  wait "$server_pid"
else
  echo "Could not launch the dashboard. Check the error above."
  read -r -p "Press Return to close..." _
fi
