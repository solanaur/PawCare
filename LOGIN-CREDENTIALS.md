# Login Credentials

Here are all the available user accounts:

## 🔐 User Accounts

### 1. Administrator
- **Username:** `admin`
- **Password:** `admin123`
- **Role:** Admin
- **Access:** Full access to all features (dashboard, pets, appointments, prescriptions, reports, user management)

### 2. Veterinarian
- **Username:** `drcruz`
- **Password:** `vet12345`
- **Role:** Vet
- **Access:** Dashboard, pet records, appointments, prescriptions, reports

### 3. Receptionist
- **Username:** `daisy`
- **Password:** `frontdesk123`
- **Role:** Receptionist
- **Access:** Dashboard, pet records, appointments

### 4. Pharmacist
- **Username:** `paul`
- **Password:** `pharma123`
- **Role:** Pharmacist
- **Access:** Prescriptions only

## 📝 Notes

- **No need to select a role** - the system automatically detects your role from the backend
- All passwords are case-sensitive
- These accounts are created automatically when the database is initialized
- Data persists in: `pawcare-backend/data/pawcare_db.mv.db`

## 🔄 Reset Users

If you need to reset users, restart the backend and the `DataInitializer` will recreate them if the database is empty.

