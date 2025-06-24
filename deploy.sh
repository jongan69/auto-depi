#!/bin/bash
set -e

# Load .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

cd "$APP_DIR"
git pull origin main
npm install

# Restart via systemd
sudo systemctl restart "$APP_SERVICE" 