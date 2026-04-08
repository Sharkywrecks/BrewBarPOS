#!/usr/bin/env bash
#
# BrewBar POS — Linux Server Installer
#
# Installs the BrewBar API as a systemd service.
# Run from the extracted tarball directory as root:
#   sudo ./install.sh
#

set -euo pipefail

INSTALL_DIR="/opt/brewbar"
SERVICE_NAME="brewbar"

# ── Require root ──────────────────────────────────────────────────────────────
if [ "$(id -u)" -ne 0 ]; then
    echo "Error: This script must be run as root (sudo ./install.sh)" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "========================================"
echo "  BrewBar POS Server Installer"
echo "========================================"
echo ""

# ── Step 1: Create system user ────────────────────────────────────────────────
if ! id -u "$SERVICE_NAME" &>/dev/null; then
    echo "Creating system user '$SERVICE_NAME'..."
    useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_NAME"
else
    echo "System user '$SERVICE_NAME' already exists"
fi

# ── Step 2: Gather configuration ─────────────────────────────────────────────
echo ""
echo "-- Database Configuration --"
read -rp "Database host [localhost]: " DB_HOST
DB_HOST=${DB_HOST:-localhost}
read -rp "Database port [3306]: " DB_PORT
DB_PORT=${DB_PORT:-3306}
read -rp "Database name [brewbar]: " DB_NAME
DB_NAME=${DB_NAME:-brewbar}
read -rp "Database user [brewbar]: " DB_USER
DB_USER=${DB_USER:-brewbar}
read -rsp "Database password: " DB_PASS
echo ""

echo ""
echo "-- Server Configuration --"
read -rp "API port [5000]: " API_PORT
API_PORT=${API_PORT:-5000}

# Generate random JWT secret
JWT_SECRET=$(openssl rand -base64 48)

# ── Step 3: Install files ────────────────────────────────────────────────────
echo ""
echo "Installing to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
cp -r "$SCRIPT_DIR"/* "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/BrewBar.API"

# ── Step 4: Write configuration ──────────────────────────────────────────────
echo "Writing configuration..."
CONN_STRING="Server=${DB_HOST};Port=${DB_PORT};Database=${DB_NAME};User=${DB_USER};Password=${DB_PASS}"
SETTINGS="$INSTALL_DIR/appsettings.Server.json"

python3 -c "
import json
with open('${SETTINGS}') as f:
    cfg = json.load(f)
cfg['ConnectionStrings']['DefaultConnection'] = '${CONN_STRING}'
cfg['Jwt']['Secret'] = '${JWT_SECRET}'
cfg['Urls'] = ['http://0.0.0.0:${API_PORT}']
cfg['AllowedOrigins'] = ['http://localhost:${API_PORT}']
with open('${SETTINGS}', 'w') as f:
    json.dump(cfg, f, indent=2)
"

# ── Step 5: Install systemd service ──────────────────────────────────────────
echo "Installing systemd service..."
cp "$INSTALL_DIR/brewbar.service" /etc/systemd/system/brewbar.service
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"

# ── Step 6: Set ownership ────────────────────────────────────────────────────
chown -R "$SERVICE_NAME:$SERVICE_NAME" "$INSTALL_DIR"

echo ""
echo "========================================"
echo "  Installation complete!"
echo "========================================"
echo ""
echo "  Start:   sudo systemctl start $SERVICE_NAME"
echo "  Status:  sudo systemctl status $SERVICE_NAME"
echo "  Logs:    sudo journalctl -u $SERVICE_NAME -f"
echo "  Config:  $SETTINGS"
echo ""
echo "  The API will be available at http://<server-ip>:${API_PORT}"
echo ""
