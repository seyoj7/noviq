const API_BASE = "";

const state = {
  userId: null,
  wallet: null,
  apiKey: null,       // Active raw API key (stored in localStorage)
  apiKeys: [],        // List of key records (prefix, label, etc.)
  services: [],
  selectedService: null,
  isProcessing: false,
  history: [],
};

const $ = (sel) => document.querySelector(sel);

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
  btnCopySnippet: $("#btn-copy-snippet"),

  snippetPython: $("#snippet-python"),
  snippetNode: $("#snippet-node"),
  snippetServiceId: $("#snippet-service-id"),
  snippetInputData: $("#snippet-input-data"),
  snippetServiceIdNode: $("#snippet-service-id-node"),
  snippetInputDataNode: $("#snippet-input-data-node"),
  snippetTabsContainer: $(".code-snippet-tabs"),

  // API Key management elements removed as they moved to api-keys.js
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  initSnippetPanel();
  updateSnippetDomain();
  restoreWalletSession();
  bindEvents();
  fetchServices();

  if (!localStorage.getItem("noviq_wallet")) {
    renderHistory();
  }

  initScrollEffects();
}

function updateSnippetDomain() {
  const origin = window.location.origin;
  [dom.snippetPython, dom.snippetNode].forEach((el) => {
    if (el) {
      el.innerHTML = el.innerHTML.replace(/https:\/\/YOUR_DOMAIN/g, origin);
    }
  });

  // Re-bind snippet DOM elements because innerHTML replacement detached the original nodes
  dom.snippetServiceId = $("#snippet-service-id");
  dom.snippetInputData = $("#snippet-input-data");
  dom.snippetServiceIdNode = $("#snippet-service-id-node");
  dom.snippetInputDataNode = $("#snippet-input-data-node");
}

function initSnippetPanel() {
  if (dom.btnCopySnippet) {
    dom.btnCopySnippet.addEventListener("click", handleCopySnippet);
  }

  if (dom.snippetTabsContainer) {
    dom.snippetTabsContainer.addEventListener("click", handleSnippetTabClick);
  }
}

function restoreWalletSession() {
  const savedWallet = localStorage.getItem("noviq_wallet");
  const savedApiKey = localStorage.getItem("noviq_api_key");
  if (!savedWallet) return;

  try {
    state.wallet = JSON.parse(savedWallet);
    state.userId = state.wallet.user_id;
    if (savedApiKey) {
      state.apiKey = savedApiKey;
    }
    updateWalletUI();
    loadHistoryFromStorage();

    apiFetch("/wallet", {
      method: "POST",
      body: JSON.stringify({ user_id: state.userId }),
    })
      .then((r) => r.json())
      .then((w) => {
        state.wallet = w;
        state.userId = w.user_id;
        localStorage.setItem("noviq_wallet", JSON.stringify(w));
        updateWalletUI();
      })
      .catch((e) => console.error("Silent wallet refresh failed", e));
  } catch (e) {
    console.error(e);
  }
}

function bindEvents() {
  dom.btnConnect.addEventListener("click", handleConnectWallet);
  dom.btnGetStarted.addEventListener("click", () => {
    document.getElementById("services").scrollIntoView({ behavior: "smooth" });
  });
  dom.btnBackToServices.addEventListener("click", handleBackToServices);
  dom.btnDisconnectWallet.addEventListener("click", handleDisconnectWallet);
  dom.walletBackdrop.addEventListener("click", closeWalletPanel);

  // API Key management events moved to api-keys.js
}

function initScrollEffects() {
  let ticking = false;

  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        const scrolled = window.scrollY > 40;
        dom.navbar.classList.toggle("scrolled", scrolled);
        document.body.classList.toggle("page-scrolled", scrolled);
        ticking = false;
      });
    },
    { passive: true }
  );
}

function handleSnippetTabClick(e) {
  const tab = e.target.closest(".snippet-tab");
  if (!tab) return;

  dom.snippetTabsContainer
    .querySelectorAll(".snippet-tab")
    .forEach((t) => t.classList.remove("active"));
  tab.classList.add("active");

  const isPython = tab.dataset.target === "python";
  dom.snippetPython.classList.toggle("hidden", !isPython);
  dom.snippetNode.classList.toggle("hidden", isPython);
}

function handleCopySnippet() {
  const activeTab =
    document.querySelector(".snippet-tab.active")?.dataset.target || "python";

  const serviceId =
    activeTab === "python"
      ? dom.snippetServiceId?.textContent || '"token_price"'
      : dom.snippetServiceIdNode?.textContent || '"token_price"';
  const inputData =
    activeTab === "python"
      ? dom.snippetInputData?.textContent || '"bitcoin"'
      : dom.snippetInputDataNode?.textContent || '"bitcoin"';

  const apiKeyPlaceholder = state.apiKey || "nvq_YOUR_API_KEY";

  const textToCopy =
    activeTab === "python"
      ? `import requests\n\nresponse = requests.post("${window.location.origin}/run",\n    headers={"Authorization": "Bearer ${apiKeyPlaceholder}"},\n    json={\n        "service_id": ${serviceId},\n        "input_data": ${inputData}\n})\nprint(response.json()["result"])`
      : `const response = await fetch("${window.location.origin}/run", {\n    method: "POST",\n    headers: {\n        "Content-Type": "application/json",\n        "Authorization": "Bearer ${apiKeyPlaceholder}"\n    },\n    body: JSON.stringify({\n        "service_id": ${serviceId},\n        "input_data": ${inputData}\n    })\n});\nconst data = await response.json();\nconsole.log(data.result);`;

  navigator.clipboard.writeText(textToCopy);
  showToast(
    `${activeTab === "python" ? "Python" : "Node.js"} snippet copied!`,
    "success"
  );
}

async function apiFetch(path, options = {}) {
  const { headers: customHeaders, ...restOptions } = options;
  const mergedHeaders = { "Content-Type": "application/json", ...customHeaders };

  // Auto-attach API key if one is stored
  if (state.apiKey && !mergedHeaders["Authorization"]) {
    mergedHeaders["Authorization"] = `Bearer ${state.apiKey}`;
  }

  return fetch(`${API_BASE}${path}`, {
    ...restOptions,
    headers: mergedHeaders,
  });
}

async function fetchServices() {
  try {
    const resp = await fetch(`${API_BASE}/services`, {
      headers: { "Content-Type": "application/json" },
    });
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
    showToast("Server not reachable", "error");
  }
}

function renderServiceCards() {
  dom.servicesGrid.innerHTML = "";

  state.services.forEach((service, index) => {
    const card = document.createElement("div");
    card.className = "agent-card service-card";
    card.style.animationDelay = `${index * 0.1}s`;
    card.dataset.serviceId = service.id;

    const priceFormatted =
      service.price_usdc < 0.01
        ? service.price_usdc.toFixed(3)
        : service.price_usdc.toFixed(2);

    card.innerHTML = `
      <div class="agent-card-header">
        <span class="agent-card-name">${escapeHtml(service.name)}</span>
        <span class="agent-card-price agent-card-price--accent">$${priceFormatted} USDC</span>
      </div>
      <p class="agent-card-desc">${escapeHtml(service.description)}</p>
      <div class="agent-card-footer">
        <span class="agent-card-cta">API Integration →</span>
      </div>
    `;

    card.addEventListener("click", () => selectService(service));
    dom.servicesGrid.appendChild(card);
  });
}

const EXAMPLE_INPUTS = {
  token_price: "bitcoin",
  twitter_fetch: "elonmusk",
  "llama-3.1-8b-instruct": "What is the capital of France?",
};

function selectService(service) {
  state.selectedService = service;

  const exampleInput = EXAMPLE_INPUTS[service.id] || "example_data";

  updateSnippetValues(service.id, exampleInput);
}

function updateSnippetValues(serviceId, exampleInput) {
  const idText = `"${serviceId}"`;
  const inputText = `"${exampleInput}"`;

  if (dom.snippetServiceId) dom.snippetServiceId.textContent = idText;
  if (dom.snippetInputData) dom.snippetInputData.textContent = inputText;
  if (dom.snippetServiceIdNode) dom.snippetServiceIdNode.textContent = idText;
  if (dom.snippetInputDataNode)
    dom.snippetInputDataNode.textContent = inputText;
}

function handleBackToServices() {
  state.selectedService = null;
  dom.serviceWorkspace.classList.add("hidden");
  document.getElementById("services").scrollIntoView({ behavior: "smooth" });
}

async function runService(serviceId, inputData) {
  if (!state.apiKey) {
    throw new Error("No API key set. Please generate an API key first.");
  }

  const body = JSON.stringify({
    service_id: serviceId,
    input_data: inputData,
  });

  const firstResp = await apiFetch("/run-service", {
    method: "POST",
    body,
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
      headers: { "X-Payment-Authorization": authSignature },
      body,
    });

    if (!retryResp.ok) {
      const errData = await retryResp.json().catch(() => ({}));
      throw new Error(
        errData.detail || `Service run failed (${retryResp.status})`
      );
    }
    return retryResp.json();
  }

  if (firstResp.ok) {
    return firstResp.json();
  }

  const errData = await firstResp.json().catch(() => ({}));
  throw new Error(errData.detail || `Request failed (${firstResp.status})`);
}

async function handleRunService() {
  if (!state.selectedService || state.isProcessing) return;

  if (!state.apiKey) {
    showToast(
      "Please generate an API key first (connect wallet → API Keys).",
      "error"
    );
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
        from:
          state.wallet?.address ||
          "0xDEMO0000000000000000000000000000000000000000",
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
  showToast("Service completed — payment authorized!", "success");

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
  if (typeof window.ethereum === "undefined") {
    showToast(
      "Please install MetaMask (or an EVM wallet) to connect.",
      "error"
    );
    return;
  }

  dom.btnConnect.disabled = true;
  dom.btnConnect.textContent = "Connecting...";

  try {
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts found.");
    }

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
    loadHistoryFromStorage();
    showToast("Wallet connected!", "success");
    openWalletPanel();
  } catch (err) {
    console.error("Wallet connect error:", err);
    if (err.code === -32002 || err.message.includes("already pending")) {
      showToast(
        "MetaMask is already open. Please click the MetaMask extension icon in your browser toolbar to continue.",
        "warning"
      );
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
  state.apiKeys = [];
  localStorage.removeItem("noviq_wallet");
  localStorage.removeItem("noviq_api_key");

  dom.navbarWallet.innerHTML = `<button class="btn btn-primary btn-sm" id="btn-connect-wallet">Connect Wallet</button>`;
  dom.btnConnect = document.getElementById("btn-connect-wallet");
  dom.btnConnect.addEventListener("click", handleConnectWallet);

  showToast("Wallet disconnected", "info");
}


// ── History ─────────────────────────────────────────────────────────

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
      const isFailed = entry.status === "failed";
      const statusLabel = isFailed ? "Failed" : "Done";
      const statusClass = isFailed ? "failed" : "done";
      const statusIcon = isFailed ? "❌" : "✅";
      const txRef = entry.txHash || entry.paymentRef;

      const time = new Date(entry.time).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      });

      const costFormatted =
        entry.cost > 0 && entry.cost < 0.01
          ? entry.cost.toFixed(3)
          : entry.cost.toFixed(2);

      return `
        <tr>
          <td class="history-cell-time">${time}</td>
          <td>${escapeHtml(entry.agent)}</td>
          <td class="history-cell-cost">$${costFormatted}</td>
          <td><span class="status-badge ${statusClass}">${statusIcon} ${statusLabel}</span></td>
          <td>
            <div class="history-tx-wrapper">
              <a href="https://testnet.arcscan.app/tx/${txRef}" target="_blank" rel="noopener noreferrer" class="ref-mono history-tx-link">
                ${truncateRef(txRef)}
              </a>
              <svg class="history-tx-copy-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" onclick="navigator.clipboard.writeText('${escapeJsString(txRef)}'); showToast('Tx Hash copied!', 'success');" title="Copy to clipboard">
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
}

function loadHistoryFromStorage() {
  if (!state.userId) return;
  state.history = [];

  apiFetch(`/transactions/${state.userId}`)
    .then((r) => (r.ok ? r.json() : []))
    .then((serverTx) => {
      if (serverTx.length > 0) {
        state.history = serverTx.sort(
          (a, b) => new Date(b.time) - new Date(a.time)
        );
      }
      renderHistory();
    })
    .catch(() => renderHistory());
}


// ── Utilities ───────────────────────────────────────────────────────

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

const _escapeEl = document.createElement("span");

function escapeHtml(str) {
  _escapeEl.textContent = str;
  return _escapeEl.innerHTML;
}

function escapeJsString(str) {
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
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
