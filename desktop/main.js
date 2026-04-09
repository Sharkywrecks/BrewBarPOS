const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');
const treeKill = require('tree-kill');

// Note: this shell intentionally knows nothing about credentials. First-launch
// admin + business settings bootstrap is handled by the API itself, which reads
// bootstrap.json (written by the MSI installer) on startup, processes it under
// a zero-users precondition, and deletes the file. See BootstrapService.cs.

let mainWindow;
let apiProcess;

// ─── Configuration ─────────────────────────────────────────────
// Deployment modes:
//   "standalone"  — Electron + local API + SQLite (default)
//   "terminal"    — Electron frontend only, API is remote

function loadConfig() {
  const configPaths = [
    // Packaged app
    path.join(process.resourcesPath || '', 'config', 'deployment.json'),
    // Installed via MSI (next to the exe)
    path.join(path.dirname(process.execPath), 'deployment.json'),
    // Dev fallback
    path.join(__dirname, 'deployment.json'),
  ];

  for (const p of configPaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf-8');
        console.log(`[Config] Loaded from ${p}`);
        return JSON.parse(raw);
      } catch {
        console.warn(`[Config] Failed to parse ${p}`);
      }
    }
  }

  // Default: standalone
  return { mode: 'standalone' };
}

const config = loadConfig();
const MODE = config.mode || 'standalone';
const API_PORT = config.apiPort || 5000;
const API_URL = MODE === 'terminal'
  ? config.apiUrl
  : `http://localhost:${API_PORT}`;

console.log(`[Config] Mode: ${MODE}, API URL: ${API_URL}`);

// ─── API Management (standalone mode only) ─────────────────────

function getApiExePath() {
  const packaged = path.join(process.resourcesPath, 'api', 'BrewBar.API.exe');
  if (fs.existsSync(packaged)) return packaged;
  return path.join(__dirname, '..', 'build', 'api', 'BrewBar.API.exe');
}

function getDataDir() {
  const dataDir = path.join(app.getPath('userData'), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
}

function startApi() {
  const exePath = getApiExePath();
  const dataDir = getDataDir();
  const dbPath = path.join(dataDir, 'brewbar.db');

  console.log(`Starting API: ${exePath}`);
  console.log(`Database: ${dbPath}`);

  apiProcess = spawn(exePath, [], {
    cwd: path.dirname(exePath),
    env: {
      ...process.env,
      ASPNETCORE_ENVIRONMENT: 'Desktop',
      ASPNETCORE_URLS: `http://localhost:${API_PORT}`,
      ConnectionStrings__DefaultConnection: `Data Source=${dbPath}`,
    },
    stdio: 'pipe',
  });

  apiProcess.stdout.on('data', (data) => console.log(`[API] ${data}`));
  apiProcess.stderr.on('data', (data) => console.error(`[API] ${data}`));
  apiProcess.on('exit', (code) => console.log(`API process exited with code ${code}`));
}

function waitForApi(retries = 30, delay = 1000) {
  return new Promise((resolve, reject) => {
    const attempt = (remaining) => {
      const mod = API_URL.startsWith('https') ? https : http;
      mod
        .get(`${API_URL}/health/ready`, (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else if (remaining > 0) {
            setTimeout(() => attempt(remaining - 1), delay);
          } else {
            reject(new Error('API did not return 200'));
          }
        })
        .on('error', () => {
          if (remaining > 0) {
            setTimeout(() => attempt(remaining - 1), delay);
          } else {
            reject(new Error('API failed to start'));
          }
        });
    };
    attempt(retries);
  });
}

// ─── Window ────────────────────────────────────────────────────

const LOADING_HTML = `data:text/html;charset=utf-8,${encodeURIComponent(`
<!DOCTYPE html>
<html>
<head>
<style>
  body { margin:0; display:flex; align-items:center; justify-content:center; height:100vh;
         background:#faf8f5; font-family:system-ui,-apple-system,sans-serif; color:#3c3836; }
  .loader { text-align:center; }
  h1 { font-size:32px; font-weight:700; letter-spacing:1px; margin:0 0 16px; }
  .spinner { width:36px; height:36px; border:3px solid #e0dcd8; border-top-color:#6d5e4b;
             border-radius:50%; animation:spin .8s linear infinite; margin:0 auto; }
  @keyframes spin { to { transform:rotate(360deg); } }
  p { color:#8a8279; margin-top:16px; font-size:14px; }
</style>
</head>
<body>
  <div class="loader">
    <h1>BrewBar</h1>
    <div class="spinner"></div>
    <p>Starting up\u2026</p>
  </div>
</body>
</html>`)}`;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'BrewBar POS',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
  });

  mainWindow.loadURL(LOADING_HTML);
  mainWindow.on('closed', () => { mainWindow = null; });
}

function showApp() {
  if (mainWindow) {
    mainWindow.webContents.session.clearCache();
    mainWindow.loadURL(API_URL);
  }
}

// ─── App lifecycle ─────────────────────────────────────────────

app.on('ready', async () => {
  createWindow(); // Show loading screen immediately

  if (MODE === 'standalone') {
    startApi();
    try {
      await waitForApi();
    } catch (err) {
      console.error('Failed to start local API:', err);
      app.quit();
      return;
    }
  } else if (MODE === 'terminal') {
    try {
      await waitForApi(10, 2000);
    } catch {
      console.warn('[Terminal] Remote API not reachable, starting anyway (offline mode will queue orders)');
    }
  }

  showApp(); // Navigate to the actual app once API is ready
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', () => {
  if (apiProcess && !apiProcess.killed) {
    treeKill(apiProcess.pid, 'SIGTERM');
  }
});
