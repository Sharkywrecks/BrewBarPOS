#!/usr/bin/env node
/*
 * generate-api-client.js — fetches swagger.json from the live API and runs NSwag.
 *
 * Why this wrapper exists:
 *   NSwag's `aspNetCoreToOpenApi` document generator uses reflection to find a
 *   static `CreateHostBuilder` / `CreateWebHostBuilder` / `BuildWebHost` method
 *   on Program. With .NET 6+ top-level statements there is no such method, and
 *   adding one creates several incompatibilities with the integration test
 *   fixture's `WebApplicationFactory<Program>`. The cleanest fix is to keep
 *   Program.cs as a single modern top-level file and move OpenAPI generation
 *   off the reflection path entirely.
 *
 * Flow:
 *   1. Spawn `dotnet run --project server/src/BrewBar.API` with a stub Jwt:Secret
 *      and an in-memory SQLite connection so it boots without writing to disk.
 *      ASPNETCORE_ENVIRONMENT=Development so /swagger/v1/swagger.json is mapped.
 *   2. Poll http://localhost:<port>/health/ready until 200.
 *   3. Download /swagger/v1/swagger.json into client/swagger.json.
 *   4. Kill the dotnet process.
 *   5. Run `nswag run nswag.json` (which uses `fromDocument` mode and reads the
 *      file we just downloaded).
 *
 * Same script works on macOS/Linux/Windows — uses Node's built-in `http`,
 * `child_process`, and tree-kill (already a dev dep via the desktop package).
 */

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const API_PROJECT = path.join(REPO_ROOT, 'server', 'src', 'BrewBar.API');
const SWAGGER_OUTPUT = path.join(REPO_ROOT, 'client', 'swagger.json');
const NSWAG_CWD = path.join(REPO_ROOT, 'client');
const PORT = 5179; // dedicated port so we don't collide with `npm run dev:api`
const READY_URL = `http://localhost:${PORT}/health/ready`;
const SWAGGER_URL = `http://localhost:${PORT}/swagger/v1/swagger.json`;
const READY_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 500;

function log(msg) {
  console.log(`[generate-api-client] ${msg}`);
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`GET ${url} → ${res.statusCode}`));
          return;
        }
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
      })
      .on('error', reject);
  });
}

async function waitForReady() {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      await fetchJson(READY_URL);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }
  throw new Error(`API did not become ready at ${READY_URL} within ${READY_TIMEOUT_MS}ms`);
}

function spawnApi() {
  // ASPNETCORE_ENVIRONMENT=NSwag skips the migration/seed/bootstrap block in
  // Program.cs so the API boots without touching any database. Program.cs also
  // maps Swagger UI in the NSwag environment specifically for this flow.
  //
  // Jwt:Secret still has to be set because IdentityServicesExtensions.ValidateJwtSecret
  // fails fast at startup; any 32+ byte non-blocklisted value works for swagger
  // generation since no token is ever signed.
  const env = {
    ...process.env,
    ASPNETCORE_ENVIRONMENT: 'NSwag',
    ASPNETCORE_URLS: `http://localhost:${PORT}`,
    DatabaseProvider: 'Sqlite',
    ConnectionStrings__DefaultConnection: 'Data Source=:memory:',
    Jwt__Secret: 'nswag-generation-stub-key-32-bytes-min-throwaway',
  };

  log(`Starting API on port ${PORT}...`);
  const child = spawn('dotnet', ['run', '--project', API_PROJECT, '--no-launch-profile'], {
    cwd: REPO_ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  child.stdout.on('data', (chunk) => process.stdout.write(`[api] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[api] ${chunk}`));
  child.on('exit', (code, signal) => {
    if (code !== null && code !== 0 && signal === null) {
      log(`API process exited unexpectedly with code ${code}`);
    }
  });

  return child;
}

function killApi(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null) {
      resolve();
      return;
    }
    child.once('exit', () => resolve());
    // SIGTERM is enough on Unix; on Windows Node forwards it to a hard kill which
    // is fine for `dotnet run` since the API has no dirty state to flush.
    child.kill('SIGTERM');
    setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
    }, 5000);
  });
}

function runNswag() {
  return new Promise((resolve, reject) => {
    log('Running nswag run nswag.json...');
    // The runtime is already declared in nswag.json — passing /runtime:Net100
    // again on the command line trips NConsole's "unused argument" check.
    // On Windows, .cmd shims (npx.cmd) require shell: true because spawn cannot
    // execute them directly with EINVAL otherwise. The arguments here are
    // hard-coded literals so the shell-escaping warning doesn't apply.
    const child = spawn('npx', ['nswag', 'run', 'nswag.json'], {
      cwd: NSWAG_CWD,
      stdio: 'inherit',
      shell: true,
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`nswag exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

async function main() {
  const api = spawnApi();

  try {
    log('Waiting for /health/ready...');
    await waitForReady();
    log('API is ready.');

    log(`Downloading ${SWAGGER_URL} → ${SWAGGER_OUTPUT}`);
    const swagger = await fetchJson(SWAGGER_URL);
    fs.writeFileSync(SWAGGER_OUTPUT, swagger, 'utf8');
    log(`Wrote swagger.json (${swagger.length} bytes)`);
  } finally {
    log('Stopping API...');
    await killApi(api);
  }

  await runNswag();
  log('Done.');
}

main().catch((err) => {
  console.error(`[generate-api-client] FAILED: ${err.message}`);
  process.exitCode = 1;
});
