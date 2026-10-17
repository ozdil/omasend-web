/** UI strings. Turkish when the browser language is Turkish, English otherwise. */

const en = {
  appSubtitle: 'Send to your desktop',
  pairedWith: (n: string) => `Paired with ${n}`,
  notPaired: 'Not paired',
  engineOnline: 'Desktop reachable',
  engineOffline: 'Desktop not reachable',
  settings: 'Settings',
  close: 'Close',
  cancel: 'Cancel',

  pairTitle: 'Pair with your desktop',
  pairStep1: 'On the desktop, open the OmaSend panel and choose "Pair a device". A QR code appears.',
  pairStep2: "Scan it with this phone's camera. It opens this page and asks you to confirm.",
  pairPasteLabel: 'Or paste the pairing link (omasend://pair?… or the http link from the QR code):',
  pairPastePlaceholder: 'omasend://pair?v=2&pk=…',
  pairContinue: 'Continue',
  pairScan: 'Scan QR code',
  pairScanHint: 'Point the camera at the QR code on the desktop.',
  pairScanNoCode: 'No OmaSend QR code found in the picture.',
  pairScanFailed: 'Could not use the camera.',
  pairConfirmTitle: 'Pair with this desktop?',
  pairConfirmQuestion: (n: string, id: string) => `Pair with ${n} (device id ${id})?`,
  pairConfirmCheck: 'Check that the device ID matches the one shown on the desktop.',
  pairOtherAddress: (hp: string, here: string) =>
    `This link was made for ${hp}, but this page is served by ${here}. Pairing only works with the desktop that served this page.`,
  pairWhose: 'Whose device is it?',
  pairMine: 'This is my device',
  pairOthers: "Someone else's",
  pairWhoseNote: 'This only sets a label in this browser. The desktop decides on its own how much it trusts this browser.',
  pairButton: 'Pair',
  pairing: 'Pairing…',
  pairDone: (n: string) => `Paired with ${n}.`,
  pairReplaceNote: (n: string) => `This browser is currently paired with ${n}. Pairing again replaces it.`,

  sendTitle: 'Send files',
  dropHere: 'Drop files here or tap to choose',
  filesSelected: (n: number, size: string) => `${n} file(s), ${size}`,
  sendButton: 'Send',
  clearButton: 'Clear',
  requesting: (n: string) => `Asking ${n}…`,
  waitingApproval: (n: string) => `Waiting for approval on ${n}…`,
  encrypting: (i: number, n: number) => `Encrypting file ${i} of ${n}…`,
  uploading: (i: number, n: number) => `Sending file ${i} of ${n}…`,
  sentAll: (n: number) => `${n} file(s) sent.`,
  rejected: 'The desktop declined the transfer.',
  expired: 'The request expired before it was approved. Try again.',
  cancelled: 'Cancelled.',
  cancelNote: 'The desktop releases the transfer slot on its own after a short time.',

  clipTitle: 'Send text to the desktop clipboard',
  clipPlaceholder: 'Type or paste text…',
  clipPaste: 'Paste',
  clipSend: 'Send text',
  clipSent: 'Text sent to the desktop clipboard.',
  clipEmpty: 'Nothing to send.',
  clipReadFailed: 'Could not read the clipboard. Paste into the box instead.',

  receiveNote: 'This browser can send to your desktop. To receive, use the desktop panel or Android app.',

  settingsDeviceName: 'Name of this browser',
  settingsDeviceNameHint: 'Shown on the desktop at the next pairing. The desktop keeps the name it was given when you paired.',
  settingsSave: 'Save',
  settingsSaved: 'Saved.',
  settingsDeviceId: 'Device ID of this browser',
  settingsPairedDesktop: 'Paired desktop',
  settingsPairedAt: 'Paired',
  settingsLabel: 'Label',
  settingsLabelMine: 'My device',
  settingsLabelOther: "Someone else's",
  settingsForgetPairing: 'Forget pairing',
  settingsForgetPairingConfirm: 'Forget the pairing in this browser? Also remove this browser on the desktop.',
  settingsForgetBrowser: 'Forget this browser',
  settingsForgetBrowserConfirm:
    'Delete the device key, name and pairing from this browser? The desktop will no longer recognise it.',
  settingsStorageNote:
    "The device key is stored unencrypted in this browser's profile (IndexedDB). Anyone with access to this browser profile can use it to send to your desktop. \"Forget this browser\" deletes it.",
  settingsVersion: 'Version',
  settingsAbout: 'About',
  settingsAboutBody:
    'OmaSend Web sends files and text from this browser to your OmaSend desktop on the same network. Pairing uses the QR code and a per-browser Ed25519 key, and every request is signed. A browser can only send; to receive, or to use OmaID and end-to-end encryption, use the desktop panel or the Android app. MIT licensed.',
  settingsSource: 'Source code',

  storageUnavailable: 'This browser does not allow the page to store data (IndexedDB), so it cannot keep a device key. Private windows often block this.',
  encryptedNote:
    'Files and text are encrypted end to end for this desktop before they leave the browser; others on the network see only sizes. The page itself still loads over plain http, so open it only on a network you trust.',

  errNetwork: 'The desktop is not reachable.',
  errSignature: (m: string) => `The desktop rejected the signature (${m}). Check that this device's clock is correct.`,
  errNotPaired: 'The desktop does not recognise this browser. Pair again.',
  errForbidden: (m: string) => `Refused by the desktop: ${m}`,
  errBusy: 'The desktop is busy with another transfer. Try again in a moment.',
  errTooLarge: (m: string) => `Too large: ${m}`,
  errIntegrity: (m: string) => `Integrity check failed: ${m}`,
  errRateLimited: 'Too many attempts. Wait a minute and try again.',
  errOther: (s: number, m: string) => `Error (HTTP ${s}): ${m}`,
  errNoEncryption: 'This desktop does not offer end-to-end encryption yet. Update OmaSend on the desktop; nothing is sent unencrypted.',
  errPageOutdated: 'This page is out of date for the desktop. Reload it and try again.',
  errPairKeyMismatch: 'The desktop answered with a different key than the QR code. Pairing was not saved.',
  errPairBadSig: "The desktop's answer is not correctly signed. Pairing was not saved.",
  errPairRefused: (m: string) => `Pairing refused: ${m}. Make a new QR code on the desktop and try again.`,

  pairUriErrors: {
    not_pair_link: 'This is not an OmaSend pairing link.',
    unsupported_version: 'This pairing link is from an unsupported OmaSend version.',
    missing_pk: 'The pairing link has no public key.',
    invalid_pk: 'The public key in the pairing link is invalid.',
    missing_secret: 'The pairing link has no secret.',
    invalid_secret: 'The secret in the pairing link is invalid.',
    invalid_secret_length: 'The secret in the pairing link has the wrong length.',
    missing_host: 'The pairing link has no address.',
    invalid_port: 'The port in the pairing link is invalid.',
  },
};

export type Strings = typeof en;

const tr: Strings = {
  appSubtitle: 'Masaüstüne gönder',
  pairedWith: (n) => `${n} ile eşleşti`,
  notPaired: 'Eşleşmedi',
  engineOnline: 'Masaüstüne erişiliyor',
  engineOffline: 'Masaüstüne erişilemiyor',
  settings: 'Ayarlar',
  close: 'Kapat',
  cancel: 'İptal',

  pairTitle: 'Masaüstünle eşleştir',
  pairStep1: 'Masaüstünde OmaSend panelini aç ve "Cihaz eşleştir"i seç. Bir QR kod görünür.',
  pairStep2: 'Bu telefonun kamerasıyla tara. Bu sayfa açılır ve onay ister.',
  pairPasteLabel: 'Ya da eşleştirme bağlantısını yapıştır (omasend://pair?… veya QR koddaki http bağlantısı):',
  pairPastePlaceholder: 'omasend://pair?v=2&pk=…',
  pairContinue: 'Devam',
  pairScan: 'QR kodu tara',
  pairScanHint: 'Kamerayı masaüstündeki QR koda tut.',
  pairScanNoCode: 'Resimde OmaSend QR kodu bulunamadı.',
  pairScanFailed: 'Kamera kullanılamadı.',
  pairConfirmTitle: 'Bu masaüstüyle eşleştirilsin mi?',
  pairConfirmQuestion: (n, id) => `${n} ile eşleştirilsin mi (cihaz kimliği ${id})?`,
  pairConfirmCheck: 'Cihaz kimliğinin masaüstünde gösterilenle aynı olduğunu kontrol et.',
  pairOtherAddress: (hp, here) =>
    `Bu bağlantı ${hp} için oluşturulmuş, ama bu sayfayı ${here} sunuyor. Eşleştirme yalnızca bu sayfayı sunan masaüstüyle çalışır.`,
  pairWhose: 'Bu kimin cihazı?',
  pairMine: 'Benim cihazım',
  pairOthers: 'Başkasının',
  pairWhoseNote: 'Bu yalnızca bu tarayıcıdaki bir etikettir. Masaüstü bu tarayıcıya ne kadar güveneceğine kendisi karar verir.',
  pairButton: 'Eşleştir',
  pairing: 'Eşleştiriliyor…',
  pairDone: (n) => `${n} ile eşleşti.`,
  pairReplaceNote: (n) => `Bu tarayıcı şu anda ${n} ile eşleşmiş. Yeniden eşleştirmek onun yerini alır.`,

  sendTitle: 'Dosya gönder',
  dropHere: 'Dosyaları buraya bırak veya seçmek için dokun',
  filesSelected: (n, size) => `${n} dosya, ${size}`,
  sendButton: 'Gönder',
  clearButton: 'Temizle',
  requesting: (n) => `${n} soruluyor…`,
  waitingApproval: (n) => `${n} üzerinde onay bekleniyor…`,
  encrypting: (i, n) => `Dosya şifreleniyor: ${i} / ${n}…`,
  uploading: (i, n) => `Dosya gönderiliyor: ${i} / ${n}…`,
  sentAll: (n) => `${n} dosya gönderildi.`,
  rejected: 'Masaüstü aktarımı reddetti.',
  expired: 'İstek onaylanmadan süresi doldu. Tekrar dene.',
  cancelled: 'İptal edildi.',
  cancelNote: 'Masaüstü aktarım yerini kısa süre sonra kendiliğinden boşaltır.',

  clipTitle: 'Masaüstü panosuna metin gönder',
  clipPlaceholder: 'Metin yaz veya yapıştır…',
  clipPaste: 'Yapıştır',
  clipSend: 'Metni gönder',
  clipSent: 'Metin masaüstü panosuna gönderildi.',
  clipEmpty: 'Gönderilecek bir şey yok.',
  clipReadFailed: 'Pano okunamadı. Metni kutuya yapıştır.',

  receiveNote: 'Bu tarayıcı masaüstüne gönderebilir. Almak için masaüstü panelini veya Android uygulamasını kullan.',

  settingsDeviceName: 'Bu tarayıcının adı',
  settingsDeviceNameHint: 'Bir sonraki eşleştirmede masaüstünde gösterilir. Masaüstü, eşleştirmede verilen adı saklar.',
  settingsSave: 'Kaydet',
  settingsSaved: 'Kaydedildi.',
  settingsDeviceId: 'Bu tarayıcının cihaz kimliği',
  settingsPairedDesktop: 'Eşleşilen masaüstü',
  settingsPairedAt: 'Eşleşme',
  settingsLabel: 'Etiket',
  settingsLabelMine: 'Benim cihazım',
  settingsLabelOther: 'Başkasının',
  settingsForgetPairing: 'Eşleşmeyi unut',
  settingsForgetPairingConfirm: 'Bu tarayıcıdaki eşleşme unutulsun mu? Bu tarayıcıyı masaüstünden de kaldır.',
  settingsForgetBrowser: 'Bu tarayıcıyı unut',
  settingsForgetBrowserConfirm:
    'Cihaz anahtarı, ad ve eşleşme bu tarayıcıdan silinsin mi? Masaüstü bu tarayıcıyı artık tanımaz.',
  settingsStorageNote:
    'Cihaz anahtarı bu tarayıcı profilinde (IndexedDB) şifrelenmeden saklanır. Bu profile erişimi olan herkes onunla masaüstüne gönderim yapabilir. "Bu tarayıcıyı unut" anahtarı siler.',
  settingsVersion: 'Sürüm',
  settingsAbout: 'Hakkında',
  settingsAboutBody:
    'OmaSend Web, bu tarayıcıdan aynı ağdaki OmaSend masaüstünüze dosya ve metin gönderir. Eşleşme QR kod ve tarayıcıya özel bir Ed25519 anahtarıyla yapılır, her istek imzalanır. Tarayıcı yalnızca gönderebilir; almak, OmaID ve uçtan uca şifreleme için masaüstü panelini ya da Android uygulamasını kullanın. MIT lisanslı.',
  settingsSource: 'Kaynak kodu',

  storageUnavailable: 'Bu tarayıcı sayfanın veri saklamasına (IndexedDB) izin vermiyor, bu yüzden cihaz anahtarı tutulamıyor. Gizli pencereler bunu sıklıkla engeller.',
  encryptedNote:
    'Dosyalar ve metin tarayıcıdan çıkmadan önce bu masaüstü için uçtan uca şifrelenir; ağdakiler yalnızca boyutları görür. Sayfanın kendisi hâlâ düz http ile yüklenir, bu yüzden yalnızca güvendiğin ağlarda aç.',

  errNetwork: 'Masaüstüne erişilemiyor.',
  errSignature: (m) => `Masaüstü imzayı reddetti (${m}). Bu cihazın saatinin doğru olduğunu kontrol et.`,
  errNotPaired: 'Masaüstü bu tarayıcıyı tanımıyor. Yeniden eşleştir.',
  errForbidden: (m) => `Masaüstü reddetti: ${m}`,
  errBusy: 'Masaüstü başka bir aktarımla meşgul. Biraz sonra tekrar dene.',
  errTooLarge: (m) => `Çok büyük: ${m}`,
  errIntegrity: (m) => `Bütünlük kontrolü başarısız: ${m}`,
  errRateLimited: 'Çok fazla deneme. Bir dakika bekleyip tekrar dene.',
  errOther: (s, m) => `Hata (HTTP ${s}): ${m}`,
  errNoEncryption: 'Bu masaüstü henüz uçtan uca şifreleme sunmuyor. Masaüstündeki OmaSend\'i güncelle; hiçbir şey şifresiz gönderilmez.',
  errPageOutdated: 'Bu sayfa masaüstüne göre eski. Sayfayı yenileyip tekrar dene.',
  errPairKeyMismatch: 'Masaüstü QR koddakinden farklı bir anahtarla yanıt verdi. Eşleşme kaydedilmedi.',
  errPairBadSig: 'Masaüstünün yanıtı doğru imzalanmamış. Eşleşme kaydedilmedi.',
  errPairRefused: (m) => `Eşleştirme reddedildi: ${m}. Masaüstünde yeni bir QR kod oluşturup tekrar dene.`,

  pairUriErrors: {
    not_pair_link: 'Bu bir OmaSend eşleştirme bağlantısı değil.',
    unsupported_version: 'Bu eşleştirme bağlantısı desteklenmeyen bir OmaSend sürümünden.',
    missing_pk: 'Eşleştirme bağlantısında açık anahtar yok.',
    invalid_pk: 'Eşleştirme bağlantısındaki açık anahtar geçersiz.',
    missing_secret: 'Eşleştirme bağlantısında gizli anahtar yok.',
    invalid_secret: 'Eşleştirme bağlantısındaki gizli anahtar geçersiz.',
    invalid_secret_length: 'Eşleştirme bağlantısındaki gizli anahtarın uzunluğu yanlış.',
    missing_host: 'Eşleştirme bağlantısında adres yok.',
    invalid_port: 'Eşleştirme bağlantısındaki port geçersiz.',
  },
};

export function pickLanguage(langs: readonly string[] | undefined): 'tr' | 'en' {
  const first = (langs && langs[0]) || '';
  return first.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

export function stringsFor(lang: 'tr' | 'en'): Strings {
  return lang === 'tr' ? tr : en;
}

export function defaultDeviceName(lang: 'tr' | 'en', ua: string): string {
  const platform = /Android/i.test(ua)
    ? 'Android'
    : /iPhone/i.test(ua)
      ? 'iPhone'
      : /iPad/i.test(ua)
        ? 'iPad'
        : /Windows/i.test(ua)
          ? 'Windows'
          : /Mac OS X|Macintosh/i.test(ua)
            ? 'macOS'
            : /CrOS/i.test(ua)
              ? 'ChromeOS'
              : /Linux/i.test(ua)
                ? 'Linux'
                : '';
  if (lang === 'tr') return platform ? `${platform} tarayıcısı` : 'Tarayıcı';
  return platform ? `Browser on ${platform}` : 'Browser';
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}
