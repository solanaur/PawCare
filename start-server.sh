#!/bin/bash

# Start a simple HTTP server to avoid CORS issues
# This allows the frontend to work properly with the backend API

PORT=${1:-8000}
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🐾 Starting Paw Care Vet Clinic..."
echo ""
echo "Starting web server on http://localhost:$PORT"
echo "Press Ctrl+C to stop"
echo ""
echo "Open your browser to: http://localhost:$PORT"
echo ""

cd "$DIR"

# Check if Python 3 is available
if command -v python3 &> /dev/null; then
    python3 -m http.server "$PORT"
elif command -v python &> /dev/null; then
    python -m SimpleHTTPServer "$PORT"
else
    echo "Error: Python is not installed. Please install Python 3."
    exit 1
fi

