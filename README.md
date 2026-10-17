# OmaSend Web - PWA Client

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

> Pair a phone or laptop browser with your OmaSend desktop by scanning a QR code, then send it files and clipboard text, end-to-end encrypted. Nothing to install. **Receiving is not possible from a browser**: to receive, use the OmaSend desktop panel or the Android app.

---

## How it works

The OmaSend desktop engine serves this app itself at `http://<desktop-lan-ip>:53317/web/`. The app only ever talks to the engine that served it (same origin, `connect-src 'self'`).

1. **Pair.** On the desktop, choose "Pair a device". The QR code contains
   `http://<ip>:53317/web/#pair=<omasend://pair?v=2&pk=…&s=…>`. Scan it with the phone's camera; the page opens, removes the link from the address bar and asks *"Pair with <desktop> (device id XXXX-XXXX-XXXX-XXXX)?"*. Check that the ID matches the desktop's screen. You can also paste the link, or scan in-page where the browser has `BarcodeDetector`.
2. **Send files.** Drop or pick files. The desktop asks its user for approval (unless it trusts this browser as one of its own devices); the page shows "Waiting for approval", then encrypts and uploads each file with progress.
3. **Send text.** Type or paste text and send it to the desktop clipboard.

It implements [OmaSend protocol v2](https://github.com/ozdil/omarchy-omasend/blob/main/PROTOCOL_V2.md), Phase 1:

- The browser has its own Ed25519 device key (random 32-byte seed). Its device ID is the first 8 bytes of SHA-256(public key).
- Pairing: `POST /api/v2/pair` with an HMAC over both public keys (keyed with the QR secret) and an Ed25519 signature. The desktop's answer must come from the key in the QR code and be signed by it, or nothing is stored.
- Every request to `/api/p2p/*` is signed (`X-OmaSend-Pk`, `-Ts`, `-Nonce`, `-Sig`) over method, path and query exactly as sent, timestamp, nonce and a SHA-256 body tag (`stream:<size>` for uploads).
- **End-to-end encryption** (`omasend-web-e2e-v1`, see PROTOCOL_V2.md "Browser end-to-end encryption"): the desktop publishes an X25519 key signed by the Ed25519 key pinned at pairing. For every request the browser makes a fresh X25519 key, derives a key with HKDF-SHA256 and encrypts the transfer metadata, the clipboard text and each file (64 KiB chunks, counter nonce with a final-chunk flag) with ChaCha20-Poly1305. The desktop decrypts, verifies and only then saves. File names travel only inside the envelope (padded to 256-byte steps); uploads are addressed by index. The pairing signature covers the `client: "web"` field, so the desktop cannot be tricked into treating a browser key as a native one. A desktop that does not offer the key gets nothing: there is no plaintext fallback.
- Crypto is pure JavaScript ([@noble/curves](https://github.com/paulmillr/noble-curves), [@noble/ciphers](https://github.com/paulmillr/noble-ciphers), [@noble/hashes](https://github.com/paulmillr/noble-hashes); audited, pinned), because a page on `http://192.168.x.y` is not a secure context and has no WebCrypto. The same test vectors as the desktop engine are checked in `test/protocol.test.ts` and `test/e2e.test.ts`.

## Security and privacy: what to know

- **What you send is encrypted end to end** for the paired desktop; someone on the network sees that a transfer happens, the file sizes and the length of the text in 256-byte steps, nothing more. **The page itself still loads over plain HTTP.** An active attacker on your network could serve a modified page while you load it, so open and pair only on a network you trust (a fixed, installable page is on the roadmap).
- **The device key is stored unencrypted** in this browser's profile (IndexedDB). Anyone who can access the browser profile can copy it and send to your desktop as this browser. **Settings → "Forget this browser"** deletes the key, name and pairing. Also remove the browser from the desktop's paired devices.
- "This is my device / Someone else's" when pairing only sets a label in the browser. The desktop decides its own trust level for the browser.
- No analytics, no third-party requests. A strict Content Security Policy is set in `index.html`.
- The service worker (offline shell) only registers in a secure context (e.g. `localhost`); on a LAN `http://` address it is skipped.

---

## Multi-Platform Ecosystem Links

- **Omarchy Linux Desktop Plugin:** [ozdil/omarchy-omasend](https://github.com/ozdil/omarchy-omasend)
- **Android Companion App:** [ozdil/omasend-android](https://github.com/ozdil/omasend-android)
- **Google Play Closed Beta:** [Join Google Group](https://groups.google.com/g/omasend-testers) & [Opt-in on Google Play](https://play.google.com/apps/testing/io.omarchy.omasend)

---

## Development and Build

Prerequisites: Node.js 22 and `npm`.

```bash
npm ci
npx tsc --noEmit     # type check
npx vitest run       # unit tests (protocol test vectors, link parsing, canonical strings)
npm run build        # static output in dist/, served by the engine under /web/
```

`npm run build && npm run mock` starts `e2e/mock-engine.mjs`: it serves `dist/` under `/web/`, implements the endpoints above (verifying every MAC, signature and body tag) and prints a pairing link to open in a browser. `GET /__mock/state` shows what it received.

`npm run dev` proxies `/api` to `http://127.0.0.1:53317` (override with `OMASEND_ENGINE=http://…`).

The app version (UI and service-worker cache name) comes from `package.json`.

---

## License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.
