# Microsoft Store CI submit (ReDD To-Do)

On tag pushes (`v*`) and optional manual Release builds, GitHub Actions builds
an unsigned Store `.msix` and submits it to Partner Center with What’s new text
from [`changelog.md`](../changelog.md). Partner Center re-signs on ingest.

The Store submit job is independent of the GitHub Release / Mac App Store jobs:
a Partner Center outage does not block creating the Release or submitting to
App Store Connect (and vice versa).

## What goes into Windows "What's new"

[`scripts/changelog-to-store-whats-new.js`](../scripts/changelog-to-store-whats-new.js)
is run with `--platform windows`. It keeps:

- Shared bullets (directly under `## vX.Y.Z` or thematic `###` sections), and
- Bullets under `#### Windows` (only present when there are Windows-only notes).

It drops `#### macOS` / `#### Linux`, `Version:` lines, and
release-engineering bullets (CI / Store submit / Partner Center). Output always
uses the fixed intro + bullets + sign-off, capped at Partner Center’s 10,000
character limit.

Mac App Store uses the same script with `--platform macos` — see
[`mac-app-store-ci.md`](mac-app-store-ci.md).

## One-time Partner Center / Entra setup

App update APIs are supported for **free** Store products. Confirm ReDD To-Do
is free to download before relying on this path.

You can **reuse the same Entra app** already set up for ReDD Blocker (Manager
role on the Partner Center account). Only `MS_STORE_PRODUCT_ID` must be
To-Do’s Store ID.

1. In [Partner Center](https://partner.microsoft.com/), ensure a Microsoft Entra
   tenant is associated with the account.
2. Reuse (or create) an Entra app registration → client ID, tenant ID, client
   secret. Assign **Manager** under Partner Center → User management →
   Microsoft Entra applications.
3. Copy **Seller ID** (Account settings → Identifiers). It is a **number**
   (digits only) — not the Publisher GUID, not `CN=…`, not the Store `9…` ID.
4. Copy ReDD To-Do’s **Store ID** (`9…` from the product identity / Store URL).

## GitHub Actions secrets (`ulyngs/redd-todo`)

| Secret | Source |
| --- | --- |
| `WINDOWS_IDENTITY_NAME` | Partner Center package identity (e.g. `ReduceDigitalDistraction.ReDDTodo`) |
| `WINDOWS_PUBLISHER` | Publisher CN from Partner Center |
| `WINDOWS_PUBLISHER_DISPLAY_NAME` | Publisher display name |
| `AZURE_AD_TENANT_ID` | Entra Directory (tenant) ID — same as Blocker if reusing |
| `AZURE_AD_APPLICATION_CLIENT_ID` | Entra Application (client) ID |
| `AZURE_AD_APPLICATION_SECRET` | Entra client secret |
| `SELLER_ID` | Partner Center **Seller ID** (numeric, e.g. `1234567`) |
| `MS_STORE_PRODUCT_ID` | **To-Do** Store product ID (`9…`) |

## Workflow behaviour

[`Release build`](../.github/workflows/release.yml):

- **Tag push `v*`:** builds x64 MSIX, creates a GitHub Release, submits to the
  Store (when secrets are set).
- **Manual run:** checkboxes for GitHub Release, Microsoft Store submit, and
  Mac App Store submit (all default on).

Flow inside [`scripts/submit-microsoft-store.ps1`](../scripts/submit-microsoft-store.ps1):

1. Bundle `.msix` into `.msixbundle` (`makeappx`).
2. Build What’s new
   ([`scripts/changelog-to-store-whats-new.js`](../scripts/changelog-to-store-whats-new.js)
   `--platform windows`) — friendly intro + product bullets + sign-off.
3. `msstore publish <bundle> -id <productId> -nc` (upload only).
4. Stamp `releaseNotes` + mark superseded packages `PendingDelete` →
   `msstore submission update`.
5. `msstore submission publish` (commit for certification).

## Local dry-run (credentials)

```powershell
msstore reconfigure `
  --tenantId $env:AZURE_AD_TENANT_ID `
  --sellerId $env:SELLER_ID `
  --clientId $env:AZURE_AD_APPLICATION_CLIENT_ID `
  --clientSecret $env:AZURE_AD_APPLICATION_SECRET

msstore apps list
msstore submission get $env:MS_STORE_PRODUCT_ID
```

Preview What’s new without submitting:

```bash
VERSION="$(node -p "require('./package.json').version")"
node scripts/changelog-to-store-whats-new.js "$VERSION" --platform windows
```

## Retry submit without rebuilding

Actions → **Microsoft store submission** → Run workflow with the release tag
(e.g. `v2.7.8`). Downloads `.msix` from the GitHub Release and re-runs submit.

Workflow: [`.github/workflows/store-submit.yml`](../.github/workflows/store-submit.yml).

## Manual fallback

Upload the Release’s `.msix` by hand in Partner Center → Packages if CI submit
secrets are missing.
