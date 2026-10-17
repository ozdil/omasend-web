# OmaSend Web - PWA İstemcisi

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

> Telefonundaki veya dizüstündeki tarayıcıyı bir QR kod tarayarak OmaSend masaüstünle eşleştir, sonra masaüstüne dosya ve pano metni gönder. Kurulum gerekmez. **Tarayıcıyla alma mümkün değil**: almak için OmaSend masaüstü panelini veya Android uygulamasını kullan.

---

## Nasıl çalışır

OmaSend masaüstü motoru bu uygulamayı kendisi `http://<masaüstü-ip>:53317/web/` adresinde sunar. Uygulama yalnızca onu sunan motorla konuşur (aynı origin, `connect-src 'self'`).

1. **Eşleştir.** Masaüstünde "Cihaz eşleştir"i seç. QR kod
   `http://<ip>:53317/web/#pair=<omasend://pair?v=2&pk=…&s=…>` içerir. Telefonun kamerasıyla tara; sayfa açılır, bağlantıyı adres çubuğundan siler ve *"<masaüstü> ile eşleştirilsin mi (cihaz kimliği XXXX-XXXX-XXXX-XXXX)?"* diye sorar. Kimliğin masaüstündekiyle aynı olduğunu kontrol et. Bağlantıyı yapıştırabilir ya da tarayıcıda `BarcodeDetector` varsa sayfa içinde tarayabilirsin.
2. **Dosya gönder.** Dosyaları bırak veya seç. Masaüstü kullanıcısından onay ister (bu tarayıcıyı kendi cihazı olarak tanımıyorsa); sayfa "onay bekleniyor" gösterir, sonra her dosyayı şifreleyip ilerlemesiyle yükler.
3. **Metin gönder.** Metni yaz veya yapıştır ve masaüstü panosuna gönder.

[OmaSend protokol v2](https://github.com/ozdil/omarchy-omasend/blob/main/PROTOCOL_V2.md) Aşama 1'i uygular:

- Tarayıcının kendi Ed25519 cihaz anahtarı vardır (rastgele 32 baytlık tohum). Cihaz kimliği, SHA-256(açık anahtar)'ın ilk 8 baytıdır.
- Eşleştirme: `POST /api/v2/pair`, iki açık anahtar üzerinde QR sırrıyla anahtarlanmış HMAC ve Ed25519 imzası ile. Masaüstünün yanıtı QR koddaki anahtardan gelmeli ve onunla imzalanmış olmalı; yoksa hiçbir şey kaydedilmez.
- `/api/p2p/*` isteklerinin hepsi imzalanır (`X-OmaSend-Pk`, `-Ts`, `-Nonce`, `-Sig`): yöntem, gönderildiği haliyle yol ve sorgu, zaman damgası, nonce ve SHA-256 gövde etiketi (yüklemelerde `stream:<boyut>`).
- **Uçtan uca şifreleme** (`omasend-web-e2e-v1`, PROTOCOL_V2.md "Browser end-to-end encryption"): masaüstü, eşleşmede sabitlenen Ed25519 anahtarıyla imzaladığı bir X25519 anahtarı yayımlar. Tarayıcı her istek için yeni bir X25519 anahtarı üretir, HKDF-SHA256 ile anahtar türetir ve aktarım bilgilerini, pano metnini ve her dosyayı (64 KiB parçalar, sayaçlı nonce ve son parça işareti) ChaCha20-Poly1305 ile şifreler. Masaüstü çözer, doğrular ve ancak sonra kaydeder. Dosya adları yalnızca zarfın içinde gider; yüklemeler sıra numarasıyla adreslenir. Anahtar sunmayan bir masaüstüne hiçbir şey gönderilmez: düz metne geri düşme yoktur.
- Kriptografi saf JavaScript'tir ([@noble/curves](https://github.com/paulmillr/noble-curves), [@noble/ciphers](https://github.com/paulmillr/noble-ciphers), [@noble/hashes](https://github.com/paulmillr/noble-hashes); denetlenmiş, sürümü sabit), çünkü `http://192.168.x.y` üzerindeki bir sayfa güvenli bağlam değildir ve WebCrypto'su yoktur. Masaüstü motoruyla aynı test vektörleri `test/protocol.test.ts` ve `test/e2e.test.ts` içinde kontrol edilir.

## Güvenlik ve gizlilik: bilmen gerekenler

- **Gönderdiklerin uçtan uca şifrelenir**; ağdaki biri yalnızca bir aktarım olduğunu, dosya boyutlarını ve (256 baytlık adımlarla) metin uzunluğunu görür, başka bir şey görmez. **Sayfanın kendisi hâlâ düz HTTP ile yüklenir.** Ağındaki aktif bir saldırgan sayfayı yüklerken değiştirilmiş bir sürüm sunabilir; bu yüzden yalnızca güvendiğin ağda aç ve eşleştir (sabit, kurulabilir bir sayfa yol haritasında).
- **Cihaz anahtarı bu tarayıcı profilinde (IndexedDB) şifrelenmeden saklanır.** Tarayıcı profiline erişebilen biri onu kopyalayıp bu tarayıcı adına masaüstüne gönderim yapabilir. **Ayarlar → "Bu tarayıcıyı unut"** anahtarı, adı ve eşleşmeyi siler. Tarayıcıyı masaüstünün eşleşmiş cihazlarından da kaldır.
- Eşleştirirken "Benim cihazım / Başkasının" seçimi yalnızca tarayıcıda bir etiket koyar. Masaüstü tarayıcıya ne kadar güveneceğine kendisi karar verir.
- Analitik ve üçüncü taraf isteği yok. `index.html` içinde sıkı bir İçerik Güvenliği Politikası (CSP) var.
- Service worker (çevrimdışı kabuk) yalnızca güvenli bağlamda (ör. `localhost`) kaydedilir; yerel ağdaki bir `http://` adresinde atlanır.

---

## Çoklu Platform Bağlantıları

- **Omarchy Linux Masaüstü Eklentisi:** [ozdil/omarchy-omasend](https://github.com/ozdil/omarchy-omasend)
- **Android Uygulaması:** [ozdil/omasend-android](https://github.com/ozdil/omasend-android)
- **Google Play Kapalı Beta:** [Google Grubuna Katıl](https://groups.google.com/g/omasend-testers) & [Google Play Test Programına Katıl](https://play.google.com/apps/testing/io.omarchy.omasend)

---

## Geliştirme ve Derleme

Ön koşullar: Node.js 22 ve `npm`.

```bash
npm ci
npx tsc --noEmit     # tip kontrolü
npx vitest run       # birim testleri (protokol test vektörleri, bağlantı ayrıştırma, kanonik metinler)
npm run build        # dist/ altında statik çıktı; motor bunu /web/ altında sunar
```

`npm run build && npm run mock`, `e2e/mock-engine.mjs`'i başlatır: `dist/`'i `/web/` altında sunar, yukarıdaki uç noktaları uygular (her MAC, imza ve gövde etiketini doğrular) ve tarayıcıda açılacak bir eşleştirme bağlantısı yazdırır. `GET /__mock/state` gelenleri gösterir.

`npm run dev`, `/api` isteklerini `http://127.0.0.1:53317`'ye yönlendirir (`OMASEND_ENGINE=http://…` ile değiştirilebilir).

Uygulama sürümü (arayüz ve service worker önbellek adı) `package.json`'dan gelir.

---

## Lisans

Bu proje **MIT Lisansı** ile lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.
