#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/gamma-calc"
DATA_DIR="/var/lib/gamma-calc"
SERVICE_FILE="/etc/systemd/system/gamma-calc.service"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script with sudo:"
  echo "sudo bash deploy/install-ubuntu.sh"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install it first, then rerun this script."
  echo "Ubuntu example: sudo apt update && sudo apt install -y nodejs"
  exit 1
fi

mkdir -p "${APP_DIR}" "${DATA_DIR}/backups"

if ! id gamma-calc >/dev/null 2>&1; then
  useradd --system --home "${APP_DIR}" --shell /usr/sbin/nologin gamma-calc
fi

cp app.js index.html styles.css server.mjs README.md "${APP_DIR}/"
rm -rf "${APP_DIR}/assets"
cp -R assets "${APP_DIR}/assets"
cp deploy/gamma-calc.service "${SERVICE_FILE}"

chown -R root:root "${APP_DIR}"
chmod -R a+rX "${APP_DIR}"
chown -R gamma-calc:gamma-calc "${DATA_DIR}"
chmod 750 "${DATA_DIR}"

systemctl daemon-reload
systemctl enable gamma-calc
systemctl restart gamma-calc

echo "Gamma Calc installed."
echo "Status: systemctl status gamma-calc --no-pager"
echo "Open: http://$(hostname -I | awk '{print $1}'):5174/"
echo "First admin password is ChangeMe123! unless GAMMA_CALC_ADMIN_PASSWORD was set before first launch."
