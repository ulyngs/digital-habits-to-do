# Mac App Store CI submit (macOS)

On tag pushes (`v*`) and optional manual Release builds, GitHub Actions builds
the Mac App Store `.pkg` (`npm run build:mas` / `scripts/build-mas-package.js`)
and submits it to App Store Connect with What's new text from
[`changelog.md`](../changelog.md), then submits the version for review with
automatic release after approval.

The submit job is independent of the GitHub Release / Microsoft Store jobs: an
App Store Connect outage does not block Partner Center or GitHub distribution.

Local packaging docs (identities, profile, Transporter): [`releasing-mas.md`](releasing-mas.md).

## What goes into macOS "What's new"

[`scripts/changelog-to-store-whats-new.js`](../scripts/changelog-to-store-whats-new.js)
is run with `--platform macos`. It keeps:

- Shared bullets (directly under `## vX.Y.Z` or thematic `###` sections such as
  `### FOCUS MODE`), and
- Bullets under `#### macOS` (only present when there are mac-only notes).

It drops `#### Windows` / `#### Linux`, `Version:` lines, and
release-engineering bullets. Output always uses the fixed intro
(`Hi folks,` / `This update comes with some helpful improvements!`) + bullets +
sign-off, capped at the App Store's 4,000 character limit — never a custom
blockquote headline.

Other stores use the same script with `--platform windows` (shared +
`#### Windows`).

If a release has **no** macOS-facing bullets (Windows-only release), the
Publish (Mac App Store) job logs a notice and skips submission instead of
shipping empty notes.

## One-time App Store Connect API setup

1. In [App Store Connect](https://appstoreconnect.apple.com/) → Users and
   Access → **Integrations** → App Store Connect API → Team Keys, click **+**
   and create a key with at least **App Manager** (Admin also works).
2. Note the **Issuer ID** (shown above the keys table) and the new key's
   **Key ID**.
3. Download the `AuthKey_<KEYID>.p8` private key (one-time download).
4. Base64-encode it for the GitHub secret:
   `base64 -i AuthKey_XXXXXXXXXX.p8 | pbcopy`

You can reuse the same API key already used for ReDD Blocker iOS if it has
access to the Digital Habits: To-Do app record (`com.redd.do`).

## One-time Mac App Store signing secrets

CI needs the same materials as a local `npm run build:mas` (see
[`releasing-mas.md`](releasing-mas.md)):

1. Export **Apple Distribution** certificate + private key as a `.p12`.
2. Export **3rd Party Mac Developer Installer** certificate + private key as a
   `.p12` (separate file if Keychain Access exports them separately).
3. Download the Mac App Store **provisioning profile** for `com.redd.do`.
4. Base64-encode each file:
   ```bash
   base64 -i AppleDistribution.p12 | pbcopy
   base64 -i MacInstaller.p12 | pbcopy
   base64 -i ReDD_To_Do.provisionprofile | pbcopy
   ```

## GitHub Actions secrets (`ulyngs/redd-todo`)

| Secret | Source |
| --- | --- |
| `APP_STORE_CONNECT_API_KEY_ID` | API key's Key ID |
| `APP_STORE_CONNECT_API_ISSUER_ID` | Issuer ID |
| `APP_STORE_CONNECT_API_KEY_P8` | base64 of the `AuthKey_*.p8` file |
| `MAC_APP_STORE_CERTIFICATE_BASE64` | base64 of Apple Distribution `.p12` |
| `MAC_APP_STORE_CERTIFICATE_PASSWORD` | password for that `.p12` |
| `MAC_APP_STORE_INSTALLER_CERTIFICATE_BASE64` | base64 of 3rd Party Mac Developer Installer `.p12` |
| `MAC_APP_STORE_INSTALLER_CERTIFICATE_PASSWORD` | optional; defaults to cert password |
| `MAC_APP_STORE_PROVISIONING_PROFILE_BASE64` | base64 of the MAS provisioning profile |
| `KEYCHAIN_PASSWORD` | any strong password for the ephemeral CI keychain |
| `APPLE_APP_IDENTITY` | full string, e.g. `Apple Distribution: Reduce Digital Distraction Ltd (JD647S9RT6)` |
| `APPLE_INSTALLER_IDENTITY` | full string, e.g. `3rd Party Mac Developer Installer: Reduce Digital Distraction Ltd (JD647S9RT6)` |
| `ASC_PRIMARY_LOCALE` | optional; defaults to `en-GB`. Set only if App Store Connect Primary Language is not English (U.K.) |

Confirm **Primary Language** in App Store Connect → your app → **App
Information** before the first submit. Wrong locale can activate an empty
extra localization and fail review submission (missing description / keywords /
supportUrl / whatsNew).

## Promotional text and description

Listing copy lives in [`store-listing/`](../store-listing/)
(`promotional_text.txt` ≤170 chars; `description.txt`). Fastlane stamps both
on every Mac App Store submit so CI does not keep shipping leftover App Store
Connect text. Edit those files when the listing copy changes.

## Version and build numbers

`npm run build:mas` stamps `package.json` / `tauri.conf.json` version into the
app. App Store Connect requires a unique (version, build) pair per upload. If
an upload succeeded but you must upload a **new binary** for the same marketing
version, re-run Release build with the `mas_build_number` input set (e.g.
`2.7.8.1`) — that sets `CFBundleVersion` before codesign.

## Workflow behaviour

[`Release build`](../.github/workflows/release.yml):

- **Tag push `v*`:** builds the MAS `.pkg` and submits to App Store Connect
  (when signing + API secrets are set).
- **Manual run:** checkbox `submit_mac_app_store` (default on) gates the submit
  job; the `build-mac-app-store` job always runs and its `.pkg` is attached to
  the GitHub Release alongside the Windows `.msix`.

Flow inside [`fastlane/Fastfile`](../fastlane/Fastfile) (`submit_mac_app_store`
lane):

1. Authenticate with the App Store Connect API key.
2. **Fail-fast preflight:** if any Mac App Store version is already waiting
   for review, in review, or blocked by unresolved review issues, the lane
   exits before uploading. It does **not** auto-withdraw — fix App Store
   Connect manually, then re-run. (Prevents superseding an in-review version
   and attaching the wrong build.)
3. `deliver` with `platform: "osx"`: upload the `.pkg`, create/edit the App
   Store version matching `package.json`, set description, What's new, and
   promotional text on the primary locale (not deliver's `"default"` key) from
   [`store-listing/`](../store-listing/) + the generated What's new file, wait
   for the build to finish processing, and submit for review with
   `automatic_release: true` and export compliance pre-answered
   (`export_compliance_uses_encryption: false`).

## Retry submit without rebuilding

If the Mac App Store submit fails but the GitHub Release already has the `.pkg`
asset, use Actions → **Mac App Store submission** → Run workflow with the
release tag (e.g. `v2.7.8`). That checks out current `main` (so script fixes
apply), downloads the Release pkg, and re-runs submit — no rebuild.

Two modes:

- **Upload failed** (binary never reached App Store Connect): run with
  defaults; the Release pkg is uploaded and submitted.
- **Upload succeeded, submission failed** (binary already processed): check
  `skip_binary_upload`; the existing build is attached and submitted. Leave
  `build_number` blank to use the latest build for that version.

Workflow: [`.github/workflows/mac-app-store-submit.yml`](../.github/workflows/mac-app-store-submit.yml).

## Local dry-run

```bash
VERSION="$(node -p "require('./package.json').version")"

# Preview the macOS What's new for the current package.json version:
node scripts/changelog-to-store-whats-new.js "$VERSION" --platform macos

# Full manual submit from a Mac with fastlane + MAS signing identities installed.
# Fill in Key ID, Issuer ID, and the path to your downloaded AuthKey_*.p8:
export APP_STORE_CONNECT_API_KEY_ID="<Key ID from App Store Connect>"
export APP_STORE_CONNECT_API_ISSUER_ID="<Issuer ID from App Store Connect>"
export APP_STORE_CONNECT_API_KEY_P8="$(base64 -i /path/to/AuthKey_<KEYID>.p8)"
npm run build:mas
node scripts/changelog-to-store-whats-new.js "$VERSION" --platform macos --out whats_new_mas.txt
fastlane mac submit_mac_app_store "version:${VERSION}" "pkg:for-distribution/Digital-Habits-To-Do.pkg" notes:whats_new_mas.txt
```

## Manual fallback

If the secrets are missing, the Mac App Store jobs fail fast with a clear
message. You can still build locally (`npm run build:mas`) and upload with
Transporter, then fill in What's new by hand in App Store Connect — same as
before CI submit existed.
