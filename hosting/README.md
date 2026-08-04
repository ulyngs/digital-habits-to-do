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

## Secrets (production)

Amplify WEB_COMPUTE does **not** inject Console environment variables into the
Node runtime. Do **not** put Basecamp client secrets in Amplify env vars (they
can end up in deploy artifacts).

Production credentials are loaded at request time from **AWS Secrets Manager**,
using temporary credentials from an **Amplify SSR Compute IAM role**.

### 1. Create the secret

Create a JSON secret named `digital-habits-todo/basecamp` in the same region as
the Amplify app:

```bash
aws secretsmanager create-secret \
  --name digital-habits-todo/basecamp \
  --secret-string '{
    "BC_CLIENT_ID":"...",
    "BC_CLIENT_SECRET":"...",
    "BC_DEV_CLIENT_SECRET":"..."
  }'
```

To rotate later:

```bash
aws secretsmanager put-secret-value \
  --secret-id digital-habits-todo/basecamp \
  --secret-string '{
    "BC_CLIENT_ID":"...",
    "BC_CLIENT_SECRET":"...",
    "BC_DEV_CLIENT_SECRET":"..."
  }'
```

The secret id defaults to `digital-habits-todo/basecamp` in code. For local
testing against Secrets Manager you can override with `BC_SECRETS_NAME=...`.

### 2. Create the SSR Compute IAM role

In IAM, create a role Amplify can assume:

**Trust policy**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "amplify.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

**Permissions** (least privilege — replace account/region/secret ARN as needed)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "arn:aws:secretsmanager:REGION:ACCOUNT_ID:secret:digital-habits-todo/basecamp-*"
    }
  ]
}
```

### 3. Attach the role in Amplify

1. Amplify console → this hosting app → **App settings** → **IAM roles**
2. Under **Compute role**, choose the role from step 2 → **Save**

Compute role changes take effect on the **next deployment**, so attach the role
before deploying the Secrets Manager code changes (or redeploy after attaching).

### 4. Remove secret Amplify env vars

After the Secrets Manager deploy is live, delete any `BC_CLIENT_ID`,
`BC_CLIENT_SECRET`, and `BC_DEV_CLIENT_SECRET` values from Amplify Console env
vars so they are not copied into build artifacts.

## Amplify setup (console)

1. Create a new **Amplify Hosting** app connected to this GitHub repo.
2. Set the app root / monorepo directory to **`hosting`** (so Amplify uses `hosting/amplify.yml`).
3. Ensure the platform supports SSR / compute (WEB_COMPUTE), not static-only.
4. Create the Secrets Manager secret and SSR Compute IAM role (see above), then
   attach the Compute role in Amplify.
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
2. Store Basecamp credentials in Secrets Manager; attach SSR Compute IAM role.
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
