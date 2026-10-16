# OmaSend Web - PWA İstemcisi (önizleme)

<p align="center">
  <img src="public/icon-512.png" alt="OmaSend Web Logosu" width="160" height="160" />
</p>

<p align="center">
  <a href="https://github.com/ozdil/omasend-web/releases"><img src="https://img.shields.io/github/v/release/ozdil/omasend-web?style=for-the-badge&logo=typescript&color=38BDF8&label=S%C3%BCr%C3%BCm" alt="Son sürüm" /></a>
  <a href="https://github.com/ozdil/omarchy-omasend"><img src="https://img.shields.io/badge/Omarchy%20Linux-Masa%C3%BCst%C3%BC%20Eklentisi-00ADD8?style=for-the-badge&logo=archlinux&logoColor=white" alt="Omarchy Linux Eklentisi" /></a>
  <a href="https://github.com/ozdil/omasend-android"><img src="https://img.shields.io/badge/Android-Uygulama-34A853?style=for-the-badge&logo=android&logoColor=white" alt="Android Uygulaması" /></a>
  <a href="https://buymeacoffee.com/ozdil"><img src="https://img.shields.io/badge/Kahve_Ismarla-Destek-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Kahve Ismarla" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/Lisans-MIT-blue?style=for-the-badge" alt="MIT Lisansı" /></a>
</p>

> **Durum: önizleme.** Web istemcisi şu an yalnızca yapılandırılmış bir OmaSend motorunun durumunu ve o motorun bulduğu cihazları gösterir. **Tarayıcıdan dosya gönderme, pano eşitleme ve eşleştirme henüz yok.** Bunlar için OmaSend masaüstü panelini veya OmaSend Android uygulamasını kullanın.

---

## Bugün yaptıkları

- Modern tarayıcılara kurulabilen PWA.
- Motordan `GET /api/status` ve `GET /api/p2p/peers` okur; yalnızca motorun gerçekten döndürdüğü değerleri gösterir.
- Service worker: sayfa için önce ağ (güncellemeler ulaşır), yalnızca hash'li derleme dosyaları için önce önbellek, çevrimdışıyken son önbelleğe alınmış sayfa.

## Henüz yapmadıkları

- Dosya aktarımı, pano eşitleme, QR ile eşleştirme ve cihaz eşleştirme yok.
- Uçtan uca şifreleme iddiası yok. `src/core/crypto/web_crypto.ts` içindeki randevu yardımcıları anahtarı gizli olmayan OmaID'den türetir; bu yalnızca randevu kayıtlarını gizler (obfuscation).

---

## Çoklu Platform Bağlantıları

- **Omarchy Linux Masaüstü Eklentisi:** [ozdil/omarchy-omasend](https://github.com/ozdil/omarchy-omasend)
- **Android Uygulaması:** [ozdil/omasend-android](https://github.com/ozdil/omasend-android)
- **Google Play Kapalı Beta:** [Google Grubuna Katıl](https://groups.google.com/g/omasend-testers) & [Google Play Test Programına Katıl](https://play.google.com/apps/testing/io.omarchy.omasend)

---

## Geliştirme ve Derleme

### Ön Koşullar
- Node.js 22 ve `npm`

### Motor adresi

İstemci motorun adresini tahmin etmez; derleme veya geliştirme sırasında açıkça verin:

```bash
VITE_OMASEND_ENGINE_URL=http://127.0.0.1:53317 npm run dev
```

Verilmezse, motorun kendisinin sunduğu bir üretim derlemesi kendi origin'ine bağlanır; `npm run dev` altında sayfa "Engine URL not configured" gösterir. Tarayıcılar `https://` bir sayfadan `http://` motorlara isteği (mixed content) engeller ve motorun CORS ile sayfanın origin'ine izin vermesi gerekir.

### Yerel Geliştirme Sunucusu
```bash
npm ci
npm run dev
```

### Üretim Derlemesi
```bash
npm run build
```
Statik çıktı `dist/` dizinine yazılır (repoya eklenmez). Arayüzde görünen sürüm ve service worker önbellek adı `package.json` sürümünden gelir.

---

## Güvenlik ve Gizlilik

- Tüm kriptografik yardımcılar tarayıcıda Web Crypto API ile çalışır; mevcut arayüz dosya veya pano içeriğini hiçbir yere göndermez.
- Tarayıcının yerel kimliği ve saklanan veriler `localStorage` içinde düz metin olarak durur.
- `index.html` içinde sıkı bir İçerik Güvenliği Politikası (CSP) vardır (satır içi betik yok, bağlantılar sayfanın origin'i ve yerel motorlarla sınırlı).

---

## Lisans

Bu proje **MIT Lisansı** ile lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.
