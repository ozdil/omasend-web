# OmaSend Web - PWA Client (preview)

<p align="center">
  <img src="public/icon-512.png" alt="OmaSend Web Logo" width="160" height="160" />
</p>

<p align="center">
  <a href="https://github.com/ozdil/omasend-web/releases"><img src="https://img.shields.io/github/v/release/ozdil/omasend-web?style=for-the-badge&logo=typescript&color=38BDF8" alt="Latest release" /></a>
  <a href="https://github.com/ozdil/omarchy-omasend"><img src="https://img.shields.io/badge/Omarchy%20Linux-Desktop%20Plugin-00ADD8?style=for-the-badge&logo=archlinux&logoColor=white" alt="Omarchy Linux Desktop Plugin" /></a>
  <a href="https://github.com/ozdil/omasend-android"><img src="https://img.shields.io/badge/Android-Companion%20App-34A853?style=for-the-badge&logo=android&logoColor=white" alt="Android Companion App" /></a>
  <a href="https://buymeacoffee.com/ozdil"><img src="https://img.shields.io/badge/Buy_Me_A_Coffee-Support-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me A Coffee" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="MIT License" /></a>
</p>

> **Status: preview.** The web client currently shows the status of a configured OmaSend engine and the devices that engine has discovered. **Sending files, clipboard sync and pairing are not available from the browser yet.** Use the OmaSend desktop panel or the OmaSend Android app for those.

---

## What it does today

- Installable Progressive Web App (PWA) for modern browsers.
- Reads `GET /api/status` and `GET /api/p2p/peers` from an OmaSend engine and shows only the values the engine actually returns.
- Service worker: network-first for the page itself (so updates arrive), cache-first only for hashed build assets, offline fallback to the last cached page.

## What it does not do (yet)

- No file transfer, no clipboard sync, no QR pairing, no device pairing.
- No end-to-end encryption claims. The rendezvous helpers in `src/core/crypto/web_crypto.ts` derive keys from OmaIDs, which are not secret, so they only obfuscate rendezvous records.

---

## Multi-Platform Ecosystem Links

- **Omarchy Linux Desktop Plugin:** [ozdil/omarchy-omasend](https://github.com/ozdil/omarchy-omasend)
- **Android Companion App:** [ozdil/omasend-android](https://github.com/ozdil/omasend-android)
- **Google Play Closed Beta:** [Join Google Group](https://groups.google.com/g/omasend-testers) & [Opt-in on Google Play](https://play.google.com/apps/testing/io.omarchy.omasend)

---

## Development and Build

### Prerequisites
- Node.js 22 and `npm`

### Engine URL

The client never guesses where the engine is. Set it explicitly at build or dev time:

```bash
VITE_OMASEND_ENGINE_URL=http://127.0.0.1:53317 npm run dev
```

Without it, a production build served by the engine itself talks to its own origin; under `npm run dev` the page shows "Engine URL not configured". Note that browsers block requests from an `https://` page to `http://` engines (mixed content) and the engine must allow the page's origin via CORS.

### Local Development Server
```bash
npm ci
npm run dev
```

### Production Build
```bash
npm run build
```
The static output is generated in `dist/` (not committed). The app version shown in the UI and the service worker cache name come from `package.json`.

---

## Security & Privacy

- All cryptographic helpers run in the browser via the Web Crypto API; the current UI does not transmit files or clipboard contents anywhere.
- The browser's local ID and any stored data live in `localStorage` in plain text.
- A strict Content Security Policy is set in `index.html` (no inline scripts, connections limited to the page origin and local engines).

---

## License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.
