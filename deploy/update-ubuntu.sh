#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/gamma-calc"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script with sudo:"
  echo "sudo bash deploy/update-ubuntu.sh"
  exit 1
fi

systemctl stop gamma-calc || true
cp app.js index.html styles.css server.mjs README.md "${APP_DIR}/"
chown -R root:root "${APP_DIR}"
chmod -R a+rX "${APP_DIR}"
systemctl start gamma-calc

echo "Gamma Calc updated."
systemctl status gamma-calc --no-pager
