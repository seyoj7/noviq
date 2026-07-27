const API_BASE = "http://localhost:8000";


const state = {
  userId: null,
  wallet: null,
  services: [],
  selectedService: null,
  isProcessing: false,
  history: [],
};


const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  navbar: $("#navbar"),
  navbarWallet: $("#navbar-wallet"),
  btnConnect: $("#btn-connect-wallet"),
  btnGetStarted: $("#btn-get-started"),

  servicesGrid: $("#services-grid"),
  serviceWorkspace: $("#service-workspace"),
  btnBackToServices: $("#btn-back-to-services"),
  selectedServiceName: $("#selected-service-name"),
  selectedServicePrice: $("#selected-service-price"),

  walletPanel: $("#wallet-panel"),
  walletBackdrop: $("#wallet-backdrop"),
  walletPanelBody: $("#wallet-panel-body"),
  btnDisconnectWallet: $("#btn-disconnect-wallet"),

  historySection: $("#history"),
  historyTbody: $("#history-tbody"),
  historyEmpty: $("#history-empty"),

  toastContainer: $("#toast-container"),
};


document.addEventListener("DOMContentLoaded", () => {
  const savedWallet = localStorage.getItem("noviq_wallet");
  if (savedWallet) {
    try {
      state.wallet = JSON.parse(savedWallet);
      state.userId = state.wallet.user_id;
      updateWalletUI();
      loadHistoryFromStorage();

      apiFetch("/wallet", {
        method: "POST",
        body: JSON.stringify({ user_id: state.userId }),
      }).then(r => r.json()).then(w => {
        state.wallet = w;
        localStorage.setItem("noviq_wallet", JSON.stringify(w));
      }).catch(e => console.error("Silent wallet refresh failed", e));
    } catch (e) {
      console.error(e);
    }
  }

  bindEvents();
  fetchServices();
  if (!savedWallet) renderHistory();
  initScrollEffects();
});


function bindEvents() {

  dom.btnConnect.addEventListener("click", handleConnectWallet);
  dom.btnGetStarted.addEventListener("click", () => {
    document.getElementById("services").scrollIntoView({ behavior: "smooth" });
  });


  dom.btnBackToServices.addEventListener("click", handleBackToServices);


  dom.btnDisconnectWallet.addEventListener("click", handleDisconnectWallet);
  dom.walletBackdrop.addEventListener("click", closeWalletPanel);
}

function initScrollEffects() {

  window.addEventListener("scroll", () => {
    if (window.scrollY > 40) {
      dom.navbar.classList.add("scrolled");
    } else {
      dom.navbar.classList.remove("scrolled");
    }
  });
}


async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const { headers: customHeaders, ...restOptions } = options;
  const resp = await fetch(url, {
    ...restOptions,
    headers: { "Content-Type": "application/json", ...customHeaders },
  });
  return resp;
}

async function fetchServices() {
  try {
    const resp = await apiFetch("/services");
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    state.services = await resp.json();
    renderServiceCards();
  } catch (err) {
    console.error("Failed to fetch services:", err);
    dom.servicesGrid.innerHTML = `
      <div class="agents-error">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <h3>Services Unavailable</h3>
      </div>
    `;
    showToast(
      "Backend not reachable. Ensure FastAPI is running.",
      "error"
    );
  }
}

function renderServiceCards() {
  dom.servicesGrid.innerHTML = "";

  state.services.forEach((service, index) => {
    const isLocked = service.id === "twitter_fetch" || service.id === "youtube_fetch";
    const card = document.createElement("div");
    card.className = "agent-card service-card";
    if (isLocked) {
      card.style.opacity = "0.5";
      card.style.cursor = "not-allowed";
      card.style.pointerEvents = "none";
    }
    card.style.animationDelay = `${index * 0.1}s`;
    card.dataset.serviceId = service.id;

    const nameText = service.name;
    const ctaText = isLocked ? "🔒 Coming Soon" : "Run Service →";

    card.innerHTML = `
      <div class="agent-card-header">
        <span class="agent-card-name">${escapeHtml(nameText)}</span>
        <span class="agent-card-price" style="color: var(--accent-secondary); border-color: var(--accent-secondary);">$${service.price_usdc.toFixed(2)} USDC</span>
      </div>
      <p class="agent-card-desc">${escapeHtml(service.description)}</p>
      <div class="agent-card-footer">
        <span class="agent-card-cta">${ctaText}</span>
      </div>
    `;

    if (!isLocked) {
      card.addEventListener("click", () => selectService(service));
    }
    dom.servicesGrid.appendChild(card);
  });
}

function selectService(service) {
  state.selectedService = service;

  const snippetSection = document.getElementById("global-snippet");
  if (snippetSection) {
    snippetSection.scrollIntoView({ behavior: "smooth", block: "center" });

    snippetSection.style.transition = "transform 0.3s ease";
    snippetSection.style.transform = "scale(1.02)";
    setTimeout(() => {
      snippetSection.style.transform = "scale(1)";
    }, 300);
  }

  showToast(`Services are API-only. See the integration snippet above!`, "info");
}

function handleBackToServices() {
  state.selectedService = null;
  dom.serviceWorkspace.classList.add("hidden");
  document.getElementById("services").scrollIntoView({ behavior: "smooth" });
}


async function handleRunAction() {
  await handleRunService();
}

async function runService(serviceId, inputData) {
  const firstResp = await apiFetch("/run-service", {
    method: "POST",
    body: JSON.stringify({
      service_id: serviceId,
      input_data: inputData,
      user_id: state.userId,
    }),
  });

  if (firstResp.status === 402) {
    const challenge = await firstResp.json();
    showToast(
      `Payment required: $${challenge.price_usdc} USDC — signing authorization...`,
      "info"
    );
    const authSignature = await signPaymentAuthorization(challenge);

    const retryResp = await apiFetch("/run-service", {
      method: "POST",
      headers: {
        "X-Payment-Authorization": authSignature,
      },
      body: JSON.stringify({
        service_id: serviceId,
        input_data: inputData,
        user_id: state.userId,
      }),
    });

    if (!retryResp.ok) {
      const errData = await retryResp.json().catch(() => ({}));
      throw new Error(errData.detail || `Service run failed (${retryResp.status})`);
    }
    return await retryResp.json();
  } else if (firstResp.ok) {
    return await firstResp.json();
  } else {
    const errData = await firstResp.json().catch(() => ({}));
    throw new Error(errData.detail || `Request failed (${firstResp.status})`);
  }
}

async function handleRunService() {
  if (!state.selectedService || state.isProcessing) return;

  if (!state.userId) {
    showToast("Please connect your wallet first to run this service.", "error");
    return;
  }

  state.isProcessing = true;

  try {
    const result = await runService(state.selectedService.id, "query");
    handleServiceResult(result);
  } catch (err) {
    console.error("Run service error:", err);
    showToast(err.message || "Something went wrong.", "error");
  } finally {
    state.isProcessing = false;
  }
}


async function signPaymentAuthorization(challenge) {

  await sleep(600);


  const demoAuth = {
    scheme: "x402",
    networkId: String(challenge.chain_id),
    payload: {
      signature: "0x" + "ab".repeat(65),
      authorization: {
        from: state.wallet?.address || "0xDEMO0000000000000000000000000000000000000000",
        to: challenge.seller_address,
        value: String(challenge.price_usdc_atomic),
        validAfter: "0",
        validBefore: String(Math.floor(Date.now() / 1000) + 3600),
        nonce: crypto.randomUUID().replace(/-/g, "").slice(0, 64),
      },
    },
  };

  return JSON.stringify(demoAuth);
}

function handleServiceResult(result) {

  showToast(
    "Service completed — payment authorized!",
    "success"
  );


  addHistoryEntry({
    agent: state.selectedService.name,
    agentId: state.selectedService.id,
    cost: state.selectedService.price_usdc,
    status: "verified",
    txHash: result.payment_ref || "—",
    time: new Date().toISOString(),
  });


  if (state.wallet) {
    state.wallet.usdc_balance = Math.max(
      0,
      state.wallet.usdc_balance - state.selectedService.price_usdc
    );
    updateWalletUI();
  }
}




async function handleConnectWallet() {
  if (typeof window.ethereum === 'undefined') {
    showToast("Please install MetaMask (or an EVM wallet) to connect.", "error");
    return;
  }

  dom.btnConnect.disabled = true;
  dom.btnConnect.textContent = "Connecting...";

  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts found.");
    }
    const evmAddress = accounts[0];
    state.userId = evmAddress;

    const resp = await apiFetch("/wallet", {
      method: "POST",
      body: JSON.stringify({ user_id: state.userId }),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    state.wallet = await resp.json();
    localStorage.setItem("noviq_wallet", JSON.stringify(state.wallet));
    updateWalletUI();
    loadHistoryFromStorage();
    showToast("Wallet connected!", "success");
    openWalletPanel();
  } catch (err) {
    console.error("Wallet connect error:", err);
    if (err.code === -32002 || err.message.includes('already pending')) {
      showToast("MetaMask is already open. Please click the MetaMask extension icon in your browser toolbar to continue.", "warning");
    } else {
      showToast(err.message || "Failed to connect wallet.", "error");
    }
  } finally {
    dom.btnConnect.disabled = false;
    if (!state.wallet) {
      dom.btnConnect.textContent = "Connect Wallet";
    }
  }
}

function updateWalletUI() {
  if (!state.wallet) return;

  dom.navbarWallet.innerHTML = `
    <div class="navbar-wallet-info">
      <div class="wallet-address-chip" id="nav-wallet-address" title="${state.wallet.user_id}">
        ${truncateAddress(state.wallet.user_id)}
      </div>
    </div>
  `;


  const btnFaucet = document.getElementById("btn-faucet");
  if (btnFaucet) {
    btnFaucet.href = `https://faucet.circle.com/?address=${state.wallet.address}`;
  }


  const addressChip = document.getElementById("nav-wallet-address");
  if (addressChip) addressChip.addEventListener("click", openWalletPanel);
}

function openWalletPanel() {
  if (!state.wallet) return;

  const copyableRow = (val, displayVal, lbl) => `
    <div class="wallet-detail-value-wrapper" style="display: flex; align-items: center; cursor: pointer; opacity: 0.8; transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.8" onclick="navigator.clipboard.writeText('${escapeJsString(val)}'); showToast('${escapeJsString(lbl)} copied!', 'success');">
      <span class="wallet-detail-value" title="${val}">${displayVal}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 6px;">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    </div>
  `;

  dom.walletPanelBody.innerHTML = `
    <div class="wallet-balance-display">
      <div class="wallet-balance-amount">$${state.wallet.usdc_balance.toFixed(2)}</div>
      <div class="wallet-balance-currency">USDC on Arc Testnet</div>
    </div>
    <div class="wallet-detail">
      <span class="wallet-detail-label">Circle Address</span>
      ${copyableRow(state.wallet.address, truncateAddress(state.wallet.address), 'Circle Address')}
    </div>
    <div class="wallet-detail">
      <span class="wallet-detail-label">Wallet ID</span>
      ${copyableRow(state.wallet.wallet_id, truncateAddress(state.wallet.wallet_id), 'Wallet ID')}
    </div>
    <div class="wallet-detail">
      <span class="wallet-detail-label">EVM Address</span>
      ${copyableRow(state.wallet.user_id, truncateAddress(state.wallet.user_id), 'EVM Address')}
    </div>
    <div class="wallet-detail">
      <span class="wallet-detail-label">Network</span>
      <div class="wallet-detail-value-wrapper" style="opacity: 0.8;">
        <span class="wallet-detail-value" title="Arc Testnet">Arc Testnet</span>
      </div>
    </div>
    <div style="margin-top: var(--space-sm); text-align: center;">
      <p style="font-size: 0.65rem; color: var(--text-tertiary); line-height: 1.4;">
        This is a developer-controlled Circle wallet created for you automatically.
      </p>
    </div>
  `;

  dom.walletPanel.classList.add("open");
}

function closeWalletPanel() {
  dom.walletPanel.classList.remove("open");
}

function handleDisconnectWallet() {
  closeWalletPanel();
  state.wallet = null;
  localStorage.removeItem("noviq_wallet");

  dom.navbarWallet.innerHTML = `<button class="btn btn-primary btn-sm" id="btn-connect-wallet">Connect Wallet</button>`;
  dom.btnConnect = document.getElementById("btn-connect-wallet");
  dom.btnConnect.addEventListener("click", handleConnectWallet);

  showToast("Wallet disconnected", "info");
}


function addHistoryEntry(entry) {
  state.history.unshift(entry);
  saveHistoryToStorage();
  renderHistory();
}

function renderHistory() {
  dom.historySection.classList.remove("hidden");

  if (state.history.length === 0) {
    dom.historyTbody.innerHTML = "";
    dom.historyEmpty.classList.remove("hidden");
    return;
  }

  dom.historyEmpty.classList.add("hidden");

  dom.historyTbody.innerHTML = state.history
    .map((entry) => {
      let statusLabel = "Done";
      let statusClass = "done";
      let statusIcon = "✅";
      if (entry.status === "failed") {
        statusLabel = "Failed";
        statusClass = "failed";
        statusIcon = "❌";
      }

      const time = new Date(entry.time).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata'
      });

      return `
        <tr>
          <td style="color:var(--text-tertiary);">${time}</td>
          <td>${escapeHtml(entry.agent)}</td>
          <td style="font-family:var(--font-mono);color:var(--success);">$${entry.cost.toFixed(2)}</td>
          <td><span class="status-badge ${statusClass}">${statusIcon} ${statusLabel}</span></td>
          <td>
            <div style="display: inline-flex; align-items: center; justify-content: center; opacity: 0.8; transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.8">
              <a href="https://testnet.arcscan.app/tx/${entry.txHash || entry.paymentRef}" target="_blank" rel="noopener noreferrer" class="ref-mono" style="color: inherit; text-decoration: underline;">
                ${truncateRef(entry.txHash || entry.paymentRef)}
              </a>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 6px; cursor: pointer;" onclick="navigator.clipboard.writeText('${escapeJsString(entry.txHash || entry.paymentRef)}'); showToast('Tx Hash copied!', 'success');" title="Copy to clipboard">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function saveHistoryToStorage() {
  try {
    if (!state.userId) return;
    localStorage.setItem(
      "noviq_history_" + state.userId,
      JSON.stringify(state.history.slice(0, 50))
    );
  } catch {

  }
}

function loadHistoryFromStorage() {
  try {
    if (!state.userId) return;
    const stored = localStorage.getItem("noviq_history_" + state.userId);
    if (stored) {
      state.history = JSON.parse(stored);
      renderHistory();
    } else {
      state.history = [];
      renderHistory();
    }
  } catch {

    state.history = [];
  }
}


function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  dom.toastContainer.appendChild(toast);


  setTimeout(() => {
    toast.classList.add("removing");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
window.showToast = showToast;


function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function escapeJsString(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function truncateAddress(addr) {
  if (!addr || addr.length < 12) return addr;
  return addr.slice(0, 6) + "···" + addr.slice(-4);
}

function truncateRef(ref) {
  if (!ref || ref.length < 16) return ref;
  return ref.slice(0, 8) + "···" + ref.slice(-8);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
