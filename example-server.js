const express = require("express");
const crypto = require("crypto");
const { exec } = require("child_process");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Use raw body for /webhook, normal JSON for others
app.use((req, res, next) => {
  if (req.path === "/webhook") {
    bodyParser.json({ verify: rawBodySaver })(req, res, next);
  } else {
    bodyParser.json()(req, res, next);
  }
});

function rawBodySaver(req, res, buf, encoding) {
  req.rawBody = buf;
}

const SECRET = process.env.GITHUB_SECRET || process.env.WEBHOOK_SECRET || "mysecret";
const REPO_PATH = process.env.APP_DIR || "/home/pi/auto-depi";
const SERVICE_NAME = process.env.APP_SERVICE || "fastapi.service";

function verifySignature(req) {
  const signature = req.headers["x-hub-signature-256"];
  if (!signature) return false;
  const hmac = crypto.createHmac("sha256", SECRET);
  const digest = "sha256=" + hmac.update(req.rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch {
    return false;
  }
}

app.post("/webhook", (req, res) => {
  if (!verifySignature(req)) {
    return res.status(401).send("Invalid signature");
  }

  // Pull latest code
  exec("git pull", { cwd: REPO_PATH }, (err, stdout, stderr) => {
    if (err) {
      console.error("Git pull failed:", stderr);
      return res.status(500).send("Git pull error");
    }

    console.log("Git pull success:", stdout);

    // Restart FastAPI (or other) server
    exec(`systemctl restart ${SERVICE_NAME}`, (err, stdout, stderr) => {
      if (err) {
        console.error("Failed to restart service:", stderr);
        return res.status(500).send("Service restart error");
      }

      console.log("Service restarted:", stdout);
      res.status(200).send("OK");
    });
  });
});

// GET /refresh-webhook endpoint
app.get("/refresh-webhook", async (req, res) => {
  try {
    // Dynamically import ESM updateWebhook.js
    const { getOrUpdateEndpoint } = await import("./updateWebhook.js");
    const url = await getOrUpdateEndpoint();
    if (url) return res.json({ success: true, url });
    res.status(500).json({ success: false, error: "Failed to refresh" });
  } catch (e) {
    console.error("[refresh-webhook] Error:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`POST /webhook for GitHub webhooks`);
  console.log(`GET /refresh-webhook to refresh ngrok webhook`);
}); 