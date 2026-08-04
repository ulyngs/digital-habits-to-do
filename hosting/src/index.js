'use strict';

const express = require('express');
const {
    PROD_CLIENT_ID,
    REDIRECT_URI,
    exchangeToken,
    getLocalCallbackPort,
    buildLocalBridgePage,
    clientSecretFor
} = require('./basecamp');
const { ensureBasecampCredentials } = require('./secrets');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function requireBasecampCredentials(res) {
    try {
        await ensureBasecampCredentials();
        return true;
    } catch (error) {
        console.error('Failed to load Basecamp credentials:', error);
        res.status(500).json({
            error: 'Server misconfigured: unable to load Basecamp credentials'
        });
        return false;
    }
}

app.options('/api/auth', (req, res) => {
    setCors(res);
    res.status(204).end();
});

app.options('/api/exchange', (req, res) => {
    setCors(res);
    res.status(204).end();
});

app.get('/', (req, res) => {
    res
        .status(200)
        .type('text/plain')
        .send('Digital Habits: To-Do hosting — Basecamp OAuth at /api/auth, updater at /updates/');
});

// Token refresh (POST) — keeps client_secret server-side for the desktop app
app.post('/api/auth', async (req, res) => {
    setCors(res);

    try {
        const refreshToken = req.body && req.body.refresh_token;
        if (!refreshToken) {
            return res.status(400).json({ error: 'Missing refresh_token' });
        }

        if (!(await requireBasecampCredentials(res))) {
            return;
        }

        const clientId = process.env.BC_CLIENT_ID;
        const clientSecret = process.env.BC_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
            return res.status(500).json({ error: 'Server misconfigured: Missing Basecamp credentials' });
        }

        const tokenData = await exchangeToken({
            type: 'refresh',
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret
        });

        return res.status(200).json(tokenData);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

// OAuth callback (GET) — Basecamp redirects here with ?code=
app.get('/api/auth', async (req, res) => {
    const code = req.query.code;
    const state = req.query.state || '';

    if (!code) {
        return res.status(400).type('text/plain').send('Missing code parameter');
    }

    try {
        await ensureBasecampCredentials();
    } catch (error) {
        console.error('Failed to load Basecamp credentials:', error);
        return res
            .status(500)
            .type('text/plain')
            .send('Server misconfigured: unable to load Basecamp credentials');
    }

    const clientId = process.env.BC_CLIENT_ID;
    const clientSecret = process.env.BC_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        return res.status(500).type('text/plain').send('Server misconfigured: Missing Basecamp credentials');
    }

    try {
        const tokenData = await exchangeToken({
            type: 'web_server',
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: REDIRECT_URI
        });

        const params = new URLSearchParams({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_in: String(tokenData.expires_in)
        });

        const localhostPort = getLocalCallbackPort(state);
        if (localhostPort) {
            const localhostUrl = `http://127.0.0.1:${localhostPort}/callback?${params.toString()}`;
            const fallbackUrl = `reddtodo://oauth-callback?${params.toString()}`;
            res.setHeader('Cache-Control', 'no-store');
            return res.status(200).type('html').send(
                buildLocalBridgePage({
                    localhostUrl,
                    fallbackUrl,
                    success: true,
                    message: 'Sending Basecamp authentication back to Digital Habits: To-Do...'
                })
            );
        }

        return res.redirect(302, `reddtodo://oauth-callback?${params.toString()}`);
    } catch (error) {
        console.error('OAuth callback error:', error);
        const errorParams = new URLSearchParams({
            error: 'auth_failed',
            error_description: error.message
        });

        const localhostPort = getLocalCallbackPort(state);
        if (localhostPort) {
            const localhostUrl = `http://127.0.0.1:${localhostPort}/callback?${errorParams.toString()}`;
            const fallbackUrl = `reddtodo://oauth-callback?${errorParams.toString()}`;
            res.setHeader('Cache-Control', 'no-store');
            return res.status(200).type('html').send(
                buildLocalBridgePage({
                    localhostUrl,
                    fallbackUrl,
                    success: false,
                    message: 'Basecamp returned an authentication error.'
                })
            );
        }

        return res.redirect(302, `reddtodo://oauth-callback?${errorParams.toString()}`);
    }
});

// Dev-only code → token exchange (desktop debug builds use localhost redirect)
app.post('/api/exchange', async (req, res) => {
    setCors(res);

    try {
        const { code, redirect_uri: redirectUri, client_id: clientId } = req.body || {};
        if (!code) {
            return res.status(400).json({ error: 'Missing authorization code' });
        }

        if (!(await requireBasecampCredentials(res))) {
            return;
        }

        const resolvedClientId = clientId || PROD_CLIENT_ID;
        const clientSecret = clientSecretFor(resolvedClientId);
        if (!clientSecret) {
            return res.status(500).json({
                error: 'Server misconfigured: Missing client secret for this app'
            });
        }

        const tokenData = await exchangeToken({
            type: 'web_server',
            client_id: resolvedClientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            code
        });

        return res.status(200).json(tokenData);
    } catch (error) {
        console.error('Token exchange error:', error);
        return res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Digital Habits: To-Do hosting listening on port ${port}`);
});
