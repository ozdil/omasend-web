# OmaSend Web - Sıfır Bilgili E2EE PWA Web İstemcisi

<p align="center">
  <img src="public/icons/icon-512x512.png" alt="OmaSend Web Logosu" width="160" height="160" />
</p>

<p align="center">
  <a href="https://github.com/ozdil/omasend-web/releases"><img src="https://img.shields.io/badge/S%C3%BCr%C3%BCm-v1.7.0-38BDF8?style=for-the-badge&logo=typescript" alt="Sürüm v1.7.0" /></a>
  <a href="https://github.com/ozdil/omarchy-omasend"><img src="https://img.shields.io/badge/Omarchy%20Linux-Masa%C3%BCst%C3%BC%20Eklentisi-00ADD8?style=for-the-badge&logo=archlinux&logoColor=white" alt="Omarchy Linux Eklentisi" /></a>
  <a href="https://github.com/ozdil/omasend-android"><img src="https://img.shields.io/badge/Android-Uygulama-34A853?style=for-the-badge&logo=android&logoColor=white" alt="Android Uygulaması" /></a>
  <a href="https://buymeacoffee.com/ozdil"><img src="https://img.shields.io/badge/Kahve_Ismarla-Destek-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Kahve Ismarla" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/Lisans-MIT-blue?style=for-the-badge" alt="MIT Lisansı" /></a>
</p>

> **Tüm modern tarayıcılarda kurulum gerektirmeyen, istemci taraflı Web Crypto AES-256-GCM şifrelemeli egemen dosya aktarımı, şifreli pano kasası ve 16 haneli Luhn OmaID eşleşmesi sunan PWA web istemcisi.**

---

## Öne Çıkan Özellikler

- **Sıfır Kurulum ve Evrensel Erişim:**
  - Linux, Windows, macOS, iOS ve Android üzerindeki modern web tarayıcılarında (Chrome, Firefox, Safari, Edge) doğrudan çalışan Kademeli Web Uygulaması (PWA).
  - Anında yükleme için çevrimdışı öncelikli Service Worker mimarisi.
- **İstemci Taraflı Web Crypto API Mimarisi:**
  - Donanım hızlandırmalı istemci taraflı AES-256-GCM şifreleme ve çözme (`crypto.subtle`).
  - RFC 2104 HMAC-SHA256 Kör Randevu (Blinded Rendezvous) konuları ve RFC 5869 HKDF-SHA256 simetrik anahtar türetimi.
  - Oturum anahtarları yalnızca URL'nin karma (`#key=...`) bölümünde tutulur; HTTP başlıklarına veya sunucu kayıtlarına kesinlikle ulaşmaz.
- **16 Haneli Luhn Mod 10 OmaID Eşleşmesi:**
  - Sıfır hesap, sıfır sunucu: 16 haneli cihaz kimliklerini (`XXXX-XXXX-XXXX-XXXX`) üretir ve doğrular.
  - Omarchy Linux masaüstü ve OmaSend Android mobil istemcileriyle tam uyumlu eşleşir.
- **Sürükle-Bırak Sıvı Dosya Portalı:**
  - Gerçek zamanlı aktarım ilerlemesi, aktarım hızı göstergesi ve SHA-256 bütünlük doğrulaması ile parçalı akış (chunked stream) dosya yükleme ve indirme.
- **Canlı Pano Kasası:**
  - Tarayıcı ve yerel cihazlar arasında tek tıklamayla metin ve WebP formatında görsel pano aktarımı.
- **Koyu Akrilik Glassmorphism Arayüzü:**
  - Akıcı koyu cam arayüz tasarımı (`backdrop-filter: blur(16px)`), speküler kenarlıklar ve `JetBrainsMono Nerd Font` tipografisi.

---

## Çoklu Platform Bağlantıları

- **Omarchy Linux Masaüstü Eklentisi:** [ozdil/omarchy-omasend](https://github.com/ozdil/omarchy-omasend)
- **Android Uygulaması:** [ozdil/omasend-android](https://github.com/ozdil/omasend-android)
- **Google Play Kapalı Beta:** [Google Grubuna Katıl](https://groups.google.com/g/omasend-testers) & [Google Play Test Programına Katıl](https://play.google.com/apps/testing/io.omarchy.omasend)

---

## Geliştirme ve Derleme

### Ön Koşullar
- Node.js 18+ ve `npm`

### Yerel Geliştirme Sunucusu
```bash
npm install
npm run dev
```

### Canlı Üretim Derlemesi
```bash
npm run build
```
Optimize edilmiş statik dağıtım dosyaları `dist/` dizinine çıkarılır; herhangi bir statik web sunucusu tarafından sunulabilir veya `omasend-engine` ikilisine gömülebilir.

---

## Güvenlik ve Gizlilik Politikası

OmaSend Web katı bir **Sıfır Bilgi (Zero-Knowledge) ve İstemci Taraflı Şifreleme** mimarisiyle çalışır. Tüm kriptografik işlemler Web Crypto API ile kullanıcının tarayıcı sandbox'ı içinde gerçekleştirilir. Şifrelenmemiş dosyalar, pano verileri veya gizli anahtarlar asla merkezi bir sunucuya iletilmez.

---

## Lisans

Bu proje **MIT Lisansı** ile lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.
