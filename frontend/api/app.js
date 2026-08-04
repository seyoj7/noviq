const API_BASE = "";

const state = {
  userId: null,
  wallet: null,
  apiKey: null,
  apiKeys: [],
};

const $ = (sel) => document.querySelector(sel);

const dom = {
  navbarWallet: $("#navbar-wallet"),
  btnConnectMain: $("#btn-connect-wallet-main"),
  btnConnectNav: $("#btn-connect-wallet"),
  
  disconnectedState: $("#api-keys-disconnected"),
  connectedState: $("#api-keys-connected"),

  btnGenerateApiKey: $("#btn-generate-api-key"),
  apiKeyLabelInput: $("#api-key-label-input"),
  apiKeyCreated: $("#api-key-created"),
  apiKeyCreatedValue: $("#api-key-created-value"),
  btnCopyNewKey: $("#btn-copy-new-key"),
  apiKeyList: $("#api-key-list"),
  apiKeyListEmpty: $("#api-key-list-empty"),
  
  toastContainer: $("#toast-container"),
  
  walletPanel: $("#wallet-panel"),
  walletBackdrop: $("#wallet-backdrop"),
  walletPanelBody: $("#wallet-panel-body"),
  btnDisconnectWallet: $("#btn-disconnect-wallet"),
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  bindEvents();
  restoreWalletSession();
}

function bindEvents() {
  if (dom.btnConnectMain) dom.btnConnectMain.addEventListener("click", handleConnectWallet);
  if (dom.btnConnectNav) dom.btnConnectNav.addEventListener("click", handleConnectWallet);
  
  if (dom.btnGenerateApiKey) dom.btnGenerateApiKey.addEventListener("click", handleGenerateApiKey);
  if (dom.btnCopyNewKey) dom.btnCopyNewKey.addEventListener("click", handleCopyNewKey);
  
  if (dom.btnDisconnectWallet) dom.btnDisconnectWallet.addEventListener("click", handleDisconnectWallet);
  if (dom.walletBackdrop) dom.walletBackdrop.addEventListener("click", closeWalletPanel);
}

function restoreWalletSession() {
  const savedWallet = localStorage.getItem("noviq_wallet");
  const savedApiKey = localStorage.getItem("noviq_api_key");
  
  if (!savedWallet) {
    showDisconnectedState();
    return;
  }

  try {
    state.wallet = JSON.parse(savedWallet);
    state.userId = state.wallet.user_id;
    if (savedApiKey) {
      state.apiKey = savedApiKey;
    }
    
    updateWalletUI();
    showConnectedState();
    loadApiKeys();

    // Silent refresh
    fetch(`${API_BASE}/wallet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    showDisconnectedState();
  }
}

async function handleConnectWallet() {
  if (typeof window.ethereum === "undefined") {
    showToast("Please install MetaMask (or an EVM wallet) to connect.", "error");
    return;
  }

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
    showConnectedState();
    await loadApiKeys();
    showToast("Wallet connected!", "success");
  } catch (err) {
    console.error("Wallet connect error:", err);
    if (err.code === -32002 || err.message.includes("already pending")) {
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
  if (dom.disconnectedState) dom.disconnectedState.classList.remove("hidden");
  if (dom.connectedState) dom.connectedState.classList.add("hidden");
}

function showConnectedState() {
  if (dom.disconnectedState) dom.disconnectedState.classList.add("hidden");
  if (dom.connectedState) dom.connectedState.classList.remove("hidden");
}

function updateWalletUI() {
  if (!state.wallet) return;

  const hasApiKey = !!state.apiKey;
  const keyBadge = hasApiKey
    ? `<span class="navbar-key-badge" title="API key active">🔑</span>`
    : "";

  dom.navbarWallet.innerHTML = `
    <div class="navbar-wallet-info">
      <div class="wallet-address-chip" id="nav-wallet-address" title="${state.wallet.user_id}">
        ${truncateAddress(state.wallet.user_id)} ${keyBadge}
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
  state.apiKeys = [];
  localStorage.removeItem("noviq_wallet");
  localStorage.removeItem("noviq_api_key");

  dom.navbarWallet.innerHTML = `<button class="btn btn-primary btn-sm" id="btn-connect-wallet">Connect Wallet</button>`;
  dom.btnConnectNav = document.getElementById("btn-connect-wallet");
  if (dom.btnConnectNav) dom.btnConnectNav.addEventListener("click", handleConnectWallet);

  showDisconnectedState();
  showToast("Wallet disconnected", "info");
}

// ── API Key Management ──────────────────────────────────────────────

async function handleGenerateApiKey() {
  if (!state.wallet) {
    showToast("Connect your wallet first.", "error");
    return;
  }

  const label = dom.apiKeyLabelInput ? dom.apiKeyLabelInput.value.trim() : "";

  if (dom.btnGenerateApiKey) {
    dom.btnGenerateApiKey.disabled = true;
    dom.btnGenerateApiKey.textContent = "Generating...";
  }

  try {
    const resp = await fetch(`${API_BASE}/api-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet_address: state.userId,
        label: label,
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${resp.status}`);
    }

    const data = await resp.json();

    state.apiKey = data.api_key;
    localStorage.setItem("noviq_api_key", data.api_key);

    if (dom.apiKeyCreated && dom.apiKeyCreatedValue) {
      dom.apiKeyCreatedValue.textContent = data.api_key;
      dom.apiKeyCreated.classList.remove("hidden");
    }

    if (dom.apiKeyLabelInput) dom.apiKeyLabelInput.value = "";

    showToast("API key generated! Copy it now.", "success");
    updateWalletUI();
    await loadApiKeys();
  } catch (err) {
    console.error("Generate API key error:", err);
    showToast(err.message || "Failed to generate API key.", "error");
  } finally {
    if (dom.btnGenerateApiKey) {
      dom.btnGenerateApiKey.disabled = false;
      dom.btnGenerateApiKey.textContent = "Generate New Key";
    }
  }
}

function handleCopyNewKey() {
  const value = dom.apiKeyCreatedValue?.textContent;
  if (value) {
    navigator.clipboard.writeText(value);
    showToast("API key copied to clipboard!", "success");
  }
}

async function loadApiKeys() {
  if (!state.userId) return;

  try {
    const resp = await fetch(
      `${API_BASE}/api-keys/${encodeURIComponent(state.userId)}`,
      { headers: { "Content-Type": "application/json" } }
    );
    if (!resp.ok) return;

    state.apiKeys = await resp.json();
    renderApiKeyList();
  } catch (err) {
    console.error("Failed to load API keys:", err);
  }
}

function renderApiKeyList() {
  const listEl = dom.apiKeyList;
  const emptyEl = dom.apiKeyListEmpty;
  if (!listEl) return;

  if (state.apiKeys.length === 0) {
    listEl.innerHTML = "";
    if (emptyEl) {
      emptyEl.classList.remove("hidden");
      listEl.appendChild(emptyEl);
    }
    return;
  }

  if (emptyEl) emptyEl.classList.add("hidden");

  listEl.innerHTML = state.apiKeys
    .map((key) => {
      const isActive = !key.is_revoked;
      const statusClass = isActive ? "active" : "revoked";
      const statusLabel = isActive ? "Active" : "Revoked";
      const lastUsed = key.last_used_at
        ? new Date(key.last_used_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : "Never";
      const created = new Date(key.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const label = key.label || "Untitled";

      const isCurrentKey =
        state.apiKey && state.apiKey.startsWith(key.key_prefix);

      return `
        <div class="api-key-item ${statusClass} ${isCurrentKey ? "current" : ""}">
          <div class="api-key-item-top">
            <div class="api-key-item-info">
              <span class="api-key-item-label">${escapeHtml(label)}</span>
              <code class="api-key-item-prefix">${escapeHtml(key.key_prefix)}…</code>
            </div>
            <span class="api-key-item-status ${statusClass}">${statusLabel}</span>
          </div>
          <div class="api-key-item-bottom">
            <span class="api-key-item-meta">Created ${created} · Last used ${lastUsed}</span>
            ${
              isActive
                ? `<button class="btn btn-ghost btn-xs api-key-revoke-btn" onclick="handleRevokeApiKey('${escapeJsString(key.key_prefix)}')">Revoke</button>`
                : ""
            }
          </div>
        </div>
      `;
    })
    .join("");
}

async function handleRevokeApiKey(keyPrefix) {
  if (!state.userId) return;

  try {
    const resp = await fetch(`${API_BASE}/api-keys/${encodeURIComponent(keyPrefix)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet_address: state.userId, key_prefix: keyPrefix }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${resp.status}`);
    }

    if (state.apiKey && state.apiKey.startsWith(keyPrefix)) {
      state.apiKey = null;
      localStorage.removeItem("noviq_api_key");
      updateWalletUI();
    }

    showToast("API key revoked.", "info");
    await loadApiKeys();
  } catch (err) {
    console.error("Revoke API key error:", err);
    showToast(err.message || "Failed to revoke API key.", "error");
  }
}
window.handleRevokeApiKey = handleRevokeApiKey;

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
