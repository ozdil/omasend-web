import {
  ApiError,
  pair,
  pingEngine,
  pollDecision,
  requestTransfer,
  sendClipboard,
  uploadFile,
} from '../core/protocol/client';
import type { DeviceKey } from '../core/protocol/devicekey';
import { deviceIdForPk, decodePk } from '../core/protocol/devicekey';
import { sanitizeFilename } from '../core/protocol/filename';
import { fragmentHasPair, pairLinkFromFragment, pairLinkFromText, parsePairUri, type PairOffer } from '../core/protocol/pairuri';
import {
  forgetBrowser,
  forgetPairing,
  loadOrCreateDeviceKey,
  loadOrCreateProfile,
  loadPairing,
  saveProfile,
  savePairing,
  type Pairing,
  type Profile,
} from '../core/store';
import { el, GEAR_SVG, LOGO_SVG, staticSvg, trapModal } from './dom';
import { defaultDeviceName, formatBytes, pickLanguage, stringsFor, type Strings } from './i18n';
import { scanAvailable, scanQr } from './scan';

const POLL_MS = 1500;
const PING_MS = 10000;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}

interface FileRow {
  file: File;
  name: string;
  bar: HTMLProgressElement;
  state: HTMLElement;
}

export class OmaSendApp {
  private readonly t: Strings;
  private readonly lang: 'tr' | 'en';
  private key!: DeviceKey;
  private profile!: Profile;
  private pairing: Pairing | null = null;
  private pendingOffer: PairOffer | null = null;
  private pendingError: string | null = null;
  private online: boolean | null = null;

  private root!: HTMLElement;
  private main!: HTMLElement;
  private statusLine!: HTMLElement;
  private engineDot!: HTMLElement;

  private files: File[] = [];
  private busy: AbortController | null = null;

  constructor() {
    this.lang = pickLanguage(navigator.languages?.length ? navigator.languages : [navigator.language]);
    this.t = stringsFor(this.lang);
    document.documentElement.lang = this.lang;
  }

  async init(): Promise<void> {
    const root = document.getElementById('app');
    if (!root) return;
    this.root = root;

    // Consume a #pair= link before anything else and remove it from the address bar and
    // history, so the one-time secret does not linger in the URL.
    this.consumeFragment();

    try {
      this.key = await loadOrCreateDeviceKey();
      this.profile = await loadOrCreateProfile(defaultDeviceName(this.lang, navigator.userAgent));
      this.pairing = await loadPairing();
    } catch {
      this.root.replaceChildren(
        el('div', { class: 'app-container' }, el('section', { class: 'card error-card', role: 'alert' }, this.t.storageUnavailable)),
      );
      return;
    }

    this.renderShell();
    this.render();
    window.addEventListener('hashchange', () => {
      if (this.consumeFragment()) this.render();
    });
    void this.ping();
    window.setInterval(() => void this.ping(), PING_MS);
  }

  /** Returns true when a pairing fragment was found (and removed). */
  private consumeFragment(): boolean {
    if (!fragmentHasPair(location.hash)) return false;
    const link = pairLinkFromFragment(location.hash);
    history.replaceState(null, '', location.pathname + location.search);
    this.acceptLink(link);
    return true;
  }

  private acceptLink(link: string | null): void {
    if (!link) {
      this.pendingOffer = null;
      this.pendingError = this.t.pairUriErrors.not_pair_link;
      return;
    }
    const r = parsePairUri(link);
    if (r.ok) {
      this.pendingOffer = r.offer;
      this.pendingError = null;
    } else {
      this.pendingOffer = null;
      this.pendingError = this.t.pairUriErrors[r.error];
    }
  }

  // ------------------------------------------------------------------ shell

  private renderShell(): void {
    this.statusLine = el('div', { class: 'app-subtitle', id: 'pair-status' });
    this.engineDot = el('span', { class: 'engine-dot', role: 'img' });
    const settingsBtn = el(
      'button',
      { class: 'btn btn-ghost btn-icon', type: 'button', title: this.t.settings, 'aria-label': this.t.settings, id: 'btn-settings' },
      staticSvg(GEAR_SVG),
    );
    settingsBtn.addEventListener('click', () => this.showSettings());

    const header = el(
      'header',
      { class: 'app-header' },
      el(
        'div',
        { class: 'header-brand' },
        staticSvg(LOGO_SVG),
        el('div', { class: 'header-titles' }, el('div', { class: 'app-title' }, 'OmaSend ', this.engineDot), this.statusLine),
      ),
      el('div', { class: 'header-actions' }, settingsBtn),
    );
    this.main = el('main', { class: 'main' });
    this.root.replaceChildren(el('div', { class: 'app-container' }, header, this.main), el('div', { id: 'modal-container' }));
    this.updateHeader();
  }

  private updateHeader(): void {
    this.statusLine.textContent = this.pairing ? this.t.pairedWith(this.pairing.name) : this.t.notPaired;
    this.statusLine.className = this.pairing ? 'app-subtitle paired' : 'app-subtitle';
    const label = this.online === null ? '' : this.online ? this.t.engineOnline : this.t.engineOffline;
    this.engineDot.className = `engine-dot ${this.online === null ? '' : this.online ? 'online' : 'offline'}`;
    this.engineDot.title = label;
    this.engineDot.setAttribute('aria-label', label);
  }

  private async ping(): Promise<void> {
    this.online = await pingEngine();
    this.updateHeader();
  }

  private render(): void {
    this.updateHeader();
    const blocks: Node[] = [];
    if (this.pendingOffer) blocks.push(this.renderConfirm(this.pendingOffer));
    else if (!this.pairing) blocks.push(this.renderPairing());
    else blocks.push(this.renderSend(), this.renderClipboard());
    if (!window.isSecureContext) blocks.push(el('p', { class: 'note' }, this.t.insecureNote));
    blocks.push(el('p', { class: 'note' }, this.t.receiveNote));
    this.main.replaceChildren(...blocks);
  }

  // ------------------------------------------------------------------ pairing

  private renderPairing(): HTMLElement {
    const input = el('textarea', {
      class: 'input',
      rows: '3',
      id: 'pair-link',
      placeholder: this.t.pairPastePlaceholder,
      spellcheck: 'false',
      autocapitalize: 'off',
    });
    const err = el('p', { class: 'error', role: 'alert' }, this.pendingError ?? '');
    const go = el('button', { class: 'btn btn-primary', type: 'button', id: 'btn-pair-continue' }, this.t.pairContinue);
    go.addEventListener('click', () => {
      this.acceptLink(pairLinkFromText(input.value));
      this.render();
    });
    const actions = el('div', { class: 'actions' }, go);
    if (scanAvailable()) {
      const scan = el('button', { class: 'btn', type: 'button' }, this.t.pairScan);
      scan.addEventListener('click', () => void this.runScan(err));
      actions.prepend(scan);
    }
    return el(
      'section',
      { class: 'card' },
      el('h2', { class: 'card-title' }, this.t.pairTitle),
      el('ol', { class: 'steps' }, el('li', {}, this.t.pairStep1), el('li', {}, this.t.pairStep2)),
      el('label', { class: 'label', for: 'pair-link' }, this.t.pairPasteLabel),
      input,
      err,
      actions,
    );
  }

  private async runScan(err: HTMLElement): Promise<void> {
    const modal = document.getElementById('modal-container');
    if (!modal) return;
    try {
      const text = await scanQr(modal, this.t);
      if (text === null) return;
      const link = pairLinkFromText(text);
      if (!link) {
        err.textContent = this.t.pairScanNoCode;
        return;
      }
      this.acceptLink(link);
      this.render();
    } catch {
      err.textContent = this.t.pairScanFailed;
    }
  }

  private renderConfirm(offer: PairOffer): HTMLElement {
    const pk = decodePk(offer.pk);
    const deviceId = pk ? deviceIdForPk(pk) : '';
    const name = offer.name || offer.host;
    const here = location.host;
    const linkHost = offer.host.includes(':') ? `[${offer.host}]:${offer.port}` : `${offer.host}:${offer.port}`;

    const mine = el('input', { type: 'radio', name: 'whose', value: 'mine', id: 'whose-mine' });
    const others = el('input', { type: 'radio', name: 'whose', value: 'others', id: 'whose-others', checked: true });
    const err = el('p', { class: 'error', role: 'alert' });
    const pairBtn = el('button', { class: 'btn btn-primary', type: 'button', id: 'btn-pair' }, this.t.pairButton);
    const cancelBtn = el('button', { class: 'btn', type: 'button' }, this.t.cancel);
    cancelBtn.addEventListener('click', () => {
      this.pendingOffer = null;
      this.render();
    });
    pairBtn.addEventListener('click', async () => {
      pairBtn.disabled = true;
      cancelBtn.disabled = true;
      pairBtn.textContent = this.t.pairing;
      err.textContent = '';
      try {
        const desk = await pair(this.key, offer, this.profile.name);
        this.pairing = { pk: desk.pk, name: desk.name, deviceId: desk.deviceId, pairedAt: Date.now(), own: mine.checked };
        await savePairing(this.pairing);
        this.pendingOffer = null;
        this.render();
        this.toast(this.t.pairDone(desk.name));
      } catch (e) {
        err.textContent = this.pairErrorText(e);
        pairBtn.disabled = false;
        cancelBtn.disabled = false;
        pairBtn.textContent = this.t.pairButton;
      }
    });

    return el(
      'section',
      { class: 'card', id: 'pair-confirm' },
      el('h2', { class: 'card-title' }, this.t.pairConfirmTitle),
      el('p', { class: 'question' }, this.t.pairConfirmQuestion(name, deviceId)),
      el('p', { class: 'muted' }, this.t.pairConfirmCheck),
      linkHost !== here && el('p', { class: 'warning' }, this.t.pairOtherAddress(linkHost, here)),
      this.pairing && el('p', { class: 'warning' }, this.t.pairReplaceNote(this.pairing.name)),
      el(
        'fieldset',
        { class: 'choice' },
        el('legend', {}, this.t.pairWhose),
        el('label', { for: 'whose-mine' }, mine, ' ', this.t.pairMine),
        el('label', { for: 'whose-others' }, others, ' ', this.t.pairOthers),
        el('p', { class: 'muted small' }, this.t.pairWhoseNote),
      ),
      err,
      el('div', { class: 'actions' }, cancelBtn, pairBtn),
    );
  }

  private pairErrorText(e: unknown): string {
    if (e instanceof Error && e.message === 'pair_key_mismatch') return this.t.errPairKeyMismatch;
    if (e instanceof Error && e.message === 'pair_bad_signature') return this.t.errPairBadSig;
    if (e instanceof ApiError && e.status === 403) return this.t.errPairRefused(e.serverMessage);
    return this.errorText(e);
  }

  // ------------------------------------------------------------------ files

  private renderSend(): HTMLElement {
    const input = el('input', { type: 'file', multiple: true, class: 'visually-hidden', id: 'file-input' });
    const drop = el(
      'label',
      { class: 'drop', for: 'file-input', id: 'drop-zone' },
      el('span', { class: 'drop-text' }, this.t.dropHere),
      input,
    );
    const list = el('ul', { class: 'file-list', id: 'file-list' });
    const summary = el('p', { class: 'muted', id: 'file-summary' });
    const status = el('p', { class: 'status', id: 'send-status', role: 'status' });
    const sendBtn = el('button', { class: 'btn btn-primary', type: 'button', id: 'btn-send' }, this.t.sendButton);
    const clearBtn = el('button', { class: 'btn', type: 'button', id: 'btn-clear' }, this.t.clearButton);
    const rows: FileRow[] = [];

    const controls = () => {
      sendBtn.disabled = this.files.length === 0 || this.busy !== null;
      clearBtn.textContent = this.busy ? this.t.cancel : this.t.clearButton;
      clearBtn.disabled = !this.busy && this.files.length === 0 && rows.length === 0;
      input.disabled = this.busy !== null;
    };
    const refresh = () => {
      rows.length = 0;
      list.replaceChildren(
        ...this.files.map((file, i) => {
          const bar = el('progress', { max: '1', value: '0' });
          const state = el('span', { class: 'file-state' });
          rows.push({ file, name: sanitizeFilename(file.name, i), bar, state });
          return el(
            'li',
            {},
            el('div', { class: 'file-line' }, el('span', { class: 'file-name' }, file.name), el('span', { class: 'muted' }, formatBytes(file.size))),
            bar,
            state,
          );
        }),
      );
      const total = this.files.reduce((a, f) => a + f.size, 0);
      summary.textContent = this.files.length ? this.t.filesSelected(this.files.length, formatBytes(total)) : '';
      controls();
    };

    const addFiles = (fl: FileList | null) => {
      if (!fl || this.busy) return;
      this.files.push(...Array.from(fl));
      status.textContent = '';
      status.className = 'status';
      refresh();
    };
    input.addEventListener('change', () => {
      addFiles(input.files);
      input.value = '';
    });
    drop.addEventListener('dragover', (e) => {
      e.preventDefault();
      drop.classList.add('dragging');
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('dragging');
      addFiles(e.dataTransfer?.files ?? null);
    });
    clearBtn.addEventListener('click', () => {
      if (this.busy) {
        this.busy.abort();
        return;
      }
      this.files = [];
      status.textContent = '';
      refresh();
    });
    sendBtn.addEventListener('click', () => void this.sendFiles(rows.slice(), status, controls));
    refresh();

    return el(
      'section',
      { class: 'card' },
      el('h2', { class: 'card-title' }, this.t.sendTitle),
      drop,
      summary,
      list,
      status,
      el('div', { class: 'actions' }, clearBtn, sendBtn),
    );
  }

  private setStatus(status: HTMLElement, text: string, kind: '' | 'ok' | 'error' = ''): void {
    status.textContent = text;
    status.className = kind ? `status ${kind}` : 'status';
  }

  private async sendFiles(rows: FileRow[], status: HTMLElement, controls: () => void): Promise<void> {
    const pairing = this.pairing;
    if (!pairing || rows.length === 0 || this.busy) return;
    const ctl = new AbortController();
    this.busy = ctl;
    controls();
    const desk = pairing.name;
    for (const r of rows) {
      r.bar.value = 0;
      r.state.textContent = '';
    }
    try {
      this.setStatus(status, this.t.requesting(desk));
      const { status: first, token } = await requestTransfer(this.key, {
        oma_id: this.profile.omaId,
        sender_name: this.profile.name,
        files: rows.map((r) => ({ name: r.name, size_bytes: r.file.size })),
        total_size_bytes: rows.reduce((a, r) => a + r.file.size, 0),
        client: 'web',
      });
      let decision = first;
      if (decision === 'PENDING') this.setStatus(status, this.t.waitingApproval(desk));
      while (decision === 'PENDING') {
        await sleep(POLL_MS, ctl.signal);
        decision = await pollDecision(this.key, token, ctl.signal);
      }
      if (decision === 'REJECTED') {
        this.setStatus(status, this.t.rejected, 'error');
        return;
      }
      if (decision !== 'ACCEPTED') {
        this.setStatus(status, this.t.expired, 'error');
        return;
      }
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        this.setStatus(status, this.t.uploading(i + 1, rows.length));
        await uploadFile(
          this.key,
          token,
          row.name,
          row.file,
          (sent, size) => {
            row.bar.value = size > 0 ? sent / size : 1;
          },
          ctl.signal,
        );
        row.bar.value = 1;
        row.state.textContent = '\u2713';
      }
      this.setStatus(status, this.t.sentAll(rows.length), 'ok');
      // The finished list stays visible; the next selection starts a new list.
      this.files = [];
    } catch (e) {
      if (isAbort(e)) this.setStatus(status, `${this.t.cancelled} ${this.t.cancelNote}`, 'error');
      else this.setStatus(status, this.errorText(e), 'error');
    } finally {
      this.busy = null;
      controls();
    }
  }

  // ------------------------------------------------------------------ clipboard

  private renderClipboard(): HTMLElement {
    const text = el('textarea', { class: 'input', rows: '4', id: 'clip-text', placeholder: this.t.clipPlaceholder });
    const status = el('p', { class: 'status', id: 'clip-status', role: 'status' });
    const sendBtn = el('button', { class: 'btn btn-primary', type: 'button', id: 'btn-clip-send' }, this.t.clipSend);
    const actions = el('div', { class: 'actions' });
    if (typeof navigator.clipboard?.readText === 'function') {
      const paste = el('button', { class: 'btn', type: 'button' }, this.t.clipPaste);
      paste.addEventListener('click', async () => {
        try {
          text.value = await navigator.clipboard.readText();
        } catch {
          this.setStatus(status, this.t.clipReadFailed, 'error');
        }
      });
      actions.append(paste);
    }
    actions.append(sendBtn);
    sendBtn.addEventListener('click', async () => {
      const value = text.value;
      if (!value.trim()) {
        this.setStatus(status, this.t.clipEmpty, 'error');
        return;
      }
      sendBtn.disabled = true;
      try {
        await sendClipboard(this.key, {
          text: value,
          content_type: 'text',
          sender_name: this.profile.name,
          oma_id: this.profile.omaId,
          client: 'web',
        });
        this.setStatus(status, this.t.clipSent, 'ok');
        text.value = '';
      } catch (e) {
        this.setStatus(status, this.errorText(e), 'error');
      } finally {
        sendBtn.disabled = false;
      }
    });
    return el('section', { class: 'card' }, el('h2', { class: 'card-title' }, this.t.clipTitle), text, status, actions);
  }

  // ------------------------------------------------------------------ errors

  private errorText(e: unknown): string {
    if (!(e instanceof ApiError)) return this.t.errNetwork;
    const m = e.serverMessage;
    switch (e.status) {
      case 0:
        return this.t.errNetwork;
      case 401:
        return this.t.errSignature(m);
      case 403:
        if (/paired devices|not paired|pairing is not confirmed/i.test(m)) return this.t.errNotPaired;
        return this.t.errForbidden(m);
      case 409:
        return this.t.errBusy;
      case 413:
        return this.t.errTooLarge(m);
      case 422:
        return this.t.errIntegrity(m);
      case 429:
        return this.t.errRateLimited;
      default:
        return this.t.errOther(e.status, m);
    }
  }

  // ------------------------------------------------------------------ settings

  private showSettings(): void {
    const modal = document.getElementById('modal-container');
    if (!modal) return;
    let release = () => {};
    const close = () => {
      modal.replaceChildren();
      release();
    };

    const nameInput = el('input', { class: 'input', id: 'device-name', maxlength: '64', value: this.profile.name });
    const nameStatus = el('span', { class: 'muted small', role: 'status' });
    const saveBtn = el('button', { class: 'btn', type: 'button', id: 'btn-save-name' }, this.t.settingsSave);
    saveBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim().slice(0, 64);
      if (!name) return;
      this.profile = { ...this.profile, name };
      await saveProfile(this.profile);
      nameStatus.textContent = this.t.settingsSaved;
    });

    const row = (k: string, v: string) => el('div', { class: 'info-row' }, el('span', { class: 'info-key' }, k), el('span', { class: 'info-val' }, v));

    let pairingBlock: HTMLElement | null = null;
    if (this.pairing) {
      const p = this.pairing;
      const forget = el('button', { class: 'btn btn-danger', type: 'button', id: 'btn-forget-pairing' }, this.t.settingsForgetPairing);
      forget.addEventListener('click', async () => {
        if (!confirm(this.t.settingsForgetPairingConfirm)) return;
        await forgetPairing();
        this.pairing = null;
        close();
        this.render();
      });
      pairingBlock = el(
        'div',
        { class: 'settings-block' },
        el('h3', {}, this.t.settingsPairedDesktop),
        row('', p.name),
        row('ID', p.deviceId),
        row(this.t.settingsPairedAt, new Date(p.pairedAt).toLocaleString(this.lang)),
        row(this.t.settingsLabel, p.own ? this.t.settingsLabelMine : this.t.settingsLabelOther),
        forget,
      );
    }

    const forgetBrowserBtn = el('button', { class: 'btn btn-danger', type: 'button', id: 'btn-forget-browser' }, this.t.settingsForgetBrowser);
    forgetBrowserBtn.addEventListener('click', async () => {
      if (!confirm(this.t.settingsForgetBrowserConfirm)) return;
      await forgetBrowser();
      location.reload();
    });
    const closeBtn = el('button', { class: 'btn btn-primary', type: 'button' }, this.t.close);
    closeBtn.addEventListener('click', close);

    const card = el(
      'div',
      { class: 'modal-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'settings-title' },
      el('h2', { class: 'card-title', id: 'settings-title' }, this.t.settings),
      el(
        'div',
        { class: 'settings-block' },
        el('label', { class: 'label', for: 'device-name' }, this.t.settingsDeviceName),
        el('div', { class: 'inline' }, nameInput, saveBtn),
        nameStatus,
        el('p', { class: 'muted small' }, this.t.settingsDeviceNameHint),
      ),
      el('div', { class: 'settings-block' }, row(this.t.settingsDeviceId, this.key.deviceId)),
      pairingBlock,
      el('div', { class: 'settings-block' }, el('p', { class: 'muted small' }, this.t.settingsStorageNote), forgetBrowserBtn),
      el(
        'div',
        { class: 'settings-block' },
        el('h3', {}, this.t.settingsAbout),
        el('p', { class: 'muted small' }, this.t.settingsAboutBody),
        row(this.t.settingsVersion, __APP_VERSION__),
        el(
          'a',
          { class: 'link', href: 'https://github.com/ozdil/omasend-web', target: '_blank', rel: 'noopener noreferrer' },
          this.t.settingsSource,
        ),
      ),
      el('div', { class: 'actions' }, closeBtn),
    );
    modal.replaceChildren(el('div', { class: 'modal-backdrop' }, card));
    release = trapModal(card, close, nameInput);
  }

  private toast(msg: string): void {
    const toast = el('div', { class: 'toast-notification', role: 'status' }, msg);
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }
}
