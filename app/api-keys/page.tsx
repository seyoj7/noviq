"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { ThemeToggle } from "../components/ThemeToggle";
import { useWallet } from "@/context/WalletContext";
import { useToast } from "@/context/ToastContext";
import "./api-keys.css";

interface ApiKeyItem {
  id?: string;
  key_prefix: string;
  label: string;
  is_revoked: boolean;
  created_at: string;
}

export default function ApiKeysPage() {
  const { wallet, userId, isConnecting, connectWallet, setApiKey } = useWallet();
  const { showToast } = useToast();

  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [labelInput, setLabelInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [revokingPrefix, setRevokingPrefix] = useState<string | null>(null);

  const activeKeys = apiKeys.filter((k) => !k.is_revoked);

  // Fetch API keys for connected wallet
  const loadApiKeys = useCallback(async () => {
    if (!userId) return;

    try {
      const resp = await fetch(`/api-keys/${encodeURIComponent(userId)}`);
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data)) {
          setApiKeys(data);
        }
      }
    } catch (err) {
      console.error("Failed to load API keys", err);
    }
  }, [userId]);

  useEffect(() => {
    let isMounted = true;
    if (!userId) {
      queueMicrotask(() => {
        if (isMounted) setApiKeys([]);
      });
      return () => {
        isMounted = false;
      };
    }

    queueMicrotask(() => {
      if (isMounted) {
        void loadApiKeys();
      }
    });

    return () => {
      isMounted = false;
    };
  }, [userId, loadApiKeys]);

  const handleGenerateKey = async () => {
    if (!userId || !wallet) {
      showToast("Please connect your wallet first.", "warning");
      return;
    }

    const label = labelInput.trim();
    if (!label) {
      showToast("Please enter a label for your API key.", "warning");
      return;
    }

    if (activeKeys.length >= 2) {
      showToast("Maximum of 2 active API keys per wallet. Revoke an existing key first.", "error");
      return;
    }

    setIsGenerating(true);

    try {
      // Step 1: Get challenge nonce
      const nonceResp = await fetch(`/auth/nonce/${encodeURIComponent(userId)}`);
      if (!nonceResp.ok) {
        let errText = `Failed to request challenge nonce (${nonceResp.status})`;
        try {
          const raw = await nonceResp.text();
          const errJson = JSON.parse(raw);
          if (errJson.detail || errJson.error) errText = errJson.detail || errJson.error;
        } catch {}
        throw new Error(errText);
      }
      const { nonce, message } = await nonceResp.json();

      // Step 2: Sign challenge with MetaMask
      if (!window.ethereum?.request) {
        throw new Error("MetaMask is not available to sign the challenge.");
      }

      showToast("Please sign the verification message in your wallet...", "info");

      const signature = await window.ethereum.request({
        method: "personal_sign",
        params: [message, userId],
      });

      // Step 3: Create API key
      const createResp = await fetch("/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_address: userId,
          label,
          signature,
          nonce,
        }),
      });

      if (!createResp.ok) {
        let errorMsg = `Failed to create API key (${createResp.status})`;
        try {
          const raw = await createResp.text();
          const errJson = JSON.parse(raw);
          if (errJson.detail) {
            errorMsg = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
          } else if (errJson.error) {
            errorMsg = errJson.error;
          }
        } catch {}
        throw new Error(errorMsg);
      }

      const created = await createResp.json();
      setCreatedKey(created.api_key);
      setApiKey(created.api_key);
      setIsModalOpen(true);
      setLabelInput("");
      showToast("API key created successfully!", "success");

      loadApiKeys();
    } catch (err: unknown) {
      console.error("Key creation error:", err);
      const msg = err instanceof Error ? err.message : "Failed to generate API key.";
      showToast(msg, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevokeKey = async (keyPrefix: string) => {
    if (!userId) return;

    if (!confirm(`Are you sure you want to revoke key prefix ${keyPrefix}?`)) {
      return;
    }

    setRevokingPrefix(keyPrefix);

    try {
      // Step 1: Request nonce for revoking
      const nonceResp = await fetch(`/auth/nonce/${encodeURIComponent(userId)}`);
      if (!nonceResp.ok) {
        let errText = "Failed to get challenge nonce.";
        try {
          const raw = await nonceResp.text();
          const errJson = JSON.parse(raw);
          if (errJson.detail) {
            errText = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
          } else if (errJson.error) {
            errText = typeof errJson.error === "string" ? errJson.error : JSON.stringify(errJson.error);
          }
        } catch {}
        throw new Error(errText);
      }
      const { nonce, message } = await nonceResp.json();

      // Step 2: Request wallet signature
      const signature = await window.ethereum?.request({
        method: "personal_sign",
        params: [message, userId],
      });

      // Step 3: Revoke key
      const revokeResp = await fetch(`/api-keys/${encodeURIComponent(keyPrefix)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_address: userId,
          key_prefix: keyPrefix,
          signature,
          nonce,
        }),
      });

      if (!revokeResp.ok) {
        let errorMsg = `Failed to revoke key (${revokeResp.status})`;
        try {
          const raw = await revokeResp.text();
          const errJson = JSON.parse(raw);
          if (errJson.detail) {
            if (typeof errJson.detail === "string") {
              errorMsg = errJson.detail;
            } else if (Array.isArray(errJson.detail)) {
              errorMsg = errJson.detail.map((e: { msg?: string }) => e.msg || JSON.stringify(e)).join("; ");
            } else {
              errorMsg = JSON.stringify(errJson.detail);
            }
          } else if (errJson.error) {
            errorMsg = typeof errJson.error === "string" ? errJson.error : JSON.stringify(errJson.error);
          }
        } catch {}
        throw new Error(errorMsg);
      }

      showToast(`Key ${keyPrefix} revoked successfully.`, "info");
      loadApiKeys();
    } catch (err: unknown) {
      console.error("Revoke error:", err);
      const msg = err instanceof Error ? err.message : "Failed to revoke API key.";
      showToast(msg, "error");
    } finally {
      setRevokingPrefix(null);
    }
  };

  const copyToClipboard = (text: string, msg: string) => {
    navigator.clipboard.writeText(text);
    showToast(msg, "success");
  };

  return (
    <div className="api-keys-page">
      <Navbar activePage="api" />
      <ThemeToggle />

      <main className="section api-keys-main-section">
        <div className="container api-keys-container">
          <div className="section-header">
            <div className="section-eyebrow">AUTHENTICATION</div>
            <h1 className="section-title">API Keys</h1>
            <p className="section-subtitle">
              Manage your API keys to access Noviq services. Keys are tied to your connected wallet.
            </p>
          </div>

          {!userId ? (
            /* Disconnected State */
            <div id="api-keys-disconnected" className="api-keys-disconnected glass-panel">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--text-muted-on-dark)", marginBottom: "var(--space-md)" }}
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              <h3>Wallet Required</h3>
              <p>Please connect your wallet to view and manage your API keys.</p>
              <button
                className="btn btn-primary"
                id="btn-connect-wallet-main"
                onClick={connectWallet}
                disabled={isConnecting}
              >
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>
            </div>
          ) : (
            /* Connected State */
            <div
              id="api-keys-connected"
              className="api-keys-section glass-panel"
              style={{ padding: "var(--space-xl)" }}
            >
              {/* Generate Key Form */}
              <div className="api-key-generate" style={{ marginBottom: "var(--space-xl)" }}>
                <input
                  type="text"
                  id="api-key-label-input"
                  className="api-key-label-input"
                  placeholder="Key label (e.g. Production Bot)"
                  maxLength={50}
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  style={{ padding: "10px 14px", fontSize: "0.9rem" }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleGenerateKey();
                  }}
                />
                <button
                  className="btn btn-primary"
                  id="btn-generate-api-key"
                  onClick={handleGenerateKey}
                  disabled={isGenerating}
                >
                  {isGenerating ? "Generating..." : "Generate New Key"}
                </button>
              </div>

              {/* Newly Created Key inline banner */}
              {createdKey && (
                <div
                  className="api-key-created"
                  id="api-key-created"
                  style={{ marginBottom: "var(--space-xl)" }}
                >
                  <div className="api-key-created-warning">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                      <line x1="12" y1="9" x2="12" y2="13"></line>
                      <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    Please copy this key now. It will not be shown again.
                  </div>
                  <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "stretch" }}>
                    <div
                      className="api-key-created-value"
                      id="api-key-created-value"
                      style={{
                        flex: 1,
                        margin: 0,
                        display: "flex",
                        alignItems: "center",
                        padding: "10px 14px",
                        fontSize: "0.85rem",
                      }}
                    >
                      {createdKey}
                    </div>
                    <button
                      className="btn btn-secondary"
                      id="btn-copy-new-key"
                      style={{ width: "auto", padding: "0 16px" }}
                      onClick={() => copyToClipboard(createdKey, "API key copied!")}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}

              <div
                className="api-keys-header"
                style={{
                  marginBottom: "var(--space-md)",
                  borderBottom: "1px solid var(--border-dark)",
                  paddingBottom: "var(--space-md)",
                }}
              >
                <h4 className="api-keys-title" style={{ fontSize: "1.1rem" }}>
                  Your Keys
                </h4>
              </div>

              {/* Key List */}
              <div className="api-key-list" id="api-key-list" style={{ maxHeight: "none" }}>
                {activeKeys.length === 0 ? (
                  <div className="api-key-list-empty" id="api-key-list-empty">
                    <p>No active API keys yet. Generate one above to get started.</p>
                  </div>
                ) : (
                  activeKeys.map((key) => {
                    let formattedDate = "";
                    try {
                      formattedDate = new Date(key.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      });
                    } catch {
                      formattedDate = String(key.created_at || "");
                    }

                    return (
                      <div
                        key={key.key_prefix}
                        className="api-key-item active"
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "14px 16px",
                          borderBottom: "1px solid var(--border-dark)",
                          gap: "12px",
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                              {key.label}
                            </span>
                            <span
                              className="status-badge active"
                              style={{
                                fontSize: "0.7rem",
                                padding: "2px 8px",
                                borderRadius: "12px",
                                background: "rgba(16,185,129,0.15)",
                                color: "var(--success)",
                              }}
                            >
                              Active
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: "12px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                            <code style={{ fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                              {key.key_prefix}···
                            </code>
                            <span>Created {formattedDate}</span>
                          </div>
                        </div>

                        <button
                          className="btn btn-ghost btn-sm text-error"
                          disabled={revokingPrefix === key.key_prefix}
                          onClick={() => handleRevokeKey(key.key_prefix)}
                          style={{ fontSize: "0.8rem", padding: "6px 12px" }}
                        >
                          {revokingPrefix === key.key_prefix ? "Revoking..." : "Revoke"}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal Dialog for newly created API Key */}
      {isModalOpen && createdKey && (
        <div
          id="api-key-modal"
          className="api-key-modal open"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div
            className="api-key-modal-backdrop"
            id="api-key-modal-backdrop"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="api-key-modal-box">
            <div className="api-key-modal-header">
              <h3 id="modal-title" className="api-key-modal-title">
                Create API Key
              </h3>
              <button
                className="api-key-modal-close"
                id="btn-modal-close"
                aria-label="Close"
                onClick={() => setIsModalOpen(false)}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <p className="api-key-modal-message">
              Your new API key has been created.{" "}
              <strong>Copy it now, as it will not display again.</strong>
            </p>
            <div className="api-key-modal-field">
              <code className="api-key-modal-value" id="api-key-modal-value">
                {createdKey}
              </code>
              <button
                className="btn btn-secondary btn-sm api-key-modal-copy"
                id="btn-modal-copy"
                onClick={() => copyToClipboard(createdKey, "API key copied!")}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                Copy
              </button>
            </div>
            <div className="api-key-modal-footer">
              <button
                className="btn btn-primary"
                id="btn-modal-done"
                onClick={() => setIsModalOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
