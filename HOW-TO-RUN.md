# How to Run Paw Care

You have **3 options** to run the application:

## Option 1: Desktop App (Recommended) 🖥️

**This creates a standalone desktop application!**

```bash
cd /Users/sha/PawCare/paw-care-vet-clinic
./RUN-APP.sh
```

Or manually:
```bash
# Terminal 1: Start backend
cd pawcare-backend
mvn spring-boot:run -Dspring-boot.run.profiles=h2

# Terminal 2: Start desktop app
cd ..
npm start
```

This opens a **native desktop window** (not a browser)!

## Option 2: Web Browser 🌐

```bash
# Terminal 1: Start backend
cd pawcare-backend
mvn spring-boot:run -Dspring-boot.run.profiles=h2

# Terminal 2: Start web server
cd ..
python3 -m http.server 8000
```

Then open: **http://localhost:8000** in your browser

## Option 3: Build Standalone App 📦

Build a standalone app you can install:

```bash
cd /Users/sha/PawCare/paw-care-vet-clinic
npm run build:mac
```

The app will be in the `dist` folder - drag it to Applications!

## Which Should I Use?

- **Desktop App (Option 1)**: Best experience, looks like a native app
- **Web Browser (Option 2)**: Quick to test, works anywhere
- **Build Standalone (Option 3)**: Create an installable app for distribution

## Login Credentials

- Username: `admin`
- Password: `admin123`

## Your Data

All data is saved in: `pawcare-backend/data/pawcare_db.mv.db`

This persists between restarts!

