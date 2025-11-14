# How to Run Paw Care as a Desktop App

You have two options:

## Option 1: Simple Launcher (No Installation Needed) ⭐ Recommended

Just double-click `run-app.sh` or run:

```bash
cd /Users/sha/PawCare/paw-care-vet-clinic
./run-app.sh
```

This will:
- Start the backend automatically if needed
- Open the app in a dedicated browser window
- Work immediately without any installation

## Option 2: Electron Desktop App (Full Desktop Experience)

### Step 1: Install Node.js

**On macOS (using Homebrew):**
```bash
brew install node
```

**Or download from:**
https://nodejs.org/

### Step 2: Install Dependencies

```bash
cd /Users/sha/PawCare/paw-care-vet-clinic
npm install
```

### Step 3: Run the App

```bash
npm start
```

### Step 4: Build Desktop App (Optional)

Build a standalone app:

**For macOS:**
```bash
npm run build:mac
```

The app will be in the `dist` folder - you can drag it to Applications!

**For Windows:**
```bash
npm run build:win
```

**For Linux:**
```bash
npm run build:linux
```

## Which Option Should I Use?

- **Use Option 1** if you want to run it quickly without installing anything
- **Use Option 2** if you want a true desktop app that looks like a native application

Both options work the same - they just provide different user experiences!

