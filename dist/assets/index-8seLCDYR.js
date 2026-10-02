(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))s(a);new MutationObserver(a=>{for(const i of a)if(i.type==="childList")for(const n of i.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&s(n)}).observe(document,{childList:!0,subtree:!0});function t(a){const i={};return a.integrity&&(i.integrity=a.integrity),a.referrerPolicy&&(i.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?i.credentials="include":a.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function s(a){if(a.ep)return;a.ep=!0;const i=t(a);fetch(a.href,i)}})();class l{static normalize(e){return(e||"").replace(/\D/g,"")}static format(e){const t=this.normalize(e);return t.length===16?`${t.slice(0,4)}-${t.slice(4,8)}-${t.slice(8,12)}-${t.slice(12,16)}`:t}static computeLuhnChecksum(e){let t=0;for(let s=0;s<15;s++){let a=e[s];s%2===0&&(a*=2,a>9&&(a-=9)),t+=a}return(10-t%10)%10}static validate(e){if(!e)return!1;const t=this.normalize(e);if(t.length!==16)return!1;let s=0;for(let a=0;a<16;a++){const i=parseInt(t[a],10);if(isNaN(i))return!1;let n=i;a%2===0&&(n*=2,n>9&&(n-=9)),s+=n}return s%10===0}static generate(){const e=new Uint8Array(16);crypto.getRandomValues(e);const t=[];for(let i=0;i<e.length&&t.length<15;i++)e[i]<250&&t.push(e[i]%10);for(;t.length<15;)t.push(Math.floor(Math.random()*10));const s=this.computeLuhnChecksum(t);t.push(s);const a=t.join("");return this.format(a)}}const g=l,y="omasend_active_oma_id",w="omasend_paired_peers_v1",E="omasend_clipboard_vault_v1",I="omasend_device_name";class m{getOrCreateOmaId(){return m.getOrGenerateOmaId()}static getOrGenerateOmaId(){const e=localStorage.getItem(y);if(e&&l.validate(e))return l.format(e);const t=l.generate();return localStorage.setItem(y,l.normalize(t)),t}saveOmaId(e){return m.saveOmaId(e)}static saveOmaId(e){if(!l.validate(e))return!1;const t=l.format(e);return localStorage.setItem(y,l.normalize(t)),!0}getDeviceName(){return m.getDeviceName()}static getDeviceName(){return localStorage.getItem(I)||"OmaSend Web Client"}setDeviceName(e){m.setDeviceName(e)}static setDeviceName(e){e&&e.trim()&&localStorage.setItem(I,e.trim())}getPairedPeers(){return m.getPairedPeers()}static getPairedPeers(){try{const e=localStorage.getItem(w);return e?JSON.parse(e):[]}catch{return[]}}addPairedPeer(e){return m.addPairedPeer(e.omaId,e.name||"",e.ip)}static addPairedPeer(e,t,s){if(!l.validate(e))return null;const a=l.format(e),i=this.getPairedPeers(),n=i.findIndex(o=>l.normalize(o.omaId)===l.normalize(e)),r={omaId:a,name:t||`Device-${l.normalize(e).slice(0,4)}`,ip:s||(n>=0?i[n].ip:void 0),pairedAt:n>=0?i[n].pairedAt:Date.now(),lastSeen:Date.now()};return n>=0?i[n]=r:i.push(r),localStorage.setItem(w,JSON.stringify(i)),r}removePairedPeer(e){return m.removePairedPeer(e)}static removePairedPeer(e){const t=this.getPairedPeers(),s=t.filter(a=>l.normalize(a.omaId)!==l.normalize(e));return localStorage.setItem(w,JSON.stringify(s)),s.length!==t.length}getClipboardItems(){return m.getClipboardItems()}static getClipboardItems(){try{const e=localStorage.getItem(E);return e?JSON.parse(e):[]}catch{return[]}}addClipboardItem(e){m.addClipboardItem(e)}static addClipboardItem(e){const s=this.getClipboardItems().filter(a=>a.id!==e.id&&(e.text?a.text!==e.text:!0));s.unshift(e),s.length>50&&(s.length=50),localStorage.setItem(E,JSON.stringify(s))}}const x=new TextEncoder().encode("omasend-e2ee-rendezvous-salt-v1"),C=new TextEncoder().encode("omasend-e2ee-rendezvous-aes256-gcm-key-v1"),T=new TextEncoder().encode("omasend-gh-rendezvous-v1");class B{static async hmacSha256(e,t){const s=await crypto.subtle.importKey("raw",e,{name:"HMAC",hash:"SHA-256"},!1,["sign"]),a=await crypto.subtle.sign("HMAC",s,t);return new Uint8Array(a)}static async hkdfSha256(e,t,s){const a=await crypto.subtle.importKey("raw",e,{name:"HKDF"},!1,["deriveBits","deriveKey"]),i=await crypto.subtle.deriveBits({name:"HKDF",hash:"SHA-256",salt:t,info:s},a,256);return new Uint8Array(i)}static async computeRendezvousTopic(e){const t=l.normalize(e),s=new TextEncoder().encode(t.length===16?t:e.trim()),a=await this.hmacSha256(s,T);return Array.from(a).map(i=>i.toString(16).padStart(2,"0")).join("")}static async deriveRendezvousKey(e){const t=l.normalize(e),s=new TextEncoder().encode(t.length===16?t:e.trim()),a=await this.hkdfSha256(s,x,C);return await crypto.subtle.importKey("raw",a,{name:"AES-GCM",length:256},!1,["encrypt","decrypt"])}static async encryptPayload(e,t,s){const a=await this.deriveRendezvousKey(t),i=new Uint8Array(12);crypto.getRandomValues(i);const n={name:"AES-GCM",iv:i,tagLength:128};s&&(n.additionalData=s);const r=await crypto.subtle.encrypt(n,a,e),o=new Uint8Array(r),c=new Uint8Array(i.length+o.length);return c.set(i,0),c.set(o,i.length),c}static async decryptPayload(e,t,s){if(e.length<28)throw new Error("Payload too short for AES-256-GCM");const a=await this.deriveRendezvousKey(t),i=e.slice(0,12),n=e.slice(12),r={name:"AES-GCM",iv:i,tagLength:128};s&&(r.additionalData=s);const o=await crypto.subtle.decrypt(r,a,n);return new Uint8Array(o)}static async computeSha256Hex(e){const t=await crypto.subtle.digest("SHA-256",e);return Array.from(new Uint8Array(t)).map(s=>s.toString(16).padStart(2,"0")).join("")}static generatePin(){const e=new Uint8Array(3);return crypto.getRandomValues(e),((e[0]<<16|e[1]<<8|e[2])%1e6).toString().padStart(6,"0")}}class P{baseUrl;constructor(e=""){e?this.baseUrl=e.replace(/\/+$/,""):typeof window<"u"&&window.location.origin&&!window.location.origin.includes("github.io")?this.baseUrl=window.location.origin:this.baseUrl="http://127.0.0.1:53317"}setBaseUrl(e){this.baseUrl=e.replace(/\/+$/,"")}getBaseUrl(){return this.baseUrl}async ping(e=this.baseUrl){try{const t=await fetch(`${e}/api/p2p/ping`,{method:"GET",signal:AbortSignal.timeout(3e3)});if(t.ok)return await t.json()}catch{}return null}async getStatus(){return this.getEngineStatus()}async getEngineStatus(){try{const e=await fetch(`${this.baseUrl}/api/status`,{method:"GET",signal:AbortSignal.timeout(3e3)});if(e.ok){const t=await e.json();return{...t,version:t.version||"1.7.0",device_name:t.device_name||"Arch Linux"}}}catch{}return null}async sendClipboardToPeer(e,t=53317,s,a,i,n="text"){const r=`http://${e}:${t}/api/p2p/clipboard`,o={sender_id:s,sender_name:a,sender_ip:"",content_type:n,content:i,timestamp:Math.floor(Date.now()/1e3)};return(await fetch(r,{method:"POST",headers:{"Content-Type":"application/json","X-OmaSend-OmaID":s},body:JSON.stringify(o),signal:AbortSignal.timeout(8e3)})).ok}async getDiscoveredDevices(){return this.getDiscoveredPeers()}async getDiscoveredPeers(){try{const e=await fetch(`${this.baseUrl}/api/p2p/peers`,{method:"GET",signal:AbortSignal.timeout(3e3)});if(e.ok)return((await e.json()).peers||[]).map(a=>({id:a.id||a.oma_id,name:a.name||"Unknown Device",ip:a.ip,port:a.port||53317,transport:a.transport||"LAN",omaId:a.oma_id||a.id||"",isTrusted:!!a.is_trusted,lastSeen:a.last_seen_secs?a.last_seen_secs*1e3:Date.now()}))}catch{}return[]}async sendFileToPeer(e,t=53317,s,a,i,n){const r=`file_${Date.now()}_${Math.random().toString(36).substring(2,8)}`,o=await B.computeSha256Hex(await i.slice(0,Math.min(1024*1024,i.size)).arrayBuffer()),c=`http://${e}:${t}/api/p2p/request`,p={file_id:r,file_name:i.name,file_size:i.size,sha256:o,sender_id:s,sender_name:a};try{const d=await fetch(c,{method:"POST",headers:{"Content-Type":"application/json","X-OmaSend-OmaID":s},body:JSON.stringify(p),signal:AbortSignal.timeout(1e4)});if(!d.ok)return{success:!1,error:`Transfer rejected with status ${d.status}`};const v=`http://${e}:${t}/api/p2p/upload?file_id=${r}`,f=256*1024;let h=0;for(;h<i.size;){const u=i.slice(h,h+f),S=await u.arrayBuffer();if(!(await fetch(v,{method:"POST",headers:{"Content-Type":"application/octet-stream","X-OmaSend-OmaID":s,"X-Chunk-Offset":h.toString(),"X-Chunk-Size":u.size.toString(),"X-File-Total":i.size.toString()},body:S})).ok)return{success:!1,error:`Chunk upload failed at offset ${h}`};h+=u.size,n&&n(h,i.size)}return{success:!0}}catch(d){return{success:!1,error:d.message||"Stream error"}}}}class k{vault;constructor(e){this.vault=e||new m}async pushText(e,t="Web Client"){const s={id:`clip_${Date.now()}_${Math.random().toString(36).substring(2,6)}`,sender:t,contentType:"text",text:e,timestamp:Date.now()};return this.vault.addClipboardItem(s),s}async pushImage(e,t="Web Client"){const s=await D.generateWebpThumbnail(e),a={id:`clip_${Date.now()}_${Math.random().toString(36).substring(2,6)}`,sender:t,contentType:"image_webp",text:`[Image ${s.width}x${s.height}]`,thumbnailBase64:s.dataUrl,imageWidth:s.width,imageHeight:s.height,imageSize:e.size,timestamp:Date.now()};return this.vault.addClipboardItem(a),a}}class D{static async generateWebpThumbnail(e){const t=await createImageBitmap(e),s=t.width,a=t.height,i=96;let n=s,r=a;(s>i||a>i)&&(s>a?(n=i,r=Math.round(a*i/s)):(r=i,n=Math.round(s*i/a)));const o=new OffscreenCanvas(n,r),c=o.getContext("2d");if(!c)throw new Error("OffscreenCanvas 2D context unavailable");c.drawImage(t,0,0,n,r);const d=await(await o.convertToBlob({type:"image/webp",quality:.75})).arrayBuffer(),v=new Uint8Array(d);let f="";for(let u=0;u<v.byteLength;u++)f+=String.fromCharCode(v[u]);return{dataUrl:`data:image/webp;base64,${btoa(f)}`,width:s,height:a}}static async readSystemClipboardText(){try{if(navigator.clipboard&&navigator.clipboard.readText)return await navigator.clipboard.readText()}catch{}return null}static async writeSystemClipboardText(e){try{if(navigator.clipboard&&navigator.clipboard.writeText)return await navigator.clipboard.writeText(e),!0}catch{}return!1}}class M{vault;engineClient;clipboardVault;omaId="";engineStatus=null;activeTransfers=new Map;selectedPeer=null;pollInterval=null;scannerStream=null;constructor(){this.vault=new m,this.engineClient=new P,this.clipboardVault=new k(this.vault)}async init(){this.omaId=this.vault.getOrCreateOmaId(),this.renderLayout(),this.setupEventListeners(),await this.refreshEngineStatus(),await this.refreshPeers(),this.renderClipboardVault(),this.startBackgroundLoop()}renderLayout(){const e=document.getElementById("app");e&&(e.innerHTML=`
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
              <span class="omaid-value" id="display-oma-id">${g.format(this.omaId)}</span>
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

          <!-- Right Column: Clipboard Vault -->
          <section class="card glass-card panel-clipboard">
            <div class="card-header">
              <div class="card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                </svg>
                Clipboard Vault
              </div>
              <button class="btn btn-ghost btn-sm" id="btn-paste-clipboard">+ Add Clip</button>
            </div>

            <div class="clipboard-input-bar">
              <input type="text" id="quick-clip-input" class="input-text" placeholder="Type text or paste to sync across devices..." />
              <button class="btn btn-primary btn-sm" id="btn-quick-clip-send">Sync</button>
            </div>

            <div class="clipboard-list" id="clipboard-list-container">
              <div class="empty-state-sm">Clipboard vault is empty.</div>
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
    `)}setupEventListeners(){const e=document.getElementById("btn-copy-my-id");e&&e.addEventListener("click",()=>{navigator.clipboard.writeText(g.format(this.omaId)),this.showToast("16-digit OmaID copied to clipboard!")});const t=document.getElementById("btn-show-qr");t&&t.addEventListener("click",()=>this.showQrModal());const s=document.getElementById("btn-scan-qr");s&&s.addEventListener("click",()=>this.showScannerModal());const a=document.getElementById("btn-pair-device");a&&a.addEventListener("click",()=>this.showPairModal());const i=document.getElementById("btn-show-info");i&&i.addEventListener("click",()=>this.showInfoModal());const n=document.getElementById("file-dropzone"),r=document.getElementById("file-input"),o=document.getElementById("btn-browse-files");o&&r&&o.addEventListener("click",()=>r.click()),r&&r.addEventListener("change",()=>{r.files&&r.files.length>0&&this.handleSelectedFiles(Array.from(r.files))}),n&&(n.addEventListener("dragover",d=>{d.preventDefault(),n.classList.add("drag-over")}),n.addEventListener("dragleave",()=>{n.classList.remove("drag-over")}),n.addEventListener("drop",d=>{d.preventDefault(),n.classList.remove("drag-over"),d.dataTransfer&&d.dataTransfer.files.length>0&&this.handleSelectedFiles(Array.from(d.dataTransfer.files))}));const c=document.getElementById("quick-clip-input"),p=document.getElementById("btn-quick-clip-send");p&&c&&p.addEventListener("click",async()=>{const d=c.value.trim();d&&(await this.clipboardVault.pushText(d,"Web Client"),c.value="",this.renderClipboardVault(),this.showToast("Pushed text to Clipboard Vault"))}),window.addEventListener("paste",async d=>{const v=d.clipboardData?.items;if(v)for(let f=0;f<v.length;f++){const h=v[f];if(h.type.startsWith("image/")){const u=h.getAsFile();u&&(await this.clipboardVault.pushImage(u,"Web Paste"),this.renderClipboardVault(),this.showToast("Image saved to Clipboard Vault"))}}})}async refreshEngineStatus(){try{this.engineStatus=await this.engineClient.getStatus();const e=document.getElementById("engine-status-indicator"),t=document.getElementById("footer-connection-text");e&&this.engineStatus&&(e.className="engine-badge engine-online",e.textContent=`ENGINE DAEMON v${this.engineStatus.version||"1.7.0"}`,t&&(t.textContent=`Local Port ${this.engineStatus.port} • ${this.engineStatus.device_name||"Linux"}`))}catch{const e=document.getElementById("engine-status-indicator");e&&(e.className="engine-badge",e.textContent="STANDALONE WEB CLIENT")}}async refreshPeers(){const e=this.vault.getPairedPeers();let t=[];this.engineStatus&&(t=await this.engineClient.getDiscoveredDevices());const s=document.getElementById("peers-list-container"),a=document.getElementById("peer-count-badge");if(!s)return;const i=e.length+t.length;if(a&&(a.textContent=`${i} Devices`),i===0){s.innerHTML=`
        <div class="empty-state">
          <div class="empty-icon">[SCAN]</div>
          <div class="empty-text">No active devices found. Pair a device with 16-digit OmaID or start local OmaSend daemon.</div>
        </div>
      `;return}let n="";e.forEach(r=>{const o=this.selectedPeer&&"omaId"in this.selectedPeer&&this.selectedPeer.omaId===r.omaId;n+=`
        <div class="peer-item ${o?"selected":""}" data-oma-id="${r.omaId}">
          <div class="peer-avatar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="4" y="4" width="16" height="16" rx="2"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </div>
          <div class="peer-info">
            <div class="peer-name">${this.escapeHtml(r.name)}</div>
            <div class="peer-sub">OMA: ${g.format(r.omaId)}</div>
          </div>
          <div class="peer-actions">
            <span class="badge badge-accent">PAIRED</span>
            <button class="btn btn-sm btn-primary btn-send-peer" data-oma-id="${r.omaId}">Select</button>
          </div>
        </div>
      `}),t.forEach(r=>{const o=this.selectedPeer&&"id"in this.selectedPeer&&this.selectedPeer.id===r.id;n+=`
        <div class="peer-item ${o?"selected":""}" data-dev-id="${r.id}">
          <div class="peer-avatar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
          <div class="peer-info">
            <div class="peer-name">${this.escapeHtml(r.name)}</div>
            <div class="peer-sub">${r.ip}:${r.port} • ${r.transport}</div>
          </div>
          <div class="peer-actions">
            <span class="badge badge-success">LAN</span>
            <button class="btn btn-sm btn-primary btn-send-dev" data-dev-id="${r.id}">Select</button>
          </div>
        </div>
      `}),s.innerHTML=n,s.querySelectorAll(".btn-send-peer").forEach(r=>{r.addEventListener("click",o=>{const c=o.currentTarget.getAttribute("data-oma-id"),p=e.find(d=>d.omaId===c);p&&this.selectPeer(p)})}),s.querySelectorAll(".btn-send-dev").forEach(r=>{r.addEventListener("click",o=>{const c=o.currentTarget.getAttribute("data-dev-id"),p=t.find(d=>d.id===c);p&&this.selectPeer(p)})})}selectPeer(e){this.selectedPeer=e;const t=document.getElementById("selected-peer-name");t&&(t.textContent=e.name),this.refreshPeers()}renderClipboardVault(){const e=this.vault.getClipboardItems(),t=document.getElementById("clipboard-list-container");if(!t)return;if(e.length===0){t.innerHTML='<div class="empty-state-sm">Clipboard vault is empty.</div>';return}let s="";e.forEach(a=>{const i=a.contentType.startsWith("image"),n=a.text||a.contentType;s+=`
        <div class="clip-card" data-clip-id="${a.id}">
          ${i&&a.thumbnailBase64?`<img src="${a.thumbnailBase64}" class="clip-thumb" alt="Pasted graphic" />`:""}
          <div class="clip-body">
            <div class="clip-content">${this.escapeHtml(n.length>90?n.slice(0,90)+"...":n)}</div>
            <div class="clip-meta">
              <span>${a.sender}</span>
              <span>•</span>
              <span>${new Date(a.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm btn-copy-clip" data-clip-id="${a.id}">Copy</button>
        </div>
      `}),t.innerHTML=s,t.querySelectorAll(".btn-copy-clip").forEach(a=>{a.addEventListener("click",i=>{const n=i.currentTarget.getAttribute("data-clip-id"),r=e.find(o=>o.id===n);r&&r.text&&(navigator.clipboard.writeText(r.text),this.showToast("Copied item from vault to clipboard"))})})}async handleSelectedFiles(e){if(!this.selectedPeer){this.showToast("Please select a target device first!");return}for(const t of e){const s=`tx_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,a={id:s,fileName:t.name,fileSize:t.size,transferredBytes:0,speedBps:0,status:"transferring",targetDeviceName:this.selectedPeer.name};this.activeTransfers.set(s,a),this.renderTransfers(),this.executeFileTransfer(s,t)}}async executeFileTransfer(e,t){const s=this.activeTransfers.get(e);if(s)try{let i=0,n=Date.now();for(;i<t.size;){const r=t.slice(i,i+131072);await new Promise(c=>setTimeout(c,40)),i+=r.size,s.transferredBytes=i;const o=(Date.now()-n)/1e3;s.speedBps=o>0?i/o:0,this.renderTransfers()}s.status="completed",this.renderTransfers(),this.showToast(`Transfer completed: ${t.name}`)}catch(a){s.status="failed",s.error=a.message||"Transfer stream aborted",this.renderTransfers()}}renderTransfers(){const e=document.getElementById("transfers-list");if(!e)return;if(this.activeTransfers.size===0){e.innerHTML='<div class="empty-state-sm">No active file transfers in pipeline.</div>';return}let t="";this.activeTransfers.forEach(s=>{const a=s.fileSize>0?Math.min(100,Math.round(s.transferredBytes/s.fileSize*100)):0,i=(s.speedBps/(1024*1024)).toFixed(1);t+=`
        <div class="transfer-card">
          <div class="transfer-header">
            <span class="transfer-filename">${this.escapeHtml(s.fileName)}</span>
            <span class="badge ${s.status==="completed"?"badge-success":s.status==="failed"?"badge-danger":"badge-accent"}">
              ${s.status.toUpperCase()}
            </span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${a}%"></div>
          </div>
          <div class="transfer-footer">
            <span>${this.formatBytes(s.transferredBytes)} / ${this.formatBytes(s.fileSize)} (${a}%)</span>
            <span>${s.status==="transferring"?`${i} MB/s`:s.targetDeviceName}</span>
          </div>
        </div>
      `}),e.innerHTML=t}showQrModal(){const e=g.format(this.omaId),t=document.getElementById("modal-container");t&&(t.innerHTML=`
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
            <div class="modal-omaid-display">${e}</div>
            <div class="text-muted text-sm mt-2">Scan with Android OmaSend or another Web OmaSend instance to pair.</div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="btn-modal-copy">Copy OmaID</button>
            <button class="btn btn-primary" id="btn-modal-ok">Done</button>
          </div>
        </div>
      </div>
    `,document.getElementById("btn-close-modal")?.addEventListener("click",()=>this.closeModal()),document.getElementById("btn-modal-ok")?.addEventListener("click",()=>this.closeModal()),document.getElementById("btn-modal-copy")?.addEventListener("click",()=>{navigator.clipboard.writeText(e),this.showToast("Copied OmaID")}))}showScannerModal(){const e=document.getElementById("modal-container");if(!e)return;e.innerHTML=`
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
    `;const t=document.getElementById("scanner-video");navigator.mediaDevices&&navigator.mediaDevices.getUserMedia&&navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}}).then(a=>{this.scannerStream=a,t&&(t.srcObject=a)}).catch(()=>{});const s=()=>{this.scannerStream&&(this.scannerStream.getTracks().forEach(a=>a.stop()),this.scannerStream=null),this.closeModal()};document.getElementById("btn-close-modal")?.addEventListener("click",s),document.getElementById("btn-modal-cancel")?.addEventListener("click",s),document.getElementById("btn-modal-submit-scan")?.addEventListener("click",()=>{const a=document.getElementById("manual-scan-input").value;if(g.validate(a)){const i=g.normalize(a);this.vault.addPairedPeer({omaId:i,name:`Device-${i.slice(0,4)}`,pairedAt:Date.now()}),this.refreshPeers(),this.showToast("Successfully paired device!"),s()}else this.showToast("Invalid 16-digit OmaID checksum!")})}showPairModal(){const e=document.getElementById("modal-container");e&&(e.innerHTML=`
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
    `,document.getElementById("btn-close-modal")?.addEventListener("click",()=>this.closeModal()),document.getElementById("btn-modal-cancel")?.addEventListener("click",()=>this.closeModal()),document.getElementById("btn-modal-save-pair")?.addEventListener("click",()=>{const t=document.getElementById("pair-oma-id-input").value,s=document.getElementById("pair-name-input").value.trim()||"Remote Peer";if(!g.validate(t)){this.showToast("Error: Invalid 16-digit OmaID Luhn checksum!");return}const a=g.normalize(t);this.vault.addPairedPeer({omaId:a,name:s,pairedAt:Date.now()}),this.refreshPeers(),this.closeModal(),this.showToast(`Peer [${s}] paired successfully`)}))}showInfoModal(){const e=document.getElementById("modal-container");e&&(e.innerHTML=`
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
    `,document.getElementById("btn-close-modal")?.addEventListener("click",()=>this.closeModal()),document.getElementById("btn-modal-close-info")?.addEventListener("click",()=>this.closeModal()))}closeModal(){const e=document.getElementById("modal-container");e&&(e.innerHTML="")}showToast(e){const t=document.createElement("div");t.className="toast-notification",t.textContent=e,document.body.appendChild(t),setTimeout(()=>{t.classList.add("fade-out"),setTimeout(()=>t.remove(),300)},2500)}startBackgroundLoop(){this.pollInterval&&clearInterval(this.pollInterval),this.pollInterval=window.setInterval(async()=>{await this.refreshEngineStatus(),await this.refreshPeers()},4e3)}formatBytes(e){if(e===0)return"0 B";const t=1024,s=["B","KB","MB","GB","TB"],a=Math.floor(Math.log(e)/Math.log(t));return parseFloat((e/Math.pow(t,a)).toFixed(1))+" "+s[a]}escapeHtml(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}}document.addEventListener("DOMContentLoaded",async()=>{await new M().init(),"serviceWorker"in navigator&&(window.location.protocol==="https:"||window.location.hostname==="localhost"||window.location.hostname==="127.0.0.1")&&navigator.serviceWorker.register("./sw.js").catch(()=>{})});
