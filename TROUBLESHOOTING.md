# Troubleshooting Login Issues

## Quick Fix Steps

### 1. **Use a Web Server (REQUIRED)**

**DO NOT open `index.html` directly from file system!**

Browsers block CORS requests from `file://` protocol. You MUST use a web server:

```bash
cd /Users/sha/PawCare/paw-care-vet-clinic
python3 -m http.server 8000
```

Then open: **http://localhost:8000** (NOT file://)

### 2. **Test the Backend**

Open the test page: **http://localhost:8000/test-login.html**

Click "Test Backend Connection" and "Test Login" buttons to see what's happening.

### 3. **Check Browser Console**

1. Open browser DevTools (F12 or Cmd+Option+I)
2. Go to Console tab
3. Try logging in
4. Look for errors - they will show exactly what's wrong

### 4. **Verify Backend is Running**

```bash
curl http://localhost:8080/api/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Should return a JSON with `token` and `user` fields.

## Common Issues

### Issue: "Cannot connect to backend"
**Solution:** Start the backend:
```bash
cd pawcare-backend
mvn spring-boot:run -Dspring-boot.run.profiles=h2
```

### Issue: CORS errors in console
**Solution:** Use a web server (see step 1 above), NOT file://

### Issue: "Invalid username or password"
**Solution:** Use these credentials:
- Username: `admin`, Password: `admin123`
- Username: `drcruz`, Password: `vet12345`
- Username: `daisy`, Password: `frontdesk123`
- Username: `paul`, Password: `pharma123`

### Issue: Login works but redirects back
**Solution:** Check if `dashboard.html` exists and is accessible

## Debug Checklist

- [ ] Backend is running on port 8080
- [ ] Using http://localhost:8000 (NOT file://)
- [ ] Browser console shows API calls
- [ ] No CORS errors in console
- [ ] Login API returns 200 status
- [ ] Token is saved to localStorage
- [ ] dashboard.html exists

## Still Not Working?

1. Open browser console (F12)
2. Try logging in
3. Copy ALL console messages
4. Check Network tab for the `/api/auth/login` request
5. Share the error messages

