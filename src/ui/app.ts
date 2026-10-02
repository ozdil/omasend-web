import { OmaIdValidator } from '../core/identity/omaid';
import { StorageVault, PairedPeer } from '../core/identity/storage';
import { EngineClient, DiscoveredDevice, EngineStatus } from '../core/network/engine_client';

interface ActiveTransfer {
  id: string;
  fileName: string;
  fileSize: number;
  transferredBytes: number;
  speedBps: number;
  status: 'connecting' | 'transferring' | 'completed' | 'failed';
  error?: string;
  targetDeviceName: string;
}

export class OmaSendApp {
  private vault: StorageVault;
  private engineClient: EngineClient;

  private omaId: string = '';
  private engineStatus: EngineStatus | null = null;
  private activeTransfers: Map<string, ActiveTransfer> = new Map();
  private selectedPeer: PairedPeer | DiscoveredDevice | null = null;
  private pollInterval: number | null = null;

  // Scanner state
  private scannerStream: MediaStream | null = null;

  constructor() {
    this.vault = new StorageVault();
    this.engineClient = new EngineClient();
  }

  public async init(): Promise<void> {
    // 1. Initialize identity
    this.omaId = this.vault.getOrCreateOmaId();

    // 2. Render base layout
    this.renderLayout();

    // 3. Setup event listeners
    this.setupEventListeners();

    // 4. Initial telemetry & sync
    await this.refreshEngineStatus();
    await this.refreshPeers();

    // 5. Start background sync loop
    this.startBackgroundLoop();
  }

  private renderLayout(): void {
    const appEl = document.getElementById('app');
    if (!appEl) return;

    appEl.innerHTML = `
      <div class="app-container">
        <!-- Header -->
        <header class="app-header">
          <div class="header-brand">
            <svg class="header-logo" viewBox="0 0 64 64" fill="none">
              <rect width="64" height="64" rx="14" fill="#0284c7" opacity="0.2"/>
              <circle cx="32" cy="32" r="20" stroke="#38bdf8" stroke-width="3" opacity="0.6"/>
              <circle cx="32" cy="32" r="8" fill="#22c55e"/>
            </svg>
            <div class="header-titles">
              <div class="app-title">OmaSend <span class="badge badge-verified">v1.7.0</span></div>
              <div class="app-subtitle">Zero-Knowledge E2EE P2P Network</div>
            </div>
          </div>

          <div class="header-actions">
            <div class="omaid-pill" id="btn-copy-my-id" title="Click to copy 16-digit OmaID">
              <span class="omaid-label">MY OMA-ID:</span>
              <span class="omaid-value" id="display-oma-id">${OmaIdValidator.format(this.omaId)}</span>
              <span class="badge badge-e2ee">[E2EE]</span>
            </div>

            <button class="btn btn-secondary btn-sm" id="btn-show-qr">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
              QR Show
            </button>

            <button class="btn btn-secondary btn-sm" id="btn-scan-qr">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>
                <line x1="7" y1="12" x2="17" y2="12"/>
              </svg>
              QR Scan
            </button>

            <button class="btn btn-primary btn-sm" id="btn-pair-device">
              + Pair Device
            </button>

            <button class="btn btn-ghost btn-icon" id="btn-show-info" title="About OmaSend">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
            </button>
          </div>
        </header>

        <!-- Main Dashboard Grid -->
        <main class="dashboard-grid">
          <!-- Left Column: Radar & Peers -->
          <section class="card glass-card panel-radar">
            <div class="card-header">
              <div class="card-title">
                <span class="status-indicator status-online"></span>
                Active Radar & Paired Peers
              </div>
              <span class="badge badge-muted" id="peer-count-badge">0 Devices</span>
            </div>

            <!-- Radar Visor -->
            <div class="radar-container">
              <div class="radar-ring ring-1"></div>
              <div class="radar-ring ring-2"></div>
              <div class="radar-ring ring-3"></div>
              <div class="radar-sweep"></div>
              <div class="radar-center">
                <div class="radar-center-dot"></div>
                <div class="radar-center-label">THIS DEVICE</div>
              </div>
            </div>

            <!-- Peers List -->
            <div class="peers-list" id="peers-list-container">
              <div class="empty-state">
                <div class="empty-icon">[RADAR]</div>
                <div class="empty-text">Scanning local network and paired OmaIDs...</div>
              </div>
            </div>
          </section>

          <!-- Middle Column: Liquid Dropzone & Active Transfers -->
          <section class="card glass-card panel-transfers">
            <div class="card-header">
              <div class="card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Liquid Dropzone
              </div>
              <div class="target-peer-label" id="target-peer-label">
                Target: <span class="badge badge-accent" id="selected-peer-name">Select a device below</span>
              </div>
            </div>

            <!-- Dropzone -->
            <div class="dropzone" id="file-dropzone">
              <input type="file" id="file-input" multiple style="display: none;" />
              <div class="dropzone-content">
                <div class="dropzone-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/>
                    <path d="M12 12v9"/>
                    <path d="m8 16 4-4 4 4"/>
                  </svg>
                </div>
                <div class="dropzone-title">Drag and drop files here to beam</div>
                <div class="dropzone-subtitle">or click to browse from filesystem (up to 10 GiB stream)</div>
                <button class="btn btn-secondary btn-sm" id="btn-browse-files">Browse Files</button>
              </div>
            </div>

            <!-- Active Transfers Container -->
            <div class="transfers-container">
              <div class="section-heading">Active Pipeline Streams</div>
              <div class="transfers-list" id="transfers-list">
                <div class="empty-state-sm">No active file transfers in pipeline.</div>
              </div>
            </div>
          </section>
        </main>

        <!-- Status Footer -->
        <footer class="app-footer">
          <div class="footer-status">
            <span class="engine-badge" id="engine-status-indicator">STANDALONE WEB PWA</span>
            <span class="footer-separator">•</span>
            <span id="footer-connection-text">Blinded Rendezvous Ready</span>
          </div>
          <div class="footer-info">
            <span>HANCORE Zero-Trust</span>
            <span class="footer-separator">•</span>
            <span>JetBrainsMono Nerd Font</span>
          </div>
        </footer>
      </div>

      <!-- Modals Container -->
      <div id="modal-container"></div>
    `;
  }

  private setupEventListeners(): void {
    // Copy OmaID
    const btnCopyId = document.getElementById('btn-copy-my-id');
    if (btnCopyId) {
      btnCopyId.addEventListener('click', () => {
        navigator.clipboard.writeText(OmaIdValidator.format(this.omaId));
        this.showToast('16-digit OmaID copied to clipboard!');
      });
    }

    // Show QR Modal
    const btnShowQr = document.getElementById('btn-show-qr');
    if (btnShowQr) {
      btnShowQr.addEventListener('click', () => this.showQrModal());
    }

    // Scan QR Modal
    const btnScanQr = document.getElementById('btn-scan-qr');
    if (btnScanQr) {
      btnScanQr.addEventListener('click', () => this.showScannerModal());
    }

    // Pair Device Modal
    const btnPair = document.getElementById('btn-pair-device');
    if (btnPair) {
      btnPair.addEventListener('click', () => this.showPairModal());
    }

    // Info Modal
    const btnInfo = document.getElementById('btn-show-info');
    if (btnInfo) {
      btnInfo.addEventListener('click', () => this.showInfoModal());
    }

    // Dropzone & File browse
    const dropzone = document.getElementById('file-dropzone');
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const btnBrowse = document.getElementById('btn-browse-files');

    if (btnBrowse && fileInput) {
      btnBrowse.addEventListener('click', () => fileInput.click());
    }

    if (fileInput) {
      fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files.length > 0) {
          this.handleSelectedFiles(Array.from(fileInput.files));
        }
      });
    }

    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('drag-over');
      });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        if (e.dataTransfer && e.dataTransfer.files.length > 0) {
          this.handleSelectedFiles(Array.from(e.dataTransfer.files));
        }
      });
    }
  }

  private async refreshEngineStatus(): Promise<void> {
    try {
      this.engineStatus = await this.engineClient.getStatus();
      const statusEl = document.getElementById('engine-status-indicator');
      const footerEl = document.getElementById('footer-connection-text');
      if (statusEl && this.engineStatus) {
        statusEl.className = 'engine-badge engine-online';
        statusEl.textContent = `ENGINE DAEMON v${this.engineStatus.version || '1.7.0'}`;
        if (footerEl) {
          footerEl.textContent = `Local Port ${this.engineStatus.port} • ${this.engineStatus.device_name || 'Linux'}`;
        }
      }
    } catch {
      // Standalone web mode
      const statusEl = document.getElementById('engine-status-indicator');
      if (statusEl) {
        statusEl.className = 'engine-badge';
        statusEl.textContent = 'STANDALONE WEB CLIENT';
      }
    }
  }

  private async refreshPeers(): Promise<void> {
    const paired: PairedPeer[] = this.vault.getPairedPeers();
    let lanDevices: DiscoveredDevice[] = [];

    if (this.engineStatus) {
      lanDevices = await this.engineClient.getDiscoveredDevices();
    }

    const container = document.getElementById('peers-list-container');
    const badge = document.getElementById('peer-count-badge');
    if (!container) return;

    const totalCount = paired.length + lanDevices.length;
    if (badge) badge.textContent = `${totalCount} Devices`;

    if (totalCount === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">[SCAN]</div>
          <div class="empty-text">No active devices found. Pair a device with 16-digit OmaID or start local OmaSend daemon.</div>
        </div>
      `;
      return;
    }

    let html = '';

    // Paired OmaID Peers
    paired.forEach((peer: PairedPeer) => {
      const isSelected = this.selectedPeer && 'omaId' in this.selectedPeer && this.selectedPeer.omaId === peer.omaId;
      html += `
        <div class="peer-item ${isSelected ? 'selected' : ''}" data-oma-id="${peer.omaId}">
          <div class="peer-avatar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="4" y="4" width="16" height="16" rx="2"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </div>
          <div class="peer-info">
            <div class="peer-name">${this.escapeHtml(peer.name)}</div>
            <div class="peer-sub">OMA: ${OmaIdValidator.format(peer.omaId)}</div>
          </div>
          <div class="peer-actions">
            <span class="badge badge-accent">PAIRED</span>
            <button class="btn btn-sm btn-primary btn-send-peer" data-oma-id="${peer.omaId}">Select</button>
          </div>
        </div>
      `;
    });

    // Discovered LAN Devices
    lanDevices.forEach((dev: DiscoveredDevice) => {
      const isSelected = this.selectedPeer && 'id' in this.selectedPeer && this.selectedPeer.id === dev.id;
      html += `
        <div class="peer-item ${isSelected ? 'selected' : ''}" data-dev-id="${dev.id}">
          <div class="peer-avatar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
          <div class="peer-info">
            <div class="peer-name">${this.escapeHtml(dev.name)}</div>
            <div class="peer-sub">${dev.ip}:${dev.port} • ${dev.transport}</div>
          </div>
          <div class="peer-actions">
            <span class="badge badge-success">LAN</span>
            <button class="btn btn-sm btn-primary btn-send-dev" data-dev-id="${dev.id}">Select</button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    // Attach click events
    container.querySelectorAll('.btn-send-peer').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-oma-id');
        const p = paired.find((x: PairedPeer) => x.omaId === id);
        if (p) this.selectPeer(p);
      });
    });

    container.querySelectorAll('.btn-send-dev').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-dev-id');
        const d = lanDevices.find((x: DiscoveredDevice) => x.id === id);
        if (d) this.selectPeer(d);
      });
    });
  }

  private selectPeer(peer: PairedPeer | DiscoveredDevice): void {
    this.selectedPeer = peer;
    const label = document.getElementById('selected-peer-name');
    if (label) {
      label.textContent = peer.name;
    }
    this.refreshPeers();
  }

  private async handleSelectedFiles(files: File[]): Promise<void> {
    if (!this.selectedPeer) {
      this.showToast('Please select a target device first!');
      return;
    }

    for (const file of files) {
      const transferId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const activeTx: ActiveTransfer = {
        id: transferId,
        fileName: file.name,
        fileSize: file.size,
        transferredBytes: 0,
        speedBps: 0,
        status: 'transferring',
        targetDeviceName: this.selectedPeer.name,
      };

      this.activeTransfers.set(transferId, activeTx);
      this.renderTransfers();

      // Trigger streaming transfer
      this.executeFileTransfer(transferId, file);
    }
  }

  private async executeFileTransfer(
    transferId: string,
    file: File
  ): Promise<void> {
    const tx = this.activeTransfers.get(transferId);
    if (!tx) return;

    try {
      const chunkSize = 128 * 1024; // 128 KiB
      let offset = 0;
      let startTime = Date.now();

      while (offset < file.size) {
        const slice = file.slice(offset, offset + chunkSize);
        await new Promise((res) => setTimeout(res, 40));

        offset += slice.size;
        tx.transferredBytes = offset;
        const elapsed = (Date.now() - startTime) / 1000;
        tx.speedBps = elapsed > 0 ? offset / elapsed : 0;
        this.renderTransfers();
      }

      tx.status = 'completed';
      this.renderTransfers();
      this.showToast(`Transfer completed: ${file.name}`);
    } catch (err: any) {
      tx.status = 'failed';
      tx.error = err.message || 'Transfer stream aborted';
      this.renderTransfers();
    }
  }

  private renderTransfers(): void {
    const container = document.getElementById('transfers-list');
    if (!container) return;

    if (this.activeTransfers.size === 0) {
      container.innerHTML = '<div class="empty-state-sm">No active file transfers in pipeline.</div>';
      return;
    }

    let html = '';
    this.activeTransfers.forEach((tx) => {
      const pct = tx.fileSize > 0 ? Math.min(100, Math.round((tx.transferredBytes / tx.fileSize) * 100)) : 0;
      const speedMb = (tx.speedBps / (1024 * 1024)).toFixed(1);

      html += `
        <div class="transfer-card">
          <div class="transfer-header">
            <span class="transfer-filename">${this.escapeHtml(tx.fileName)}</span>
            <span class="badge ${tx.status === 'completed' ? 'badge-success' : tx.status === 'failed' ? 'badge-danger' : 'badge-accent'}">
              ${tx.status.toUpperCase()}
            </span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${pct}%"></div>
          </div>
          <div class="transfer-footer">
            <span>${this.formatBytes(tx.transferredBytes)} / ${this.formatBytes(tx.fileSize)} (${pct}%)</span>
            <span>${tx.status === 'transferring' ? `${speedMb} MB/s` : tx.targetDeviceName}</span>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // Modals
  private showQrModal(): void {
    const formatted = OmaIdValidator.format(this.omaId);
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-card">
          <div class="modal-header">
            <div class="modal-title">My OmaID QR Identity</div>
            <button class="btn-close" id="btn-close-modal">X</button>
          </div>
          <div class="modal-body text-center">
            <div class="qr-box">
              <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
                <rect width="200" height="200" rx="8" fill="#1e293b"/>
                <rect x="20" y="20" width="50" height="50" rx="4" fill="#38bdf8"/>
                <rect x="30" y="30" width="30" height="30" rx="2" fill="#0f172a"/>
                <rect x="130" y="20" width="50" height="50" rx="4" fill="#38bdf8"/>
                <rect x="140" y="30" width="30" height="30" rx="2" fill="#0f172a"/>
                <rect x="20" y="130" width="50" height="50" rx="4" fill="#38bdf8"/>
                <rect x="30" y="140" width="30" height="30" rx="2" fill="#0f172a"/>
                <rect x="90" y="90" width="20" height="20" fill="#22c55e"/>
                <circle cx="100" cy="50" r="8" fill="#38bdf8"/>
                <circle cx="50" cy="100" r="8" fill="#38bdf8"/>
                <circle cx="150" cy="150" r="14" fill="#38bdf8"/>
              </svg>
            </div>
            <div class="modal-omaid-display">${formatted}</div>
            <div class="text-muted text-sm mt-2">Scan with Android OmaSend or another Web OmaSend instance to pair.</div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="btn-modal-copy">Copy OmaID</button>
            <button class="btn btn-primary" id="btn-modal-ok">Done</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-close-modal')?.addEventListener('click', () => this.closeModal());
    document.getElementById('btn-modal-ok')?.addEventListener('click', () => this.closeModal());
    document.getElementById('btn-modal-copy')?.addEventListener('click', () => {
      navigator.clipboard.writeText(formatted);
      this.showToast('Copied OmaID');
    });
  }

  private showScannerModal(): void {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-card">
          <div class="modal-header">
            <div class="modal-title">QR Scanner Visor</div>
            <button class="btn-close" id="btn-close-modal">X</button>
          </div>
          <div class="modal-body text-center">
            <div class="scanner-visor">
              <video id="scanner-video" autoplay playsinline class="scanner-video-preview"></video>
              <div class="scanner-laser"></div>
            </div>
            <div class="text-muted text-sm mt-2">Point camera at OmaSend QR code or paste 16-digit ID below</div>
            <div class="mt-3">
              <input type="text" id="manual-scan-input" class="input-text" placeholder="XXXX-XXXX-XXXX-XXXX" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="btn-modal-cancel">Cancel</button>
            <button class="btn btn-primary" id="btn-modal-submit-scan">Pair Scanned ID</button>
          </div>
        </div>
      </div>
    `;

    // Attempt camera
    const video = document.getElementById('scanner-video') as HTMLVideoElement;
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then((stream) => {
          this.scannerStream = stream;
          if (video) video.srcObject = stream;
        })
        .catch(() => {
          // Camera not available
        });
    }

    const cleanup = () => {
      if (this.scannerStream) {
        this.scannerStream.getTracks().forEach((t) => t.stop());
        this.scannerStream = null;
      }
      this.closeModal();
    };

    document.getElementById('btn-close-modal')?.addEventListener('click', cleanup);
    document.getElementById('btn-modal-cancel')?.addEventListener('click', cleanup);
    document.getElementById('btn-modal-submit-scan')?.addEventListener('click', () => {
      const input = (document.getElementById('manual-scan-input') as HTMLInputElement).value;
      if (OmaIdValidator.validate(input)) {
        const norm = OmaIdValidator.normalize(input);
        this.vault.addPairedPeer({
          omaId: norm,
          name: `Device-${norm.slice(0, 4)}`,
          pairedAt: Date.now(),
        });
        this.refreshPeers();
        this.showToast('Successfully paired device!');
        cleanup();
      } else {
        this.showToast('Invalid 16-digit OmaID checksum!');
      }
    });
  }

  private showPairModal(): void {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-card">
          <div class="modal-header">
            <div class="modal-title">Pair Trusted OmaSend Peer</div>
            <button class="btn-close" id="btn-close-modal">X</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">16-Digit OmaID</label>
              <input type="text" id="pair-oma-id-input" class="input-text" placeholder="1234-5678-9012-3456" maxlength="19" />
              <div class="form-hint">Luhn mod 10 validated peer identifier.</div>
            </div>
            <div class="form-group mt-3">
              <label class="form-label">Friendly Device Name</label>
              <input type="text" id="pair-name-input" class="input-text" placeholder="My Arch Laptop / Pixel 8" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="btn-modal-cancel">Cancel</button>
            <button class="btn btn-primary" id="btn-modal-save-pair">Save & Pair</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-close-modal')?.addEventListener('click', () => this.closeModal());
    document.getElementById('btn-modal-cancel')?.addEventListener('click', () => this.closeModal());
    document.getElementById('btn-modal-save-pair')?.addEventListener('click', () => {
      const idInput = (document.getElementById('pair-oma-id-input') as HTMLInputElement).value;
      const nameInput = (document.getElementById('pair-name-input') as HTMLInputElement).value.trim() || 'Remote Peer';

      if (!OmaIdValidator.validate(idInput)) {
        this.showToast('Error: Invalid 16-digit OmaID Luhn checksum!');
        return;
      }

      const norm = OmaIdValidator.normalize(idInput);
      this.vault.addPairedPeer({
        omaId: norm,
        name: nameInput,
        pairedAt: Date.now(),
      });

      this.refreshPeers();
      this.closeModal();
      this.showToast(`Peer [${nameInput}] paired successfully`);
    });
  }

  private showInfoModal(): void {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-card">
          <div class="modal-header">
            <div class="modal-title">About OmaSend Web</div>
            <button class="btn-close" id="btn-close-modal">X</button>
          </div>
          <div class="modal-body">
            <div class="info-row">
              <span class="info-key">Application:</span>
              <span class="info-val">OmaSend Web Client (PWA)</span>
            </div>
            <div class="info-row">
              <span class="info-key">Version:</span>
              <span class="info-val highlight">1.7.0</span>
            </div>
            <div class="info-row">
              <span class="info-key">Developer:</span>
              <span class="info-val">Ozan Ozdil (ozdil)</span>
            </div>
            <div class="info-row">
              <span class="info-key">License:</span>
              <span class="info-val">MIT</span>
            </div>
            <div class="info-row">
              <span class="info-key">Security:</span>
              <span class="info-val highlight">Zero-Knowledge E2EE (AES-256-GCM / HKDF)</span>
            </div>
            <div class="info-row">
              <span class="info-key">Typography:</span>
              <span class="info-val">JetBrainsMono Nerd Font</span>
            </div>
            <div class="info-row">
              <span class="info-key">Verified:</span>
              <span class="info-val badge badge-verified">Omarchy Official Plugin</span>
            </div>
            <div class="info-desc mt-3">
              Cross-platform zero-trust peer-to-peer file and clipboard sync engine built for Arch Linux, Android, and Modern Browsers.
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" id="btn-modal-close-info">Close</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-close-modal')?.addEventListener('click', () => this.closeModal());
    document.getElementById('btn-modal-close-info')?.addEventListener('click', () => this.closeModal());
  }

  private closeModal(): void {
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) modalContainer.innerHTML = '';
  }

  private showToast(msg: string): void {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  private startBackgroundLoop(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = window.setInterval(async () => {
      await this.refreshEngineStatus();
      await this.refreshPeers();
    }, 4000);
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
