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
  *{margin:0;padding:0;box-sizing:border-box}
  body{display:flex;align-items:center;justify-content:center;height:100vh;
       background:#1a1215;font-family:system-ui,-apple-system,sans-serif;overflow:hidden}

  /* Animated gradient background — slow swirling colours */
  .bg{position:fixed;inset:0;z-index:0;
      background:linear-gradient(135deg,#1a1215 0%,#2d1b2e 25%,#1a1215 50%,#1b2a2d 75%,#1a1215 100%);
      background-size:400% 400%;animation:bgShift 8s ease infinite}
  @keyframes bgShift{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}

  .scene{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center}

  /* Glass */
  .glass{position:relative;width:140px;height:180px;margin-bottom:24px}
  .glass-body{position:absolute;bottom:0;width:100%;height:160px;
      border-radius:8px 8px 30px 30px;border:2px solid rgba(255,255,255,.12);
      background:rgba(255,255,255,.04);backdrop-filter:blur(2px);overflow:hidden}

  /* Liquid fills from bottom with layered colours */
  .liquid{position:absolute;bottom:0;width:100%;height:70%;
      background:linear-gradient(0deg,#c0392b 0%,#e67e22 30%,#f39c12 50%,#e74c8d 75%,#9b59b6 100%);
      background-size:100% 200%;animation:liquidShift 3s ease-in-out infinite alternate}
  @keyframes liquidShift{0%{background-position:0% 100%}100%{background-position:0% 0%}}

  /* Wavy liquid surface */
  .wave{position:absolute;top:-12px;left:-10%;width:120%;height:24px}
  .wave svg{width:100%;height:100%}
  .wave1{animation:waveMove 2.5s ease-in-out infinite}
  .wave2{animation:waveMove 3.5s ease-in-out infinite reverse;opacity:.6;top:-8px}
  @keyframes waveMove{0%,100%{transform:translateX(-5%)}50%{transform:translateX(5%)}}

  /* Bubbles rising inside the glass */
  .bubbles{position:absolute;bottom:0;width:100%;height:100%}
  .bubble{position:absolute;border-radius:50%;background:rgba(255,255,255,.15);
      animation:rise linear infinite}
  .bubble:nth-child(1){width:6px;height:6px;left:20%;animation-duration:2.2s;animation-delay:0s}
  .bubble:nth-child(2){width:4px;height:4px;left:50%;animation-duration:2.8s;animation-delay:.4s}
  .bubble:nth-child(3){width:8px;height:8px;left:70%;animation-duration:2s;animation-delay:.8s}
  .bubble:nth-child(4){width:3px;height:3px;left:35%;animation-duration:3s;animation-delay:1.2s}
  .bubble:nth-child(5){width:5px;height:5px;left:60%;animation-duration:2.4s;animation-delay:.2s}
  .bubble:nth-child(6){width:7px;height:7px;left:15%;animation-duration:2.6s;animation-delay:1.5s}
  .bubble:nth-child(7){width:4px;height:4px;left:80%;animation-duration:3.2s;animation-delay:.6s}
  @keyframes rise{0%{bottom:-5%;opacity:0}10%{opacity:1}90%{opacity:1}100%{bottom:70%;opacity:0}}

  /* Splash droplets around the glass */
  .splash{position:absolute;border-radius:50%;opacity:0}
  .splash1{width:8px;height:8px;background:#e74c8d;top:-20px;left:10px;
      animation:splashUp 2.5s ease-in-out infinite}
  .splash2{width:6px;height:6px;background:#f39c12;top:-15px;right:15px;
      animation:splashUp 3s ease-in-out .5s infinite}
  .splash3{width:10px;height:10px;background:#9b59b6;top:-25px;left:60px;
      animation:splashUp 2.8s ease-in-out 1s infinite}
  .splash4{width:5px;height:5px;background:#e67e22;top:-10px;right:40px;
      animation:splashUp 3.2s ease-in-out 1.5s infinite}
  @keyframes splashUp{0%,100%{opacity:0;transform:translateY(0) scale(.5)}
      30%{opacity:1;transform:translateY(-25px) scale(1)}
      60%{opacity:.8;transform:translateY(-15px) scale(.8)}
      80%{opacity:0;transform:translateY(-35px) scale(.3)}}

  /* Drips on the glass edge */
  .drip{position:absolute;top:0;width:4px;background:rgba(233,119,195,.4);
      border-radius:0 0 4px 4px;animation:drip 4s ease-in infinite}
  .drip1{left:25%;height:0;animation-delay:0s}
  .drip2{left:65%;height:0;animation-delay:2s}
  @keyframes drip{0%{height:0;opacity:.8}50%{height:30px;opacity:.6}100%{height:0;opacity:0}}

  /* Text */
  h1{font-size:36px;font-weight:700;letter-spacing:2px;
      background:linear-gradient(90deg,#e74c8d,#f39c12,#9b59b6,#e74c8d);
      background-size:300% 100%;-webkit-background-clip:text;background-clip:text;
      -webkit-text-fill-color:transparent;animation:textShimmer 4s linear infinite}
  @keyframes textShimmer{0%{background-position:0% 50%}100%{background-position:300% 50%}}
  p{color:rgba(255,255,255,.4);margin-top:10px;font-size:13px;letter-spacing:1px;
      animation:pulse 2s ease-in-out infinite}
  @keyframes pulse{0%,100%{opacity:.4}50%{opacity:.8}}
</style>
</head>
<body>
  <div class="bg"></div>
  <div class="scene">
    <div class="glass">
      <div class="glass-body">
        <div class="liquid">
          <div class="wave wave1">
            <svg viewBox="0 0 200 20" preserveAspectRatio="none">
              <path d="M0,10 C30,4 70,16 100,10 C130,4 170,16 200,10 L200,20 L0,20 Z"
                    fill="rgba(155,89,182,.6)"/>
            </svg>
          </div>
          <div class="wave wave2">
            <svg viewBox="0 0 200 20" preserveAspectRatio="none">
              <path d="M0,10 C40,16 60,4 100,10 C140,16 160,4 200,10 L200,20 L0,20 Z"
                    fill="rgba(231,76,141,.4)"/>
            </svg>
          </div>
        </div>
        <div class="bubbles">
          <div class="bubble"></div><div class="bubble"></div><div class="bubble"></div>
          <div class="bubble"></div><div class="bubble"></div><div class="bubble"></div>
          <div class="bubble"></div>
        </div>
      </div>
      <div class="drip drip1"></div>
      <div class="drip drip2"></div>
      <div class="splash splash1"></div>
      <div class="splash splash2"></div>
      <div class="splash splash3"></div>
      <div class="splash splash4"></div>
    </div>
    <h1>BrewBar</h1>
    <p>Mixing things up\u2026</p>
  </div>
</body>
</html>`)}`;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'BrewBar POS',
    icon: app.isPackaged
      ? path.join(path.dirname(process.execPath), 'app.ico')
      : path.join(__dirname, '..', 'installer', 'app.ico'),
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
