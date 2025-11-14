# Quick Start Guide - With Backend (Data Persistence)

## Step 1: Start the Backend

**Terminal 1 - Start Backend:**
```bash
cd /Users/sha/PawCare/paw-care-vet-clinic
./START-BACKEND.sh
```

Or manually:
```bash
cd pawcare-backend
mvn spring-boot:run -Dspring-boot.run.profiles=h2
```

Wait for: `Started PawcareApplication` message

## Step 2: Start Web Server

**Terminal 2 - Start Frontend:**
```bash
cd /Users/sha/PawCare/paw-care-vet-clinic
python3 -m http.server 8000
```

## Step 3: Open in Browser

Open: **http://localhost:8000**

## Step 4: Login

- Username: `admin`
- Password: `admin123`

**No need to select a role** - the system will detect it from the backend.

## Your Data

All data is saved in: `pawcare-backend/data/pawcare_db.mv.db`

This file persists between restarts, so your pets, appointments, and prescriptions are saved!

## Troubleshooting

### Backend won't start?
- Check Java 17 is installed: `java -version`
- Check Maven is installed: `mvn -version`
- Check port 8080 is free: `lsof -i :8080`

### Can't login?
- Make sure backend is running (check Terminal 1)
- Open browser console (F12) to see error messages
- Try the test page: http://localhost:8000/test-login.html

### Pages not loading?
- Make sure you're using http://localhost:8000 (NOT file://)
- Check browser console for errors

## All Set!

Your system is now running with full data persistence. Everything you create will be saved to the database.

