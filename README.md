# OmaSend Web - Zero-Knowledge E2EE PWA Client

<p align="center">
  <img src="public/icons/icon-512x512.png" alt="OmaSend Web Logo" width="160" height="160" />
</p>

<p align="center">
  <a href="https://github.com/ozdil/omasend-web/releases"><img src="https://img.shields.io/badge/Release-v1.7.1-38BDF8?style=for-the-badge&logo=typescript" alt="Release v1.7.1" /></a>
  <a href="https://github.com/ozdil/omarchy-omasend"><img src="https://img.shields.io/badge/Omarchy%20Linux-Desktop%20Plugin-00ADD8?style=for-the-badge&logo=archlinux&logoColor=white" alt="Omarchy Linux Desktop Plugin" /></a>
  <a href="https://github.com/ozdil/omasend-android"><img src="https://img.shields.io/badge/Android-Companion%20App-34A853?style=for-the-badge&logo=android&logoColor=white" alt="Android Companion App" /></a>
  <a href="https://buymeacoffee.com/ozdil"><img src="https://img.shields.io/badge/Buy_Me_A_Coffee-Support-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me A Coffee" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="MIT License" /></a>
</p>

> **Zero-installation, browser-based sovereign file transfer, encrypted clipboard vault, and 16-digit Luhn OmaID pairing with client-side Web Crypto AES-256-GCM encryption for all modern browsers.**

---

## Key Features

- **Zero Installation & Universal Access:**
  - Fully functional Progressive Web App (PWA) running directly inside modern browsers (Chrome, Firefox, Safari, Edge) on Linux, Windows, macOS, iOS, and Android.
  - Offline-first Service Worker architecture for instant loading.
- **Client-Side Web Crypto API Architecture:**
  - Hardware-accelerated client-side AES-256-GCM encryption and decryption (`crypto.subtle`).
  - RFC 2104 HMAC-SHA256 Blinded Rendezvous topics and RFC 5869 HKDF-SHA256 symmetric key derivation.
  - Session keys are strictly passed via URL hash fragments (`#key=...`), never reaching HTTP headers or web server logs.
- **16-Digit Luhn Mod 10 OmaID Pairing:**
  - Zero-account, zero-server pairing: generates and verifies 16-digit device identifiers (`XXXX-XXXX-XXXX-XXXX`).
  - Seamlessly pairs with Omarchy Linux desktop and OmaSend Android mobile clients.
- **Liquid Drag-and-Drop File Portal:**
  - Fast chunked streaming file upload and download with real-time transfer progress, speed metrics, and SHA-256 integrity verification.
- **Live Clipboard Vault:**
  - Text and WebP image clipboard transfer between browser and native devices with 1-click copying.
- **Dark Acrylic Glassmorphism UI:**
  - Fluid dark UI design (`backdrop-filter: blur(16px)`), specular borders, and `JetBrainsMono Nerd Font` typography.

---

## Multi-Platform Ecosystem Links

- **Omarchy Linux Desktop Plugin:** [ozdil/omarchy-omasend](https://github.com/ozdil/omarchy-omasend)
- **Android Companion App:** [ozdil/omasend-android](https://github.com/ozdil/omasend-android)
- **Google Play Closed Beta:** [Join Google Group](https://groups.google.com/g/omasend-testers) & [Opt-in on Google Play](https://play.google.com/apps/testing/io.omarchy.omasend)

---

## Development and Build

### Prerequisites
- Node.js 18+ and `npm`

### Local Development Server
```bash
npm install
npm run dev
```

### Production Build
```bash
npm run build
```
The optimized static distribution will be generated in `dist/`, ready to be served by any static web server or embedded directly inside the `omasend-engine` binary.

---

## Security & Privacy Policy

OmaSend Web operates strictly with **Zero-Knowledge, Client-Side Encryption**. All cryptographic operations occur exclusively in the user's browser sandbox via the Web Crypto API. No unencrypted files, clipboard contents, or cryptographic keys are ever transmitted to any central server.

---

## License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.
