# Auto-Depi: The Easiest Way to Auto-Deploy and Sync Your API with GitHub Webhooks

---

## What is This?

**Auto-Depi** is a tool that helps you automatically update your GitHub webhook to match your current ngrok endpoint, and auto-deploy your API (Node, Python, etc.) on a Raspberry Pi (or any Linux server). It can also restart your app when you push new code to GitHub. You can use it for any API project!

---

## Who is This For?

- You want to auto-deploy your API when you push to GitHub.
- You want to keep your GitHub webhook up-to-date with your ngrok tunnel.
- You want a setup that is as easy and foolproof as possible.
- You are a beginner and want step-by-step instructions.

---

## Prerequisites (What You Need First)

1. **A Raspberry Pi or Linux server** (with internet access)
2. **Node.js 18+** (Check with `node -v`)
   - If you don't have Node.js, install it: https://nodejs.org/en/download
3. **npm** (comes with Node.js)
4. **git** (Check with `git --version`)
5. **ngrok account** (https://ngrok.com/)
6. **GitHub account** and a repository you want to auto-deploy
7. **(Optional but recommended) systemd** (most Linux systems have this)

---

## Step 1: Clone This Repo

Open a terminal on your Raspberry Pi or server and run:

```sh
git clone https://github.com/jongan69/auto-depi
cd auto-depi
```

---

## Step 2: Install Dependencies

Run this in your `auto-depi` folder:

```sh
npm install
```

If you see errors, make sure you have Node.js 18+ and npm installed.

---

## Step 3: Set Up Your .env File

1. Copy the example file:
   ```sh
   cp .env.example .env
   ```
2. Open `.env` in a text editor (like `nano .env` or use VS Code).
3. Fill in all the values. Here's what each one means:

   | Variable                | What it is (and where to get it) |
   |-------------------------|----------------------------------|
   | NGROK_API_KEY           | Your ngrok API key (from ngrok dashboard) |
   | GITHUB_PAT              | GitHub Personal Access Token (with repo & admin:repo_hook permissions) |
   | GITHUB_OWNER            | Your GitHub username or org name |
   | GITHUB_REPO             | The name of your GitHub repo |
   | WEBHOOK_ID              | The ID of your GitHub webhook (see below) |
   | WEBHOOK_SECRET          | The secret you set for your webhook (make up a strong password) |
   | CACHE_DURATION_MS       | How long to cache the ngrok URL (default: 3600000) |
   | APP_DIR                 | The folder where your API code lives (e.g. /home/pi/auto-depi) |
   | APP_SERVICE             | The name of your systemd service (e.g. my-api-app.service) |
   | APP_START_CMD           | How to start your app (e.g. "npm start" or "python3 main.py") |
   | NODE_PATH               | Path to node (default: /usr/bin/node) |
   | WEBHOOK_UPDATE_INTERVAL | How often to update the webhook (e.g. 5m for 5 minutes) |
   | GITHUB_SECRET           | The secret for verifying GitHub webhook payloads (should match WEBHOOK_SECRET) |
   | PORT                    | The port for the Express server (default: 3000) |

**How to find your webhook ID:**
- Go to your repo on GitHub > Settings > Webhooks > Click your webhook > The URL will end with `/hooks/12345678` (that number is your ID).

---

## Step 4: Start ngrok

You need ngrok running to expose your API to the internet. In a new terminal:

```sh
ngrok http 3000
```

- Copy the HTTPS URL ngrok gives you (e.g. `https://abc123.ngrok.io`).
- You'll use this for your GitHub webhook URL (see below).

> **IMPORTANT ngrok Free Tier Note:**
>
> The ngrok free tier only allows **one HTTPS endpoint per account**. This means:
> - If your API and this webhook server are running as separate servers, only one can be exposed at a time.
> - To work around this, you should **combine the webhook logic directly into your API server** (so both your API and the webhook endpoint share the same ngrok URL and port).
> - If you want to keep them separate, you will need a paid ngrok account or use a different tunneling solution.
>
> **How to combine FastAPI and Node Express under one URL:**
>
> You can run your FastAPI app (Python, e.g. on port 8000) and your Node Express server (e.g. on port 3000) on the same machine, and use Express to proxy requests to FastAPI. This way, both your webhook and your API are available under the same ngrok URL.
>
> Here is an example of how to do this in your Express server:
>
> ```js
> // In your Node Express server (example-server.js)
> const { createProxyMiddleware } = require('http-proxy-middleware');
> const axios = require('axios');
> 
> async function mountFastApiRoutes() {
>     try {
>         const res = await axios.get('http://0.0.0.0:8000/openapi.json');
>         const paths = Object.keys(res.data.paths);
>         
>         paths.forEach((path) => {
>             const expressPath = `/api/fastapi${path}`.replace(/\/+/g, '/'); // avoid double slashes
> 
>             app.use(expressPath, createProxyMiddleware({
>                 target: 'http://0.0.0.0:8000',
>                 changeOrigin: true,
>                 pathRewrite: {
>                     [`^/api/fastapi${path}`]: path
>                 },
>                 onProxyReq(proxyReq, req) {
>                     proxyReq.setHeader('X-Request-ID', req.id);
>                 }
>             }));
> 
>             console.log(`Mounted FastAPI route: ${expressPath} -> ${path}`);
>         });
> 
>     } catch (err) {
>         console.error('Failed to load FastAPI OpenAPI spec', err.message);
>     }
> }
> 
> // Call the mount function after your Express app is set up
> mountFastApiRoutes();
> ```
>
> - This code uses `http-proxy-middleware` and `axios` (install with `npm install http-proxy-middleware axios`).
> - It fetches the FastAPI OpenAPI spec, then dynamically mounts all FastAPI routes under `/api/fastapi/...` in your Express app.
> - Now, both your webhook endpoint and your FastAPI API are available under the same ngrok URL and port!
> - You can adjust the prefix (`/api/fastapi`) as needed.
> 
> This is a great way to work around the ngrok free tier limitation and keep everything simple for development and testing.

---

## Step 5: Set Up Your GitHub Webhook

1. Go to your repo on GitHub > Settings > Webhooks > Add webhook
2. **Payload URL:** `https://<your-ngrok-subdomain>.ngrok.io/webhook`
3. **Content type:** `application/json`
4. **Secret:** Use the same value as `WEBHOOK_SECRET` in your `.env`
5. **Events:** Just the ones you want (usually "push")
6. **Active:** Yes
7. Click **Add webhook**

---

## Step 6: Run the Server

In your `auto-depi` folder, run:

```sh
node example-server.js
```

- You should see: `Server listening on port 3000` (or your chosen port)
- Leave this running! (Or use systemd below to run in the background)

---

## Step 7: Test Your Setup

- Make a change in your GitHub repo and push it.
- You should see output in your raspberry pi terminal showing a git pull and a service restart.
- If you get errors, check your `.env` values and logs.

---

## Step 8: (Recommended) Run as a Service with systemd

This will make sure your server runs in the background and restarts if your Pi reboots.

### 1. Create a systemd service file

```sh
sudo nano /etc/systemd/system/auto-depi.service
```
Paste this in (edit paths if needed):
```ini
[Unit]
Description=Auto-Depi Webhook Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/pi/auto-depi
EnvironmentFile=/home/pi/auto-depi/.env
ExecStart=/usr/bin/node index.js
Restart=always
User=pi

[Install]
WantedBy=multi-user.target
```

### 2. Enable and start the service
```sh
sudo systemctl daemon-reload
sudo systemctl enable auto-depi.service
sudo systemctl start auto-depi.service
```

### 3. Check status and logs
```sh
sudo systemctl status auto-depi.service
sudo journalctl -u auto-depi.service -f
```

---

## Step 9: (Optional) Auto-Update Webhook with a Timer

If your ngrok URL changes, you want your GitHub webhook to update automatically.

### 1. Create a systemd service for the updater
```sh
sudo nano /etc/systemd/system/update-webhook.service
```
Paste this in:
```ini
[Unit]
Description=Update GitHub Webhook

[Service]
Type=oneshot
WorkingDirectory=/home/pi/auto-depi
EnvironmentFile=/home/pi/auto-depi/.env
ExecStart=/usr/bin/node updateWebhook.js
User=pi
```

### 2. Create a timer
```sh
sudo nano /etc/systemd/system/update-webhook.timer
```
Paste this in:
```ini
[Unit]
Description=Run webhook updater every interval

[Timer]
OnBootSec=1min
OnUnitActiveSec=5m
Unit=update-webhook.service

[Install]
WantedBy=timers.target
```

### 3. Enable and start the timer
```sh
sudo systemctl daemon-reload
sudo systemctl enable update-webhook.timer
sudo systemctl start update-webhook.timer
```

---

## Step 10: Troubleshooting & FAQ

- **Nothing happens when I push to GitHub:**
  - Check your webhook delivery logs on GitHub (Settings > Webhooks > Recent Deliveries)
  - Make sure your server is running and accessible from the internet (ngrok must be running)
  - Check your `.env` values for typos
- **Webhook signature errors:**
  - Make sure `WEBHOOK_SECRET` in `.env` matches the secret in your GitHub webhook settings
- **Service won't start:**
  - Run `node index.js` manually to see errors
  - Check logs with `journalctl -u auto-depi.service -f`
- **ngrok URL keeps changing:**
  - Use the systemd timer to auto-update the webhook
- **I don't know my webhook ID:**
  - Go to GitHub > Settings > Webhooks > Click your webhook > Look at the URL in your browser
- **I'm lost:**
  - Read each step carefully. Don't skip anything. Ask for help if you need it!

---

## Step 11: Updating Your Code

- To update this tool, just pull the latest code:
  ```sh
  cd /home/pi/auto-depi
  git pull
  npm install
  sudo systemctl restart auto-depi.service
  ```

---

## Step 12: Uninstalling

- To stop and remove the service:
  ```sh
  sudo systemctl stop auto-depi.service
  sudo systemctl disable auto-depi.service
  sudo rm /etc/systemd/system/auto-depi.service
  ```
- To remove the code:
  ```sh
  cd ~
  rm -rf /home/pi/auto-depi
  ```

---

## Need Help?

- Double-check every step.
- Google error messages.
- Ask a friend or on Stack Overflow.
- If you're really stuck, open an issue on the repo!

---

## License
MIT
