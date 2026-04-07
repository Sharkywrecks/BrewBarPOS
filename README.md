# BrewBar POS

A free, open-source Point of Sale system built for juice bars, smoothie shops, and kiosk businesses. Runs as a desktop app with zero external dependencies — no cloud account, no monthly fees, no internet required.

## Why BrewBar?

Most POS systems are cloud-locked SaaS products with per-terminal fees. BrewBar is different:

- **Free forever** — MIT licensed, no hidden costs
- **Offline-first** — takes orders even when the internet is down
- **Self-contained** — single installer, no Docker, no database server to manage
- **Your data** — SQLite database stored locally on your machine
- **Open source** — inspect, modify, and extend to fit your business

## Features

### POS Terminal
- Touch-friendly register with category-filtered product grid
- Product variants (sizes) and modifiers (add-ons) with pricing
- Cash and card payment recording with change calculation
- Receipt printing via USB thermal printers (ESC/POS over WebUSB)
- Automatic cash drawer kick on cash payments
- Order history with receipt reprinting
- Fast PIN-based cashier login

### Admin Dashboard
- Catalog management — categories, products, variants, modifiers
- Order management — search, filter, void, and refund
- Sales reporting — daily KPIs, hourly trends, top products, payment breakdown
- Business settings — store name, tax rate

### Offline & Sync
- Orders queue locally (IndexedDB) when the API is unreachable
- Background sync engine retries automatically with idempotent order creation
- Cart persists to IndexedDB — survives page refreshes and app crashes

### Deployment Modes
- **Standalone** — single-machine install with embedded API + SQLite
- **Terminal** — Electron frontend connecting to a remote BrewBar server
- **Cloud** — deploy the API via Docker, access via any browser

### Infrastructure
- Role-based access — Admin, Manager, Cashier
- Multi-terminal support
- Menu import from Excel (.xlsx) during installation or via admin
- Configurable store name and tax rate (set during install)
- Rate-limited API with structured error handling
- Automatic database seeding with sample menu on first run

## Quick Start

### Desktop Install (Recommended)

Download the latest `.msi` installer from [Releases](https://github.com/Sharkywrecks/BrewBarPOS/releases), run it, and launch **BrewBar POS** from the Start Menu or Desktop shortcut. That's it — the app bundles everything it needs.

**Default login:**
| Role | Email | Password | PIN |
|------|-------|----------|-----|
| Admin | admin@brewbar.local | Admin123! | 1234 |
| Cashier | cashier@brewbar.local | Cashier123! | 0000 |

### Development Setup

**Prerequisites:** [.NET 10 SDK](https://dotnet.microsoft.com/download), [Node.js 20+](https://nodejs.org/)

```bash
# Clone
git clone https://github.com/Sharkywrecks/BrewBarPOS.git
cd BrewBarPOS

# Run the API with SQLite (no MySQL needed)
npm run dev:api:sqlite

# In a separate terminal — run the Angular apps
cd client
npm install
npx ng serve admin    # Admin dashboard → http://localhost:4200
npx ng serve pos      # POS terminal   → http://localhost:4201
```

#### Development with MySQL

If you prefer MySQL (for production-like development):

```bash
# Start MySQL and Redis via Docker
docker compose up -d

# Run the API (uses MySQL by default)
npm run dev:api
```

### Build the Desktop Installer

```bash
# Install all dependencies
npm run install:all

# Build everything (API + Angular + Electron + MSI)
npm run build:installer
```

The MSI installer is output to `build/installer/BrewBar.Installer.msi`.

Individual build steps are also available:

| Command | Description |
|---------|-------------|
| `npm run build:api` | Publish self-contained .NET API (win-x64) |
| `npm run build:client` | Build Angular admin + POS apps |
| `npm run build:desktop` | Full build: API + Angular + Electron |
| `npm run build:installer` | Full build + WiX MSI installer |
| `npm run clean` | Remove build output |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | ASP.NET Core 10, C#, Clean Architecture |
| Database | SQLite (desktop) / MySQL 8 (server deployment) |
| Frontend | Angular 21, Angular Material 3 |
| Desktop | Electron (Chromium shell) |
| API Client | NSwag (auto-generated TypeScript from OpenAPI) |
| Printing | WebUSB + ESC/POS protocol |
| Installer | WiX v5 MSI |

## Project Structure

```
BrewBarPOS/
├── server/                      # ASP.NET Core backend
│   └── src/
│       ├── BrewBar.Core/        #   Domain entities, interfaces, enums
│       ├── BrewBar.Infrastructure/ # EF Core, repositories, services
│       └── BrewBar.API/         #   Controllers, DTOs, middleware
├── client/                      # Angular workspace
│   ├── projects/
│   │   ├── admin/               #   Admin dashboard app
│   │   └── pos/                 #   POS terminal app
│   └── libs/                    #   Shared libraries (api-client, auth, ui, sync, printing)
├── desktop/                     # Electron shell
│   ├── main.js                  #   Launches .NET API + opens BrowserWindow
│   └── electron-builder.yml     #   Packaging config
├── installer/                   # WiX MSI installer
│   ├── Package.wxs              #   Installer definition
│   └── License.rtf              #   License shown during install
├── scripts/                     # Build utilities
├── build-desktop.ps1            # PowerShell build script (alternative)
├── package.json                 # Root build commands
└── docker-compose.yml           # MySQL + Redis for dev
```

## Architecture

The POS runs as a single Electron window backed by a local .NET API:

```
┌─────────────────────────────────┐
│         Electron Window         │
│  ┌───────────────────────────┐  │
│  │   Angular POS / Admin     │  │
│  │   (served as static files)│  │
│  └───────────┬───────────────┘  │
│              │ HTTP              │
│  ┌───────────┴───────────────┐  │
│  │   ASP.NET Core API        │  │
│  │   (Kestrel on :5000)      │  │
│  └───────────┬───────────────┘  │
│              │                  │
│  ┌───────────┴───────────────┐  │
│  │   SQLite Database         │  │
│  │   (%APPDATA%/BrewBarPOS/) │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

## API Documentation

When running the API in development mode, Swagger UI is available at:

```
http://localhost:5000/swagger
```

The API client is auto-generated from the OpenAPI spec using NSwag. To regenerate after API changes:

```bash
cd client
npm run generate
```

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding conventions, and PR guidelines.

Core principles:

- **Practical over clever** — write code a small team can maintain
- **Boring technology** — prefer reliable, well-understood choices
- **No overengineering** — solve the problem at hand, not hypothetical future ones

## License

[MIT](LICENSE)
