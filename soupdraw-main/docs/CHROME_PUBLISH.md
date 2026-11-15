# Publishing SoupDraw to the Chrome Web Store (CLI)

The package upload + publish is fully scriptable, like the AMO flow. The only
extra friction vs Firefox is a **one-time OAuth setup** (Chrome uses a refresh
token; AMO uses a simple JWT issuer/secret).

## Scripts

```sh
npm run build:chrome     # stage build/chrome + zip web-ext-artifacts/soupdraw-chrome-<ver>.zip
npm run upload:chrome    # upload a new package as a DRAFT (review it in the dashboard, publish manually)
npm run publish:chrome   # upload + submit for publishing (--auto-publish)
```

Both `upload`/`publish` read four secrets from `.env` (gitignored, never commit —
same file as the AMO keys):

```sh
CHROME_EXTENSION_ID=...      # the item ID from the Web Store dashboard
CHROME_CLIENT_ID=...
CHROME_CLIENT_SECRET=...
CHROME_REFRESH_TOKEN=...
```

## One-time setup

1. **Register as a Chrome Web Store developer** ($5 one-time) at
   <https://chrome.google.com/webstore/devconsole>.

2. **Create the item once, in the dashboard.** Upload
   `web-ext-artifacts/soupdraw-chrome-1.0.0.zip` manually, then fill the store
   LISTING there: description, screenshots (reuse `docs/screenshots/`), category,
   and the **Privacy practices** tab (declare camera use + link `PRIVACY.md`;
   justify the broad host access — on-device, no runtime network). The API/CLI
   uploads the *package* and flips *publish*, but it does **not** set listing
   content — so this first pass is manual. Copy the **Item ID** → `CHROME_EXTENSION_ID`.

3. **Generate the OAuth keys.** Easiest path — the official companion walks you
   through enabling the Chrome Web Store API, creating an OAuth client, and
   minting a refresh token:

   ```sh
   npx chrome-webstore-upload-keys
   ```

   It prints `clientId`, `clientSecret`, `refreshToken` → put them in `.env` as
   the three `CHROME_*` values above. (Manual alternative: Google Cloud Console →
   enable "Chrome Web Store API" → create an OAuth **Desktop app** client → mint a
   refresh token with scope `https://www.googleapis.com/auth/chromewebstore`. The
   old `urn:...:oob` flow is deprecated; use the Desktop-app loopback client.)

## After setup

Every future release is one command:

```sh
# bump "version" in package.json AND manifest.chrome.json first, then:
npm run publish:chrome
```

Note: Chrome Web Store review of a `getUserMedia` patch across `<all_urls>` +
camera is stricter than AMO — expect a slower first review, not a rejection.
Keep the reviewer justification consistent with the AMO notes.

## Wired (2026) — one-command releases

`npm run publish:chrome` is live. `.env` holds `CHROME_EXTENSION_ID`
(`ffaehhhleheoldlkdhhghjhlcdmdcbom`) + `CHROME_CLIENT_ID` / `CHROME_CLIENT_SECRET`
/ `CHROME_REFRESH_TOKEN` (Desktop-app OAuth client in Google Cloud project
999717272606, Chrome Web Store API enabled). Refresh tokens don't expire unless
revoked. Future release: bump versions, then `npm run publish:chrome`.
