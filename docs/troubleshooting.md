# Troubleshooting

Common issues and solutions when developing or running BrewBar POS.

## Development

### API won't start — port 5000 already in use

Another process is using port 5000. Find and kill it:

```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <pid> /F

# Linux/macOS
lsof -i :5000
kill <pid>
```

Or change the port in `server/src/BrewBar.API/Properties/launchSettings.json`.

### API starts but Angular gets CORS errors

The API must be running before the Angular dev server. Ensure:
1. `npm run dev:api:sqlite` is running on port 5000
2. The Angular environment file points to the correct URL (`https://localhost:5001` or `http://localhost:5000`)

### `npm run generate` (NSwag) fails

NSwag needs the API project to compile. Common fixes:
- Run `dotnet restore server/BrewBar.slnx` first
- Ensure .NET 10 SDK is installed: `dotnet --version`
- If you get a runtime error, check `client/nswag.json` has `"runtime": "Net100"`

### SQLite database locked

If you see "database is locked" errors:
- Only one process can write to SQLite at a time
- Close any other instances of the API or database browsers (e.g., DB Browser for SQLite)
- Delete the lock file if it persists: `%APPDATA%/BrewBarPOS/brewbar.db-wal` and `brewbar.db-shm`

### EF Core migration errors

```bash
# Reset the SQLite database (deletes all data)
cd server/src/BrewBar.API
rm -rf "%APPDATA%/BrewBarPOS/brewbar.db*"
dotnet run --environment Desktop
# The database is recreated and seeded on startup
```

For MySQL:
```bash
cd server/src/BrewBar.Infrastructure
dotnet ef database update --startup-project ../BrewBar.API
```

## Printing

### Thermal printer not detected (WebUSB)

WebUSB requires:
1. **Chrome or Edge** — Firefox and Safari don't support WebUSB
2. **HTTPS or localhost** — WebUSB is blocked on plain HTTP
3. **User gesture** — the browser requires a click/tap to trigger the USB device picker
4. **No other driver claiming the device** — on Windows, you may need to use Zadig to replace the printer driver with WinUSB

### Receipt prints garbled text

- Ensure the printer supports ESC/POS commands (most thermal receipt printers do)
- Check the printer's character encoding — BrewBar uses Code Page 437 by default
- Try printing a test page from the printer's own utility to verify hardware is working

### Cash drawer won't open

- The drawer must be connected to the printer's DK (drawer kick) port, not directly to the computer
- Check the kick connector cable (usually RJ-11/RJ-12)
- The kick command is sent through the printer — if printing works but the drawer doesn't open, the cable or connector may be the issue

## Desktop / Electron

### Electron app shows blank white screen

The bundled .NET API may have failed to start. Check:
1. Look at the console output in `%APPDATA%/BrewBarPOS/logs/`
2. Ensure port 5000 is not already in use
3. Try running the API separately: `cd build/api && ./BrewBar.API.exe`

### MSI installer build fails

WiX v5 must be installed. Check:
```bash
dotnet tool list -g
# Should show: wix
```

If missing:
```bash
dotnet tool install -g wix
wix extension add WixToolset.UI.wixext/5.0.2
```

## CI / GitHub Actions

### Frontend tests fail in CI but pass locally

- CI uses `ubuntu-latest` — check for OS-specific path issues
- CI runs `npm ci` (clean install from lockfile) — if your lockfile is out of date, run `npm install` locally and commit the updated `package-lock.json`
- Check if a test depends on timezone — CI runs in UTC

### Backend integration tests fail — MySQL connection refused

The MySQL service container needs time to start. The workflow uses health checks, but if tests fail with connection errors:
- Check the `services.mysql.options` health check settings
- Ensure the connection string in the workflow matches the MySQL container environment variables
