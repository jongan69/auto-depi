<<<<<<< HEAD
# auto-depi
=======
# Auto-Depi: Automated Webhook Updater & Deployer

This repo helps you automatically update your GitHub webhook to match your current ngrok endpoint and auto-deploy your API on a Raspberry Pi.

## Features
- 🌀 Fetches and validates your ngrok public HTTPS endpoint
- 🔁 Caches and reuses the endpoint if valid
- 🔄 Updates the GitHub webhook automatically if the ngrok URL changes
- 🚀 Deploy script to auto-pull and restart your API
- 🌐 Optional REST API endpoint to refresh webhook on demand
- ⚙️ Systemd and .env-driven configuration for robust automation

---

## 1. Setup

1. **Clone this repo on your Raspberry Pi:**
   ```sh
   git clone <your-repo-url>
   cd auto-depi
   ```
2. **Copy and edit the environment file:**
   ```sh
   cp .env.example .env
   # Edit .env with your values
   ```
   Example `.env` variables:
   ```env
   NGROK_API_KEY=your_ngrok_api_key
   GITHUB_PAT=your_github_personal_access_token
   GITHUB_OWNER=your_github_username_or_org
   GITHUB_REPO=your_repo_name
   WEBHOOK_ID=12345678
   WEBHOOK_SECRET=your_webhook_secret
   CACHE_DURATION_MS=3600000
   APP_DIR=/home/pi/auto-depi
   APP_SERVICE=my-api-app.service
   APP_START_CMD="npm start"   # or "python3 main.py" etc
   NODE_PATH=/usr/bin/node     # optional, if not in $PATH
   WEBHOOK_UPDATE_INTERVAL=5m  # for systemd timer, e.g. 5m, 10m
   ```
3. **Install dependencies:**
   ```sh
   npm install
   ```

---

## 2. Usage

### Run the webhook updater manually
```sh
node updateWebhook.js
```

### Run periodically (cron, pm2, or systemd)
- **Systemd timer (recommended):**
  1. Create `/etc/systemd/system/update-webhook.service`:
     ```ini
     [Unit]
     Description=Update GitHub Webhook

     [Service]
     Type=oneshot
     WorkingDirectory=/home/pi/auto-depi
     EnvironmentFile=/home/pi/auto-depi/.env
     ExecStart=${NODE_PATH:-/usr/bin/node} updateWebhook.js
     User=pi
     ```
  2. Create `/etc/systemd/system/update-webhook.timer`:
     ```ini
     [Unit]
     Description=Run webhook updater every interval

     [Timer]
     OnBootSec=1min
     OnUnitActiveSec=${WEBHOOK_UPDATE_INTERVAL:-5m}
     Unit=update-webhook.service

     [Install]
     WantedBy=timers.target
     ```
  3. Enable and start:
     ```sh
     sudo systemctl daemon-reload
     sudo systemctl enable update-webhook.timer
     sudo systemctl start update-webhook.timer
     ```
- **Cron:**
  ```sh
  */5 * * * * /usr/bin/node /home/pi/auto-depi/updateWebhook.js >> /home/pi/auto-depi/log.txt 2>&1
  ```
- **pm2:**
  ```sh
  pm2 start updateWebhook.js --name update-webhook --cron "*/5 * * * *"
  ```

### REST API endpoint (optional)
Start the server:
```sh
npm run start-server
```
Then call:
```sh
curl http://localhost:3000/refresh-webhook
```

---

## 3. Auto-Deploy Script

Edit `deploy.sh` to match your API app's location and restart command. Example for systemd:

```sh
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
```

Make it executable:
```sh
chmod +x deploy.sh
```

---

## 4. Systemd Service for Your API App

Create `/etc/systemd/system/my-api-app.service` (replace with your app's name):

```ini
[Unit]
Description=My API App
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/pi/auto-depi
EnvironmentFile=/home/pi/auto-depi/.env
ExecStart=/bin/bash -c "${APP_START_CMD}"
Restart=always
User=pi

[Install]
WantedBy=multi-user.target
```

Enable and start your app:
```sh
sudo systemctl daemon-reload
sudo systemctl enable my-api-app.service
sudo systemctl start my-api-app.service
```

---

## 5. Webhook Setup
- Set up your GitHub webhook to point to your ngrok URL + `/webhook`.
- Use your GitHub PAT with `repo` and `admin:repo_hook` scopes.

---

## 6. Environment Variables
See `.env.example` for all required variables. All paths, commands, and intervals can be set in `.env` for maximum flexibility.

---

## 7. Troubleshooting
- Ensure your ngrok tunnel is running and accessible.
- Check logs in `log.txt`, via `pm2 logs`, or with `journalctl -u <service>` for systemd.

---

## License
MIT # auto-depi
>>>>>>> bf34868 (first commit)
