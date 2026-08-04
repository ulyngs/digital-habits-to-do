# Digital Habits: To-Do — Amplify hosting

Dedicated Amplify Hosting app for Basecamp OAuth and Tauri auto-updater files.

**Domain:** `https://todo.digitalhabits.org`

| Path | Role |
| --- | --- |
| `GET/POST /api/auth` | Basecamp OAuth callback + token refresh |
| `POST /api/exchange` | Dev code→token exchange |
| `/updates/...` | Static Tauri updater manifests / artifacts |

## Local development

```bash
cd hosting
npm install
BC_CLIENT_ID=... BC_CLIENT_SECRET=... BC_DEV_CLIENT_SECRET=... npm start
```

Build the Amplify deployment bundle:

```bash
npm run build
```

Artifacts land in `.amplify-hosting/` (gitignored).

## Amplify setup (console)

1. Create a new **Amplify Hosting** app connected to this GitHub repo.
2. Set the app root / monorepo directory to **`hosting`** (so Amplify uses `hosting/amplify.yml`).
3. Ensure the platform supports SSR / compute (WEB_COMPUTE), not static-only.
4. Add environment variables (copy from the old Netlify site):
   - `BC_CLIENT_ID`
   - `BC_CLIENT_SECRET`
   - `BC_DEV_CLIENT_SECRET`
5. Add custom domain **`todo.digitalhabits.org`** and create the DNS CNAME/ALIAS in the `digitalhabits.org` DNS zone.
6. Confirm after deploy:
   - `https://todo.digitalhabits.org/` returns the plain-text status line
   - `https://todo.digitalhabits.org/api/auth` without `code` returns 400

## Basecamp Launchpad

1. Add redirect URI: `https://todo.digitalhabits.org/api/auth`
2. Keep the old Netlify redirect URI until users have updated past the Netlify-pointing builds.
3. After the grace period, remove `https://redd-todo.netlify.app/.netlify/functions/auth`.

## Updater files

Tauri looks up:

`https://todo.digitalhabits.org/updates/{{target}}/{{arch}}/{{current_version}}`

Publish update manifests and installers under `public/updates/` (same layout as previously on Netlify), then redeploy this Amplify app — or upload into Amplify’s static output equivalently.

Migrate existing files from `https://redd-todo.netlify.app/updates/...` before tearing Netlify down, or existing installs cannot auto-update to the Amplify-aware build.

## Cutover checklist

1. Deploy this Amplify app and attach `todo.digitalhabits.org`.
2. Set Amplify env vars from Netlify.
3. Add the new Basecamp redirect URI (keep Netlify temporarily).
4. Copy `/updates` from Netlify into `public/updates/` (or equivalent static hosting) and redeploy.
5. Ship a desktop release that points at `todo.digitalhabits.org` (see app URL constants).
6. Keep Netlify live for a grace period so old installs can still refresh tokens / fetch updates.
7. Remove Netlify redirect from Basecamp, then delete the Netlify site.

## Desktop app URLs

Hardcoded in the Tauri app (must match this host):

- Prod redirect: `https://todo.digitalhabits.org/api/auth`
- Dev exchange: `https://todo.digitalhabits.org/api/exchange`
- Updater: `https://todo.digitalhabits.org/updates/...`
