"use client";

import React, { useState, useEffect, useSyncExternalStore } from "react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { ThemeToggle } from "../components/ThemeToggle";
import { useWallet } from "@/context/WalletContext";
import { useToast } from "@/context/ToastContext";
import "./playground.css";

interface ServiceItem {
  id: string;
  name: string;
  description: string;
  price_usdc: number;
}

const DEFAULT_SERVICES: ServiceItem[] = [
  {
    id: "token_price",
    name: "Token Price Fetcher",
    description: "Fetches real-time price of any cryptocurrency token via CoinGecko.",
    price_usdc: 0.005,
  },
  {
    id: "nemotron-3-super",
    name: "Nemotron 3 Super",
    description: "NVIDIA Nemotron LLM for high-speed multi-turn reasoning and chat.",
    price_usdc: 0.015,
  },
  {
    id: "twitter_fetch",
    name: "Twitter Profile Fetcher",
    description: "Fetches user profile, follower counts and recent activity metrics from X/Twitter.",
    price_usdc: 0.008,
  },
];

const EXAMPLE_INPUTS: Record<string, string> = {
  token_price: "bitcoin",
  twitter_fetch: "elonmusk",
  "nemotron-3-super": "What is the capital of France?",
};

function truncateAddress(addr: string | null | undefined, maxLen = 14): string {
  if (!addr || addr.length <= maxLen) return addr || "";
  return addr.slice(0, 6) + "···" + addr.slice(-4);
}

interface RunResponse {
  tx_hash?: string;
  cost_usdc?: number;
  result?: unknown;
  error?: string;
  [key: string]: unknown;
}

export default function PlaygroundPage() {
  const { apiKey, setApiKey, refreshWallet } = useWallet();
  const { showToast } = useToast();

  const [services, setServices] = useState<ServiceItem[]>(DEFAULT_SERVICES);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("token_price");
  const [inputData, setInputData] = useState<string>("bitcoin");
  const [localApiKey, setLocalApiKey] = useState<string>("");
  const [showKey, setShowKey] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [responseData, setResponseData] = useState<RunResponse | null>(null);
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => ""
  );

  // Sync API key from context/localStorage
  useEffect(() => {
    if (apiKey) {
      queueMicrotask(() => setLocalApiKey(apiKey));
    }
  }, [apiKey]);

  // Fetch available services
  useEffect(() => {
    async function loadServices() {
      try {
        const resp = await fetch("/services", {
          headers: { "Content-Type": "application/json" },
        });
        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data) && data.length > 0) {
            setServices(data);
            setSelectedServiceId(data[0].id);
            setInputData(EXAMPLE_INPUTS[data[0].id] || "example_data");
          }
        }
      } catch (err) {
        console.warn("Using default services for playground", err);
      }
    }
    loadServices();
  }, []);

  const handleServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedServiceId(id);
    if (EXAMPLE_INPUTS[id]) {
      setInputData(EXAMPLE_INPUTS[id]);
    }
  };

  const handlePasteKey = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setLocalApiKey(text.trim());
        setApiKey(text.trim());
        showToast("API Key pasted from clipboard!", "info");
      }
    } catch {
      showToast("Unable to read from clipboard. Please paste manually.", "warning");
    }
  };

  const handleClearKey = () => {
    setLocalApiKey("");
    setApiKey(null);
  };

  const handleRunApi = async () => {
    const keyToUse = localApiKey.trim() || apiKey;
    if (!keyToUse) {
      showToast("API Key is missing. Please paste or enter an API key.", "error");
      return;
    }

    if (!inputData.trim()) {
      showToast("Please provide input data.", "warning");
      return;
    }

    setIsRunning(true);
    setResponseStatus(null);
    setResponseTime(null);
    setResponseData(null);

    const startTime = performance.now();

    try {
      const res = await fetch("/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${keyToUse}`,
        },
        body: JSON.stringify({
          service_id: selectedServiceId,
          input_data: inputData.trim(),
        }),
      });

      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      setResponseTime(duration);
      setResponseStatus(res.status);

      const json = await res.json().catch(() => ({ error: "Invalid JSON response" }));
      setResponseData(json);

      if (res.ok) {
        showToast("Service run completed!", "success");
        refreshWallet();
      } else {
        showToast(json.error || `Run failed (${res.status})`, "error");
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Network error or failure to reach server.";
      setResponseStatus(500);
      setResponseData({ error: errorMsg });
      showToast("Network error or failure to reach server.", "error");
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopyResponse = () => {
    if (responseData) {
      navigator.clipboard.writeText(JSON.stringify(responseData, null, 2));
      showToast("Response copied!", "success");
    }
  };

  const currentService = services.find((s) => s.id === selectedServiceId) || services[0];
  const canRun = !!selectedServiceId && !!inputData.trim() && !isRunning;

  return (
    <div className="playground-page">
      <Navbar />
      <ThemeToggle />

      <main className="section playground-main-section">
        <div className="container playground-container">
          <div className="section-header" style={{ textAlign: "center", marginBottom: "1rem" }}>
            <div className="section-eyebrow">TEST & DISCOVER</div>
            <h1 className="section-title">Playground</h1>
            <p className="section-subtitle">
              Test APIs instantly without writing any code. Just sign and run.
            </p>
          </div>

          <div id="playground-connected" className="playground-layout glass-panel">
            {/* Top Section */}
            <div className="playground-top-section">
              <label
                className="form-label text-uppercase"
                style={{
                  letterSpacing: "0.05em",
                  fontSize: "0.75rem",
                  color: "var(--text-secondary)",
                  display: "block",
                  marginBottom: "8px",
                }}
              >
                PERSONAL API KEY
              </label>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "var(--space-md)",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "var(--space-sm)",
                    alignItems: "center",
                    flex: 1,
                    minWidth: "260px",
                  }}
                >
                  <input
                    type={showKey ? "text" : "password"}
                    id="playground-api-key"
                    className="form-input code-input custom-input"
                    placeholder="nvq_..."
                    style={{ flex: 1, minWidth: "220px" }}
                    value={localApiKey}
                    onChange={(e) => {
                      setLocalApiKey(e.target.value);
                      setApiKey(e.target.value);
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      gap: "var(--space-sm)",
                      alignItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <button
                      type="button"
                      id="btn-toggle-key-visibility"
                      className="btn btn-ghost btn-sm btn-icon btn-key-action"
                      onClick={() => setShowKey(!showKey)}
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
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                      <span style={{ marginLeft: "6px", fontSize: "0.85rem" }}>
                        {showKey ? "Hide" : "Show"}
                      </span>
                    </button>

                    <button
                      type="button"
                      id="btn-paste-key"
                      className="btn btn-ghost btn-sm btn-icon btn-key-action"
                      onClick={handlePasteKey}
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
                      <span style={{ marginLeft: "6px", fontSize: "0.85rem" }}>Paste</span>
                    </button>

                    <button
                      type="button"
                      id="btn-clear-key"
                      className="btn btn-ghost btn-sm btn-icon btn-key-action"
                      onClick={handleClearKey}
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
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                      <span style={{ marginLeft: "6px", fontSize: "0.85rem" }}>Clear</span>
                    </button>
                  </div>
                </div>

                <div
                  className="top-bar"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    margin: 0,
                    padding: 0,
                    flexShrink: 0,
                  }}
                >
                  <div className="top-actions" style={{ display: "flex", alignItems: "center" }}>
                    <button
                      id="btn-run-api"
                      className="btn btn-primary btn-run"
                      disabled={!canRun}
                      onClick={handleRunApi}
                    >
                      <span className="run-icon" style={{ display: "flex", alignItems: "center" }}>
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
                          <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                      </span>
                      <span className="btn-text">
                        {isRunning ? "Running..." : "Run request"}
                      </span>
                      {isRunning && <span className="loader"></span>}
                    </button>
                  </div>
                </div>
              </div>
              <div
                className="form-hint"
                style={{
                  marginTop: "8px",
                  color: "var(--text-secondary)",
                  fontSize: "0.8rem",
                }}
              >
                Kept in local storage / memory to authorize your requests.
              </div>
            </div>

            {/* Split Layout */}
            <div className="playground-split-layout">
              {/* Configuration Panel (Left) */}
              <div className="playground-config">
                <div className="form-group" style={{ marginBottom: "var(--space-md)" }}>
                  <div className="service-selector-row">
                    <span className="method-badge">POST</span>
                    <div className="select-wrapper" style={{ flex: 1 }}>
                      <select
                        id="service-selector"
                        className="form-input custom-select"
                        value={selectedServiceId}
                        onChange={handleServiceChange}
                      >
                        {services.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} (${s.price_usdc} USDC)
                          </option>
                        ))}
                      </select>
                      <div className="select-arrow">
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
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="service-subtitle" id="endpoint-url" style={{ textTransform: "none" }}>
                    {origin}/run
                  </div>
                  <div id="service-description" className="service-desc-text">
                    {currentService?.description || "Select a service to see details."}
                  </div>
                </div>

                <div
                  className="form-group"
                  style={{ flex: 1, display: "flex", flexDirection: "column" }}
                >
                  <label
                    htmlFor="input-data"
                    className="form-label text-uppercase"
                    style={{
                      letterSpacing: "0.05em",
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Input Data
                  </label>
                  <textarea
                    id="input-data"
                    className="form-input code-input custom-textarea"
                    placeholder="Enter input data here..."
                    style={{ flex: 1, minHeight: "180px", resize: "none" }}
                    value={inputData}
                    onChange={(e) => setInputData(e.target.value)}
                  ></textarea>
                  <div
                    className="form-hint"
                    style={{
                      marginTop: "0.5rem",
                      color: "var(--text-secondary)",
                      fontSize: "0.8rem",
                    }}
                  >
                    Enter the required input string or prompt for the selected service.
                  </div>
                </div>

                <div className="playground-actions hidden">
                  <div className="price-estimate">
                    <span className="price-label">Cost:</span>
                    <span id="service-price" className="price-value">
                      ${currentService?.price_usdc || "0.00"} USDC
                    </span>
                  </div>
                </div>
              </div>

              {/* Output Panel (Right) */}
              <div className="playground-output">
                <div className="playground-output-header">
                  <h3 className="playground-panel-title">
                    <span
                      style={{
                        color: "var(--text-secondary)",
                        marginRight: "6px",
                        fontFamily: "monospace",
                      }}
                    >
                      &#123;&#125;
                    </span>{" "}
                    JSON response
                  </h3>
                  <div className="output-actions">
                    {responseStatus !== null && (
                      <span
                        id="response-status"
                        className={`response-badge ${
                          responseStatus >= 200 && responseStatus < 300 ? "success" : "error"
                        }`}
                      >
                        {responseStatus}{" "}
                        {responseStatus >= 200 && responseStatus < 300 ? "OK" : "Error"}
                      </span>
                    )}

                    {responseTime !== null && (
                      <span id="response-time" className="response-time">
                        {responseTime}ms
                      </span>
                    )}

                    {responseData !== null && (
                      <button
                        id="btn-copy-response"
                        className="btn btn-ghost btn-xs btn-icon"
                        title="Copy response"
                        onClick={handleCopyResponse}
                        style={{
                          gap: "6px",
                          display: "flex",
                          alignItems: "center",
                          color: "var(--text-secondary)",
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        Copy
                      </button>
                    )}
                  </div>
                </div>

                <div className="playground-output-content" id="output-content">
                  {responseData !== null ? (
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                      {JSON.stringify(responseData, null, 2)}
                    </pre>
                  ) : (
                    <div className="output-placeholder">
                      <p style={{ color: "var(--text-secondary)" }}>
                        The live response will appear here after you explicitly run the request.
                      </p>
                    </div>
                  )}
                </div>

                {/* Payment / TX info footer */}
                {responseData?.tx_hash && (
                  <div id="tx-info-footer" className="playground-tx-footer">
                    <div className="tx-info-row">
                      <span className="tx-label">Transaction Hash:</span>
                      <div className="tx-value-wrapper">
                        <a
                          id="tx-explorer-link"
                          href={`https://testnet.arcscan.app/tx/${responseData.tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tx-link"
                        >
                          {truncateAddress(responseData.tx_hash, 16)}
                        </a>
                        <button
                          id="btn-copy-tx"
                          className="btn btn-ghost btn-xs btn-icon"
                          onClick={() => {
                            if (responseData?.tx_hash) {
                              navigator.clipboard.writeText(responseData.tx_hash);
                              showToast("Tx Hash copied!", "success");
                            }
                          }}
                          title="Copy Tx Hash"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
