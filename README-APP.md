# Paw Care Desktop App

This is the Electron desktop application wrapper for Paw Care Veterinary Clinic.

## Quick Start

### Install Dependencies

```bash
cd /Users/sha/PawCare/paw-care-vet-clinic
npm install
```

### Run the App

```bash
npm start
```

This will:
1. Check if the backend is running on port 8080
2. Try to start the backend automatically if not running
3. Open the desktop application window

## Building the App

### Build for macOS

```bash
npm run build:mac
```

The app will be in the `dist` folder.

### Build for Windows

```bash
npm run build:win
```

### Build for Linux

```bash
npm run build:linux
```

## Requirements

- **Node.js** and **npm** (for running Electron)
- **Java 17** and **Maven** (for backend)
- Backend should be running or the app will try to start it automatically

## Manual Backend Start

If the app can't start the backend automatically, start it manually:

```bash
cd pawcare-backend
mvn spring-boot:run -Dspring-boot.run.profiles=h2
```

Then run the app with `npm start`.

## Notes

- The app connects to `http://localhost:8080` for the backend API
- The backend must be running for the app to work properly
- Data is stored in `pawcare-backend/data/pawcare_db.mv.db`

