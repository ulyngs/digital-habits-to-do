'use strict';

const https = require('https');

const PROD_CLIENT_ID = 'd83392d7842f055157c3fef1f5464b2e15a013dc';
const DEV_CLIENT_ID = 'aed7f4889aa6bb83b74e8e494e70701d59d1c9c5';
const REDIRECT_URI = 'https://todo.digitalhabits.org/api/auth';
const LOCAL_CALLBACK_STATE_PREFIX = 'localhost:';
const USER_AGENT = 'Digital-Habits-Todo-Auth-Service';

function exchangeToken(payload) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(payload);

        const options = {
            hostname: 'launchpad.37signals.com',
            path: '/authorization/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'User-Agent': USER_AGENT
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (error) {
                        reject(new Error(`Invalid JSON from Basecamp: ${error.message}`));
                    }
                } else {
                    reject(new Error(data || `Basecamp responded with status ${res.statusCode}`));
                }
            });
        });

        req.on('error', (error) => reject(error));
        req.write(postData);
        req.end();
    });
}

function getLocalCallbackPort(state) {
    if (!state || !state.startsWith(LOCAL_CALLBACK_STATE_PREFIX)) {
        return null;
    }

    const port = Number.parseInt(state.slice(LOCAL_CALLBACK_STATE_PREFIX.length), 10);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return null;
    }

    return port;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildLocalBridgePage({ localhostUrl, fallbackUrl, success, message }) {
    const safeLocalhostUrl = JSON.stringify(localhostUrl);
    const title = success ? 'Connecting Digital Habits: To-Do' : 'Authentication Issue';
    const primaryLabel = success ? 'Continue in Digital Habits: To-Do' : 'Return to Digital Habits: To-Do';
    const secondaryLabel = 'Use legacy fallback';

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f6f2ec;
        color: #1f2f38;
      }
      main {
        max-width: 36rem;
        margin: 10vh auto;
        background: rgba(255, 255, 255, 0.92);
        border-radius: 20px;
        padding: 2rem;
        box-shadow: 0 18px 50px rgba(17, 36, 48, 0.12);
        text-align: center;
      }
      h1 {
        margin-top: 0;
        font-size: 2rem;
      }
      p {
        line-height: 1.5;
      }
      a {
        display: inline-block;
        margin-top: 1rem;
        padding: 0.9rem 1.2rem;
        border-radius: 12px;
        background: #1f7a58;
        color: white;
        text-decoration: none;
        font-weight: 600;
      }
      .hint {
        margin-top: 1rem;
        font-size: 0.95rem;
        color: #5d6d75;
      }
      .secondary {
        display: inline-block;
        margin-top: 0.85rem;
        color: #5d6d75;
        text-decoration: underline;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p id="status">${escapeHtml(message)}</p>
      <a id="primary-link" href="${escapeHtml(localhostUrl)}">${escapeHtml(primaryLabel)}</a>
      <p class="hint">If nothing happens automatically, use the button above. The legacy fallback is only needed on older installs.</p>
      <a class="secondary" href="${escapeHtml(fallbackUrl)}">${escapeHtml(secondaryLabel)}</a>
    </main>
    <script>
      const localhostUrl = ${safeLocalhostUrl};
      const statusEl = document.getElementById('status');
      const primaryLink = document.getElementById('primary-link');

      function handoff() {
        statusEl.textContent = 'Handing off to the local app...';
        window.location.assign(localhostUrl);
      }

      window.addEventListener('pageshow', () => {
        setTimeout(handoff, 50);
      }, { once: true });

      setTimeout(() => {
        statusEl.textContent = 'If Digital Habits: To-Do did not open, use the button above.';
        primaryLink.focus();
      }, 1500);
    </script>
  </body>
</html>`;
}

function clientSecretFor(clientId) {
    if (clientId === DEV_CLIENT_ID) {
        return process.env.BC_DEV_CLIENT_SECRET;
    }
    return process.env.BC_CLIENT_SECRET;
}

module.exports = {
    PROD_CLIENT_ID,
    DEV_CLIENT_ID,
    REDIRECT_URI,
    exchangeToken,
    getLocalCallbackPort,
    buildLocalBridgePage,
    clientSecretFor
};
