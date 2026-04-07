const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');
const treeKill = require('tree-kill');

let mainWindow;
let apiProcess;

const API_PORT = 5000;
const API_URL = `http://localhost:${API_PORT}`;

function getApiExePath() {
  // In packaged app, resources are in process.resourcesPath
  // In dev, use the build output directly
  const packaged = path.join(process.resourcesPath, 'api', 'BrewBar.API.exe');
  if (fs.existsSync(packaged)) return packaged;

  // Dev fallback
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
      ASPNETCORE_URLS: API_URL,
      ConnectionStrings__DefaultConnection: `Data Source=${dbPath}`,
    },
    stdio: 'pipe',
  });

  apiProcess.stdout.on('data', (data) => {
    console.log(`[API] ${data}`);
  });

  apiProcess.stderr.on('data', (data) => {
    console.error(`[API] ${data}`);
  });

  apiProcess.on('exit', (code) => {
    console.log(`API process exited with code ${code}`);
  });
}

function waitForApi(retries = 30, delay = 1000) {
  return new Promise((resolve, reject) => {
    const attempt = (remaining) => {
      http
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

  mainWindow.loadURL(API_URL);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Auto-import menu file if one was provided during installation.
 * The WiX installer copies the user's .xlsx to the API directory as menu-import.xlsx.
 */
async function tryMenuImport() {
  const apiDir = path.dirname(getApiExePath());
  const importFile = path.join(apiDir, 'menu-import.xlsx');

  if (!fs.existsSync(importFile)) return;

  console.log(`[Menu Import] Found ${importFile}, importing...`);

  // First, get an admin token via PIN login
  const loginData = JSON.stringify({ pin: '1234' });
  const token = await new Promise((resolve, reject) => {
    const req = http.request(
      `${API_URL}/api/auth/pin-login`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body).token);
          } catch {
            reject(new Error('Failed to parse login response'));
          }
        });
      },
    );
    req.on('error', reject);
    req.end(loginData);
  });

  if (!token) {
    console.error('[Menu Import] Failed to get auth token');
    return;
  }

  // Upload the file via multipart form data
  const fileData = fs.readFileSync(importFile);
  const boundary = '----BrewBarMenuImport' + Date.now();
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="menu-import.xlsx"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`,
    ),
    fileData,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const result = await new Promise((resolve, reject) => {
    const req = http.request(
      `${API_URL}/api/menu-import`,
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          Authorization: `Bearer ${token}`,
          'Content-Length': payload.length,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          console.log(`[Menu Import] Response (${res.statusCode}): ${body}`);
          resolve(res.statusCode === 200);
        });
      },
    );
    req.on('error', reject);
    req.end(payload);
  });

  if (result) {
    fs.unlinkSync(importFile);
    console.log('[Menu Import] Import complete, file removed');
  }
}

app.on('ready', async () => {
  startApi();
  try {
    await waitForApi();
    await tryMenuImport();
    createWindow();
  } catch (err) {
    console.error('Failed to start API:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', () => {
  if (apiProcess && !apiProcess.killed) {
    treeKill(apiProcess.pid, 'SIGTERM');
  }
});
