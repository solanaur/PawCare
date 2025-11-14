const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let backendProcess;

// Check if backend is running
function checkBackend() {
  return new Promise((resolve) => {
    const http = require('http');
    // Try multiple endpoints - any response means backend is running
    const endpoints = ['/api/auth/login', '/api/pets', '/'];
    let checked = 0;
    
    endpoints.forEach(endpoint => {
      const req = http.get(`http://localhost:8080${endpoint}`, (res) => {
        // Any status code means backend is running
        if (!resolved) {
          resolved = true;
          resolve(true);
        }
      });
      req.on('error', () => {
        checked++;
        if (checked === endpoints.length && !resolved) {
          resolved = true;
          resolve(false);
        }
      });
      req.setTimeout(2000, () => {
        req.destroy();
        checked++;
        if (checked === endpoints.length && !resolved) {
          resolved = true;
          resolve(false);
        }
      });
    });
    
    let resolved = false;
    // Timeout after 3 seconds
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    }, 3000);
  });
}

// Start backend if not running
async function ensureBackend() {
  const isRunning = await checkBackend();
  if (isRunning) {
    console.log('Backend is already running');
    return;
  }
  
  console.log('Backend not detected, attempting to start...');
  const backendPath = path.join(__dirname, 'pawcare-backend');
  const jarPath = path.join(backendPath, 'target', 'pawcare-backend-0.0.1-SNAPSHOT.jar');
  const fs = require('fs');
  
  // Try to start backend with JAR first (faster)
  if (fs.existsSync(jarPath)) {
    console.log('Starting backend with JAR file...');
    backendProcess = spawn('java', ['-jar', jarPath, '--spring.profiles.active=h2'], {
      cwd: backendPath,
      stdio: 'pipe',
      detached: false
    });
    
    backendProcess.stdout.on('data', (data) => {
      if (data.toString().includes('Started PawcareApplication')) {
        console.log('Backend started successfully!');
      }
    });
    
    backendProcess.stderr.on('data', (data) => {
      console.error(`Backend error: ${data}`);
    });
  } else if (fs.existsSync(path.join(backendPath, 'pom.xml'))) {
    // Try Maven
    console.log('Starting backend with Maven...');
    backendProcess = spawn('mvn', ['spring-boot:run', '-Dspring-boot.run.profiles=h2'], {
      cwd: backendPath,
      stdio: 'pipe',
      shell: true,
      detached: false
    });
    
    backendProcess.stdout.on('data', (data) => {
      if (data.toString().includes('Started PawcareApplication')) {
        console.log('Backend started successfully!');
      }
    });
  } else {
    // Backend files not found
    const result = dialog.showMessageBoxSync(mainWindow || BrowserWindow.getFocusedWindow() || null, {
      type: 'error',
      title: 'Backend Not Found',
      message: 'Could not find backend files',
      detail: `Backend directory not found at: ${backendPath}\n\nPlease ensure the backend is in the correct location.`,
      buttons: ['OK']
    });
    return;
  }
  
  // Wait for backend to start (with longer timeout)
  let attempts = 0;
  while (attempts < 60) { // Wait up to 60 seconds
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (await checkBackend()) {
      console.log('Backend is now running!');
      return;
    }
    attempts++;
  }
  
  // If we get here, backend didn't start
  dialog.showMessageBoxSync(mainWindow || BrowserWindow.getFocusedWindow() || null, {
    type: 'warning',
    title: 'Backend Starting',
    message: 'Backend is starting but taking longer than expected',
    detail: 'The backend server is starting in the background. Please wait a moment and try again.\n\n' +
            'You can also start it manually in a terminal:\n' +
            `cd ${backendPath}\n` +
            'mvn spring-boot:run -Dspring-boot.run.profiles=h2',
    buttons: ['OK']
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
    icon: path.join(__dirname, 'assets', 'logo.png'),
    titleBarStyle: 'default',
    show: false
  });

  // Load the index.html using file:// protocol (Electron handles this)
  const indexPath = path.join(__dirname, 'index.html');
  
  // Wait for page to load before setting API config
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      if (typeof window !== 'undefined') {
        window.API_BASE = "http://localhost:8080/api";
        window.USE_API = true;
        console.log('[Electron] API configured:', window.API_BASE);
      }
    `).catch(err => console.error('Failed to set API config:', err));
  });
  
  mainWindow.loadFile(indexPath);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Check backend connection
    checkBackend().then(isRunning => {
      if (!isRunning) {
        dialog.showMessageBox(mainWindow, {
          type: 'warning',
          title: 'Backend Connection',
          message: 'Cannot connect to backend server',
          detail: 'Please ensure the backend is running on http://localhost:8080\n\nThe app will try to start it automatically.',
          buttons: ['OK']
        });
      }
    });
  });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await ensureBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Kill backend process if we started it
  if (backendProcess) {
    backendProcess.kill();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});

