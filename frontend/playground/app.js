const API_BASE = "";

const state = {
  userId: null,
  wallet: null,
  apiKey: null,
  services: [],
  selectedService: null,
};

const $ = (sel) => document.querySelector(sel);

const dom = {
  navbarWallet: $("#navbar-wallet"),
  btnConnectMain: $("#btn-connect-wallet-main"),
  btnConnectNav: $("#btn-connect-wallet"),

  disconnectedState: $("#playground-disconnected"),
  connectedState: $("#playground-connected"),

  serviceSelector: $("#service-selector"),
  serviceDescription: $("#service-description"),
  inputData: $("#input-data"),
  servicePrice: $("#service-price"),
  btnRunApi: $("#btn-run-api"),

  apiKeyInput: $("#playground-api-key"),
  btnToggleKey: $("#btn-toggle-key-visibility"),
  btnPasteKey: $("#btn-paste-key"),
  btnClearKey: $("#btn-clear-key"),

  outputContent: $("#output-content"),
  responseStatus: $("#response-status"),
  responseTime: $("#response-time"),
  btnCopyResponse: $("#btn-copy-response"),
  txInfoFooter: $("#tx-info-footer"),
  txExplorerLink: $("#tx-explorer-link"),
  btnCopyTx: $("#btn-copy-tx"),

  toastContainer: $("#toast-container"),

  mobileMenu: $("#mobile-menu"),
  mobileMenuBackdrop: $("#mobile-menu-backdrop"),
  btnMobileMenu: $("#btn-mobile-menu"),
  btnCloseMobileMenu: $("#btn-close-mobile-menu"),

  walletPanel: $("#wallet-panel"),
  walletBackdrop: $("#wallet-backdrop"),
  walletPanelBody: $("#wallet-panel-body"),
  btnDisconnectWallet: $("#btn-disconnect-wallet"),
  endpointUrl: $("#endpoint-url"),
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  initMobileMenu();
  initThemeToggle();
  bindEvents();
  restoreSession();
  fetchServices();
  
  if (dom.endpointUrl) {
    dom.endpointUrl.textContent = `${window.location.origin}${API_BASE}/run`;
  }
}

function initMobileMenu() {
  if (!dom.mobileMenu || !dom.btnMobileMenu) return;

  function openMobileMenu() {
    dom.mobileMenu.classList.add("open");
    dom.mobileMenu.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeMobileMenu() {
    dom.mobileMenu.classList.remove("open");
    dom.mobileMenu.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  dom.btnMobileMenu.addEventListener("click", openMobileMenu);
  if (dom.btnCloseMobileMenu) dom.btnCloseMobileMenu.addEventListener("click", closeMobileMenu);
  if (dom.mobileMenuBackdrop) dom.mobileMenuBackdrop.addEventListener("click", closeMobileMenu);

  dom.mobileMenu.querySelectorAll(".mobile-menu-link, .mobile-menu-btn, .mobile-menu-ext-link").forEach((link) => {
    link.addEventListener("click", closeMobileMenu);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && dom.mobileMenu.classList.contains("open")) {
      closeMobileMenu();
    }
  });
}

function initThemeToggle() {
  const toggleBtn = document.getElementById('theme-toggle');
  const moonIcon = document.getElementById('theme-icon-moon');
  const sunIcon = document.getElementById('theme-icon-sun');

  if (!toggleBtn) return;

  function updateIcon(theme) {
    if (theme === 'dark') {
      if (moonIcon) moonIcon.style.display = 'none';
      if (sunIcon) sunIcon.style.display = 'block';
    } else {
      if (moonIcon) moonIcon.style.display = 'block';
      if (sunIcon) sunIcon.style.display = 'none';
    }
  }

  updateIcon(document.documentElement.getAttribute('data-theme'));

  toggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    if (newTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('noviq_theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('noviq_theme', 'light');
    }
    updateIcon(newTheme);
  });
}

function bindEvents() {
  if (dom.btnConnectMain) dom.btnConnectMain.addEventListener("click", handleConnectWallet);
  if (dom.btnConnectNav) dom.btnConnectNav.addEventListener("click", handleConnectWallet);

  if (dom.btnDisconnectWallet) dom.btnDisconnectWallet.addEventListener("click", handleDisconnectWallet);
  if (dom.walletBackdrop) dom.walletBackdrop.addEventListener("click", closeWalletPanel);

  if (dom.serviceSelector) dom.serviceSelector.addEventListener("change", handleServiceSelection);
  if (dom.inputData) dom.inputData.addEventListener("input", updateRunButtonState);
  if (dom.btnRunApi) dom.btnRunApi.addEventListener("click", handleRunApi);
  if (dom.btnCopyResponse) dom.btnCopyResponse.addEventListener("click", handleCopyResponse);
  if (dom.btnCopyTx) dom.btnCopyTx.addEventListener("click", handleCopyTx);

  if (dom.btnToggleKey) dom.btnToggleKey.addEventListener("click", () => {
    if (dom.apiKeyInput.type === "password") {
      dom.apiKeyInput.type = "text";
      dom.btnToggleKey.querySelector("span").textContent = "Hide";
    } else {
      dom.apiKeyInput.type = "password";
      dom.btnToggleKey.querySelector("span").textContent = "Show";
    }
  });

  if (dom.btnPasteKey) dom.btnPasteKey.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      dom.apiKeyInput.value = text;
      state.apiKey = text.trim();
    } catch (err) {
      showToast("Failed to read clipboard", "error");
    }
  });

  if (dom.btnClearKey) dom.btnClearKey.addEventListener("click", () => {
    dom.apiKeyInput.value = "";
    state.apiKey = "";
  });

  if (dom.apiKeyInput) dom.apiKeyInput.addEventListener("input", () => {
    state.apiKey = dom.apiKeyInput.value.trim();
  });
}

function restoreSession() {
  const savedWallet = localStorage.getItem("noviq_wallet");
  const savedApiKey = localStorage.getItem("noviq_api_key");

  if (savedApiKey) {
    state.apiKey = savedApiKey;
    if (dom.apiKeyInput) {
      dom.apiKeyInput.value = state.apiKey;
    }
  }

  showConnectedState();

  if (!savedWallet) {
    return;
  }

  try {
    state.wallet = JSON.parse(savedWallet);
    state.userId = state.wallet.user_id;

    updateWalletUI();

    // refresh wallet balance silently
    fetch(`${API_BASE}/wallet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: state.userId }),
    })
      .then((r) => r.json())
      .then((w) => {
        state.wallet = w;
        localStorage.setItem("noviq_wallet", JSON.stringify(w));
        updateWalletUI();
      })
      .catch((e) => console.error("Silent wallet refresh failed", e));
  } catch (e) {
    console.error(e);
  }
}

async function fetchServices() {
  try {
    const res = await fetch(`${API_BASE}/services`);
    if (!res.ok) throw new Error("Failed to fetch services");
    state.services = await res.json();
    populateServiceSelector();
  } catch (err) {
    console.error(err);
    showToast("Error loading services.", "error");
  }
}

function populateServiceSelector() {
  if (!dom.serviceSelector) return;
  dom.serviceSelector.innerHTML = '<option value="" disabled selected>Select a service to run...</option>';
  state.services.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.name;
    dom.serviceSelector.appendChild(opt);
  });
}

function handleServiceSelection() {
  const selectedId = dom.serviceSelector.value;
  state.selectedService = state.services.find(s => s.id === selectedId);

  if (state.selectedService) {
    dom.serviceDescription.textContent = state.selectedService.description;
    dom.servicePrice.textContent = `$${state.selectedService.price_usdc} USDC`;
  }
  updateRunButtonState();
}

function updateRunButtonState() {
  const hasService = !!state.selectedService;
  const hasInput = !!dom.inputData.value.trim();
  dom.btnRunApi.disabled = !(hasService && hasInput);
}

async function handleRunApi() {
  if (!state.apiKey) {
    showToast("API Key is missing. Please reconnect or generate one.", "error");
    return;
  }
  if (!state.selectedService) return;

  const inputData = dom.inputData.value.trim();
  const serviceId = state.selectedService.id;

  setLoadingState(true);

  const startTime = performance.now();

  try {
    const res = await fetch(`${API_BASE}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${state.apiKey}`
      },
      body: JSON.stringify({
        service_id: serviceId,
        input_data: inputData
      })
    });

    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);

    const isSuccess = res.ok;
    const data = await res.json();

    renderResponse(isSuccess, res.status, duration, data);

    if (isSuccess && data.tx_hash) {
      // Refresh wallet balance silently
      fetch(`${API_BASE}/wallet/${encodeURIComponent(state.userId)}`, {
        headers: { "Authorization": `Bearer ${state.apiKey}` }
      })
        .then(r => r.json())
        .then(w => {
          state.wallet = w;
          localStorage.setItem("noviq_wallet", JSON.stringify(w));
          updateWalletUI();
        }).catch(() => { });
    }
  } catch (err) {
    console.error(err);
    renderResponse(false, 0, 0, { error: "Network error or failure to reach server." });
  } finally {
    setLoadingState(false);
  }
}

function renderResponse(isSuccess, status, duration, data) {
  dom.outputContent.innerHTML = "";

  dom.responseStatus.textContent = status ? `${status} ${isSuccess ? 'OK' : 'Error'}` : 'Error';
  dom.responseStatus.className = `response-badge ${isSuccess ? 'success' : 'error'}`;
  dom.responseStatus.classList.remove('hidden');

  if (duration) {
    dom.responseTime.textContent = `${duration}ms`;
    dom.responseTime.classList.remove('hidden');
  } else {
    dom.responseTime.classList.add('hidden');
  }

  dom.btnCopyResponse.classList.remove('hidden');

  // Format the output
  let displayStr = "";
  if (data.result !== undefined) {
    // If it's a string, just show the string, else pretty print JSON
    if (typeof data.result === 'string') {
      displayStr = data.result;
    } else {
      displayStr = JSON.stringify(data.result, null, 2);
    }
  } else {
    displayStr = JSON.stringify(data, null, 2);
  }

  const textNode = document.createTextNode(displayStr);
  dom.outputContent.appendChild(textNode);

  if (data.tx_hash) {
    dom.txInfoFooter.classList.remove('hidden');
    dom.txExplorerLink.textContent = truncateAddress(data.tx_hash, 10);
    // Construct arc testnet explorer link
    dom.txExplorerLink.href = `https://testnet.arc.explorer.network/tx/${data.tx_hash}`;
    dom.txExplorerLink.dataset.fullTx = data.tx_hash;
  } else {
    dom.txInfoFooter.classList.add('hidden');
  }
}

function handleCopyResponse() {
  const text = dom.outputContent.textContent;
  if (text) {
    navigator.clipboard.writeText(text);
    showToast("Response copied!", "success");
  }
}

function handleCopyTx() {
  const hash = dom.txExplorerLink.dataset.fullTx;
  if (hash) {
    navigator.clipboard.writeText(hash);
    showToast("Transaction hash copied!", "success");
  }
}

function setLoadingState(isLoading) {
  const loader = dom.btnRunApi.querySelector('.loader');
  const icon = dom.btnRunApi.querySelector('.run-icon');
  const text = dom.btnRunApi.querySelector('.btn-text');

  if (isLoading) {
    dom.btnRunApi.disabled = true;
    loader.classList.remove('hidden');
    icon.classList.add('hidden');
    text.textContent = "Running...";
    dom.inputData.disabled = true;
    dom.serviceSelector.disabled = true;

    dom.outputContent.innerHTML = `
      <div class="output-placeholder">
         <div class="loader" style="border-color: rgba(255,255,255,0.1); border-top-color: var(--accent-color); width: 32px; height: 32px;"></div>
         <p>Executing service...</p>
      </div>
    `;
    dom.responseStatus.classList.add('hidden');
    dom.responseTime.classList.add('hidden');
    dom.btnCopyResponse.classList.add('hidden');
    dom.txInfoFooter.classList.add('hidden');
  } else {
    dom.btnRunApi.disabled = false;
    loader.classList.add('hidden');
    icon.classList.remove('hidden');
    text.textContent = "Run API";
    dom.inputData.disabled = false;
    dom.serviceSelector.disabled = false;
  }
}


async function handleConnectWallet() {
  if (typeof window.ethereum === "undefined") {
    showToast("Please install MetaMask (or an EVM wallet) to connect.", "error");
    return;
  }

  // Disable buttons to prevent double-click / -32002 errors
  if (dom.btnConnectMain) {
    dom.btnConnectMain.disabled = true;
    dom.btnConnectMain.textContent = "Connecting...";
  }
  if (dom.btnConnectNav) {
    dom.btnConnectNav.disabled = true;
    dom.btnConnectNav.textContent = "Connecting...";
  }

  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    if (!accounts || accounts.length === 0) throw new Error("No accounts found.");

    state.userId = accounts[0];

    const resp = await fetch(`${API_BASE}/wallet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: state.userId }),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    state.wallet = await resp.json();
    state.userId = state.wallet.user_id;
    localStorage.setItem("noviq_wallet", JSON.stringify(state.wallet));

    updateWalletUI();

    // Load API key from localStorage if available
    const savedApiKey = localStorage.getItem("noviq_api_key");
    if (savedApiKey) {
      state.apiKey = savedApiKey;
      if (dom.apiKeyInput) {
        dom.apiKeyInput.value = state.apiKey;
      }
    }

    // Always show the connected playground so the user can paste their key
    showConnectedState();

    if (!savedApiKey) {
      showToast("Wallet connected! Paste your API key, or generate one from the API Keys page.", "info");
    } else {
      showToast("Wallet connected!", "success");
    }
  } catch (err) {
    console.error("Wallet connect error:", err);
    if (err.code === -32002 || (err.message && err.message.includes("already pending"))) {
      showToast("MetaMask is already open. Please click the MetaMask extension icon in your browser toolbar to continue.", "warning");
    } else {
      showToast(err.message || "Failed to connect wallet.", "error");
    }
  } finally {
    if (dom.btnConnectMain) {
      dom.btnConnectMain.disabled = false;
      dom.btnConnectMain.textContent = "Connect Wallet";
    }
    if (dom.btnConnectNav) {
      dom.btnConnectNav.disabled = false;
      if (!state.wallet) dom.btnConnectNav.textContent = "Connect Wallet";
    }
  }
}

function showDisconnectedState() {
  if (dom.disconnectedState) dom.disconnectedState.classList.add("hidden");
  if (dom.connectedState) dom.connectedState.classList.remove("hidden");
}

function showConnectedState() {
  if (dom.disconnectedState) dom.disconnectedState.classList.add("hidden");
  if (dom.connectedState) dom.connectedState.classList.remove("hidden");
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
  const addressChip = document.getElementById("nav-wallet-address");
  if (addressChip) addressChip.addEventListener("click", openWalletPanel);
}

function openWalletPanel() {
  if (!state.wallet) return;

  const balanceFormatted =
    state.wallet.usdc_balance > 0 && state.wallet.usdc_balance < 0.01
      ? state.wallet.usdc_balance.toFixed(3)
      : state.wallet.usdc_balance.toFixed(2);

  dom.walletPanelBody.innerHTML = `
    <div class="wallet-balance-display">
      <div class="wallet-balance-amount">$${balanceFormatted}</div>
      <div class="wallet-balance-currency">USDC on Arc Testnet</div>
    </div>
    ${walletDetailRow("Circle Address", state.wallet.address)}
    ${walletDetailRow("Wallet ID", state.wallet.wallet_id)}
    ${walletDetailRow("EVM Address", state.wallet.user_id)}
    <div class="wallet-detail">
      <span class="wallet-detail-label">Network</span>
      <div class="wallet-detail-value-wrapper wallet-detail-value-wrapper--static">
        <span class="wallet-detail-value" title="Arc Testnet">Arc Testnet</span>
      </div>
    </div>
  `;
  dom.walletPanel.classList.add("open");
}

function walletDetailRow(label, value) {
  const display = truncateAddress(value);
  return `
    <div class="wallet-detail">
      <span class="wallet-detail-label">${label}</span>
      <div class="wallet-detail-value-wrapper" onclick="navigator.clipboard.writeText('${escapeJsString(value)}'); showToast('${escapeJsString(label)} copied!', 'success');">
        <span class="wallet-detail-value" title="${value}">${display}</span>
        <svg class="wallet-detail-copy-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      </div>
    </div>
  `;
}

function closeWalletPanel() {
  dom.walletPanel.classList.remove("open");
}

function handleDisconnectWallet() {
  closeWalletPanel();
  state.wallet = null;
  state.apiKey = null;
  if (dom.apiKeyInput) dom.apiKeyInput.value = "";
  localStorage.removeItem("noviq_wallet");
  localStorage.removeItem("noviq_api_key");

  dom.navbarWallet.innerHTML = `<button class="btn btn-primary btn-sm" id="btn-connect-wallet">Connect Wallet</button>`;
  dom.btnConnectNav = document.getElementById("btn-connect-wallet");
  if (dom.btnConnectNav) dom.btnConnectNav.addEventListener("click", handleConnectWallet);

  showDisconnectedState();
  showToast("Wallet disconnected", "info");
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

function escapeJsString(str) {
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function truncateAddress(addr, chars = 6) {
  if (!addr || addr.length < 10) return addr;
  if (window.innerWidth <= 480) {
    return addr.slice(0, 4) + "···" + addr.slice(-3);
  }
  return addr.slice(0, chars) + "···" + addr.slice(-4);
}
