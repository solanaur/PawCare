#!/bin/bash

# Run Paw Care as a Desktop App
# This will start the backend and launch the Electron desktop app

cd "$(dirname "$0")"

echo "🐾 Starting Paw Care Desktop App..."
echo ""

# Check if backend is running
if ! curl -s http://localhost:8080 > /dev/null 2>&1; then
    echo "Starting backend server..."
    cd pawcare-backend
    
    if [ -f "target/pawcare-backend-0.0.1-SNAPSHOT.jar" ]; then
        java -jar target/pawcare-backend-0.0.1-SNAPSHOT.jar --spring.profiles.active=h2 > /dev/null 2>&1 &
        BACKEND_PID=$!
    else
        mvn spring-boot:run -Dspring-boot.run.profiles=h2 > /dev/null 2>&1 &
        BACKEND_PID=$!
    fi
    
    echo "Waiting for backend to start..."
    for i in {1..30}; do
        if curl -s http://localhost:8080 > /dev/null 2>&1; then
            echo "✓ Backend is running!"
            break
        fi
        sleep 1
    done
fi

# Start Electron app
echo "Launching desktop app..."
npm start

# Cleanup: kill backend if we started it
if [ ! -z "$BACKEND_PID" ]; then
    trap "kill $BACKEND_PID 2>/dev/null" EXIT
fi
