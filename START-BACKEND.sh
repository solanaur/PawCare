#!/bin/bash

# Start the backend server for Paw Care
# This ensures your data persists in the database

cd "$(dirname "$0")/pawcare-backend"

echo "🐾 Starting Paw Care Backend Server..."
echo ""
echo "This will start the backend on http://localhost:8080"
echo "Your data will be saved in: pawcare-backend/data/pawcare_db.mv.db"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Check if JAR exists
if [ -f "target/pawcare-backend-0.0.1-SNAPSHOT.jar" ]; then
    echo "Starting with JAR file..."
    java -jar target/pawcare-backend-0.0.1-SNAPSHOT.jar --spring.profiles.active=h2
else
    echo "Starting with Maven..."
    mvn spring-boot:run -Dspring-boot.run.profiles=h2
fi

