import { Octokit } from "@octokit/rest";
import dotenv from "dotenv";
dotenv.config();

const fetch = global.fetch || (await import('node-fetch')).default;

let cachedUrl = null;
let cacheTimestamp = null;

const {
  NGROK_API_KEY,
  GITHUB_PAT,
  GITHUB_OWNER,
  GITHUB_REPO,
  WEBHOOK_ID,
  WEBHOOK_SECRET,
  CACHE_DURATION_MS = 3600000
} = process.env;

const octokit = new Octokit({ auth: GITHUB_PAT });

async function validateEndpoint(url) {
  try {
    const res = await fetch(`${url}/health`);
    if (!res.ok) return false;
    const json = await res.json();
    return json.status === "healthy";
  } catch (err) {
    console.warn("Health check failed:", err.message);
    return false;
  }
}

async function fetchNgrokEndpoint(retries = 3, backoff = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch("https://api.ngrok.com/tunnels", {
        headers: {
          Authorization: `Bearer ${NGROK_API_KEY}`,
          "Ngrok-Version": "2"
        }
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      const tunnel = data.tunnels.find(t => t.public_url.startsWith("https://"));
      return tunnel?.public_url || null;
    } catch (err) {
      console.warn(`Fetch attempt ${i + 1} failed: ${err.message}`);
      if (i < retries - 1) await new Promise(r => setTimeout(r, backoff));
      backoff *= 2;
    }
  }
  return null;
}

async function updateGitHubWebhook(newUrl) {
  try {
    await octokit.repos.updateWebhook({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      hook_id: Number(WEBHOOK_ID),
      config: {
        url: `${newUrl}/webhook`,
        content_type: "json",
        secret: WEBHOOK_SECRET,
        insecure_ssl: "0"
      }
    });
    console.log(`[updateWebhook] Updated webhook to ${newUrl}`);
  } catch (err) {
    console.error("[updateWebhook] Failed to update webhook:", err.message);
  }
}

export async function getOrUpdateEndpoint() {
  if (
    cachedUrl &&
    cacheTimestamp &&
    Date.now() - cacheTimestamp < Number(CACHE_DURATION_MS)
  ) {
    const stillValid = await validateEndpoint(cachedUrl);
    if (stillValid) {
      console.log("[getEndpoint] Using cached valid endpoint:", cachedUrl);
      return cachedUrl;
    }
  }
  const newUrl = await fetchNgrokEndpoint();
  if (!newUrl) {
    console.error("[getEndpoint] Could not fetch a valid ngrok HTTPS URL.");
    return null;
  }
  const isValid = await validateEndpoint(newUrl);
  if (!isValid) {
    console.error("[getEndpoint] New URL failed health check:", newUrl);
    return null;
  }
  if (newUrl !== cachedUrl) {
    await updateGitHubWebhook(newUrl);
  }
  cachedUrl = newUrl;
  cacheTimestamp = Date.now();
  return newUrl;
}

// Top-level await for CLI usage
if (process.argv[1] === (new URL(import.meta.url)).pathname) {
  getOrUpdateEndpoint()
    .then(url => {
      if (url) {
        console.log("[Main] Final endpoint:", url);
      } else {
        console.error("[Main] Failed to resolve and validate ngrok endpoint.");
      }
    })
    .catch(err => {
      console.error("[Main] Unexpected error:", err);
    });
} 