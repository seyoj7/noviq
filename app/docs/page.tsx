"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "../components/ThemeToggle";
import { useToast } from "@/context/ToastContext";
import "./docs.css";

const DOCS_SECTIONS = [
  { id: "introduction", label: "Introduction" },
  { id: "quickstart", label: "Quickstart" },
  { id: "authentication", label: "Authentication" },
  { id: "nanopayments", label: "Nanopayments" },
  { id: "services-registry", label: "Services Registry" },
  { id: "arc-network", label: "Arc Network" },
  { id: "api-run", label: "POST /run" },
  { id: "api-services", label: "GET /services" },
  { id: "api-transactions", label: "GET /transactions/{id}" },
  { id: "api-keys-endpoints", label: "API Key Management" },
];

export default function DocsPage() {
  const { showToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("introduction");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // ScrollSpy observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.target.id) {
            setActiveSection(entry.target.id);
          }
        });
      },
      {
        root: null,
        rootMargin: "0px 0px -70% 0px",
        threshold: 0,
      }
    );

    DOCS_SECTIONS.forEach((section) => {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const copyCode = (codeText: string, index: number) => {
    navigator.clipboard.writeText(codeText);
    setCopiedIndex(index);
    showToast("Code copied to clipboard!", "success");
    setTimeout(() => {
      setCopiedIndex(null);
    }, 2000);
  };

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="docs-body">
      {/* Docs Navigation Bar */}
      <nav id="navbar" className="navbar docs-navbar">
        <div className="navbar-brand">
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-sm)",
              color: "inherit",
              textDecoration: "none",
            }}
          >
            <Image src="/assets/Noviq.png" alt="Noviq Logo" width={26} height={26} className="brand-logo" priority />
            <span className="brand-text">noviq</span>
            <span className="beta-badge">beta</span>
          </Link>
          <span className="docs-navbar-divider">/</span>
          <span className="docs-navbar-title">Docs</span>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
          <Link href="/" className="btn btn-ghost btn-sm docs-nav-back-link" style={{ fontSize: "0.8rem" }}>
            ← Back
          </Link>

          <ThemeToggle
            style={{ position: "static", borderRadius: "50%", padding: "8px" }}
            className="btn btn-ghost btn-sm btn-icon"
          />

          <button
            id="docs-mobile-menu-btn"
            className="docs-mobile-menu-btn"
            aria-label="Toggle Menu"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ marginLeft: 0 }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        </div>
      </nav>

      {/* Sidebar mobile backdrop */}
      <div
        className={`docs-sidebar-backdrop ${sidebarOpen ? "open" : ""}`}
        id="docs-sidebar-backdrop"
        onClick={closeSidebar}
      />

      <div className="docs-layout">
        {/* Left Sidebar */}
        <aside className={`docs-sidebar ${sidebarOpen ? "open" : ""}`} id="docs-sidebar">
          <div className="docs-sidebar-content">
            <div className="docs-nav-group">
              <h4 className="docs-nav-title">Getting Started</h4>
              <ul className="docs-nav-links">
                <li>
                  <a
                    href="#introduction"
                    className={`docs-nav-link ${activeSection === "introduction" ? "active" : ""}`}
                    onClick={closeSidebar}
                  >
                    Introduction
                  </a>
                </li>
                <li>
                  <a
                    href="#quickstart"
                    className={`docs-nav-link ${activeSection === "quickstart" ? "active" : ""}`}
                    onClick={closeSidebar}
                  >
                    Quickstart
                  </a>
                </li>
                <li>
                  <a
                    href="#authentication"
                    className={`docs-nav-link ${activeSection === "authentication" ? "active" : ""}`}
                    onClick={closeSidebar}
                  >
                    Authentication
                  </a>
                </li>
              </ul>
            </div>

            <div className="docs-nav-group">
              <h4 className="docs-nav-title">Core Concepts</h4>
              <ul className="docs-nav-links">
                <li>
                  <a
                    href="#nanopayments"
                    className={`docs-nav-link ${activeSection === "nanopayments" ? "active" : ""}`}
                    onClick={closeSidebar}
                  >
                    Nanopayments
                  </a>
                </li>
                <li>
                  <a
                    href="#services-registry"
                    className={`docs-nav-link ${activeSection === "services-registry" ? "active" : ""}`}
                    onClick={closeSidebar}
                  >
                    Services Registry
                  </a>
                </li>
                <li>
                  <a
                    href="#arc-network"
                    className={`docs-nav-link ${activeSection === "arc-network" ? "active" : ""}`}
                    onClick={closeSidebar}
                  >
                    Arc Network
                  </a>
                </li>
              </ul>
            </div>

            <div className="docs-nav-group">
              <h4 className="docs-nav-title">API Reference</h4>
              <ul className="docs-nav-links">
                <li>
                  <a
                    href="#api-run"
                    className={`docs-nav-link ${activeSection === "api-run" ? "active" : ""}`}
                    onClick={closeSidebar}
                  >
                    POST /run
                  </a>
                </li>
                <li>
                  <a
                    href="#api-services"
                    className={`docs-nav-link ${activeSection === "api-services" ? "active" : ""}`}
                    onClick={closeSidebar}
                  >
                    GET /services
                  </a>
                </li>
                <li>
                  <a
                    href="#api-transactions"
                    className={`docs-nav-link ${activeSection === "api-transactions" ? "active" : ""}`}
                    onClick={closeSidebar}
                  >
                    GET /transactions/&#123;id&#125;
                  </a>
                </li>
                <li>
                  <a
                    href="#api-keys-endpoints"
                    className={`docs-nav-link ${activeSection === "api-keys-endpoints" ? "active" : ""}`}
                    onClick={closeSidebar}
                  >
                    API Key Management
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="docs-main">
          <article className="docs-article" id="docs-article">
            <div className="docs-header">
              <p className="docs-eyebrow">Getting Started</p>
              <h1 id="introduction" className="docs-title">
                Introduction to Noviq
              </h1>
              <p className="docs-description">
                Noviq is a pay-per-request AI services marketplace powered by Circle Nanopayments on
                the Arc network. No subscriptions. No gas fees. Just sign and run.
              </p>
            </div>

            <div className="docs-content">
              <p>
                Traditional APIs trap developers in monthly subscriptions, requiring credit cards,
                accounts, and complicated billing portals. Noviq changes this paradigm by allowing
                developers to pay for exactly what they use in fractions of a cent using USDC.
              </p>

              <div className="docs-alert docs-alert-info">
                <div className="docs-alert-icon">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                </div>
                <div className="docs-alert-content">
                  <p>
                    <strong>Note:</strong> Noviq is currently running on Arc Testnet. You can obtain
                    testnet USDC from the{" "}
                    <a href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer">
                      Circle Faucet
                    </a>
                    .
                  </p>
                </div>
              </div>

              <h2 id="quickstart">Quickstart</h2>
              <p>
                Integrating Noviq into your application takes two steps: generate an API key through
                the dashboard, then make an HTTP POST request with your key in the{" "}
                <code>Authorization</code> header.
              </p>

              <div className="docs-code-block-wrapper">
                <div className="docs-code-block-header">
                  <span className="docs-code-lang">python</span>
                  <button
                    className="docs-btn-copy"
                    onClick={() =>
                      copyCode(
                        `import requests

response = requests.post("https://YOUR_DOMAIN/run",
    headers={"Authorization": "nvq_YOUR_API_KEY"},
    json={
        "service_id": "token_price",
        "input_data": "bitcoin"
    }
)

print(response.json()["result"])`,
                        1
                      )
                    }
                  >
                    {copiedIndex === 1 ? "Copied!" : "Copy"}
                  </button>
                </div>
                <pre className="docs-code-block">
                  <code>
{`import requests

response = requests.post("https://YOUR_DOMAIN/run",
    headers={"Authorization": "nvq_YOUR_API_KEY"},
    json={
        "service_id": "token_price",
        "input_data": "bitcoin"
    }
)

print(response.json()["result"])`}
                  </code>
                </pre>
              </div>

              <h2 id="authentication">Authentication</h2>
              <p>
                Noviq uses <strong>API key-based authentication</strong> with{" "}
                <strong>wallet signature verification</strong> for key management. To get started:
              </p>

              <ol>
                <li>
                  <strong>Connect your wallet</strong> — visit the Noviq dashboard and connect your
                  MetaMask (or any EVM) wallet. This proves ownership of your wallet address.
                </li>
                <li>
                  <strong>Sign a challenge</strong> — when generating an API key, MetaMask will prompt
                  you to sign a one-time challenge message. This cryptographically proves you own the
                  wallet.
                </li>
                <li>
                  <strong>Generate an API key</strong> — after signing, a new API key (prefixed with{" "}
                  <code>nvq_</code>) is created. The full key is shown <em>only once</em> — copy and
                  store it securely.
                </li>
                <li>
                  <strong>Use the key in requests</strong> — include the key in the{" "}
                  <code>Authorization</code> header of every API request:
                </li>
              </ol>

              <div className="docs-code-block-wrapper">
                <div className="docs-code-block-header">
                  <span className="docs-code-lang">http</span>
                  <button
                    className="docs-btn-copy"
                    onClick={() => copyCode("Authorization: nvq_YOUR_API_KEY", 2)}
                  >
                    {copiedIndex === 2 ? "Copied!" : "Copy"}
                  </button>
                </div>
                <pre className="docs-code-block">
                  <code>Authorization: nvq_YOUR_API_KEY</code>
                </pre>
              </div>

              <p>
                Each API key is tied to your wallet address. When you call a service, Noviq
                automatically looks up the wallet associated with your key and executes the on-chain
                USDC payment from that wallet.
              </p>

              <div className="docs-alert docs-alert-info">
                <div className="docs-alert-icon">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                </div>
                <div className="docs-alert-content">
                  <p>
                    <strong>Signature Flow:</strong> To generate or revoke API keys, the backend first
                    issues a one-time nonce via <code>GET /auth/nonce/&#123;wallet_address&#125;</code>.
                    The frontend signs this nonce using EIP-191 <code>personal_sign</code>, and
                    submits the signature with the request. This prevents anyone from creating keys
                    for a wallet they don&apos;t own.
                  </p>
                </div>
              </div>

              <div className="docs-alert docs-alert-warning">
                <div className="docs-alert-icon">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                </div>
                <div className="docs-alert-content">
                  <p>
                    <strong>Warning:</strong> Treat your API key like a password. If compromised,
                    revoke it immediately from the dashboard and generate a new one. Ensure your
                    wallet is funded with sufficient USDC before running services.
                  </p>
                </div>
              </div>

              <h2 id="nanopayments">Nanopayments</h2>
              <p>
                Our nanopayment infrastructure allows for micro-transactions (e.g., $0.005) without
                crippling gas fees. This is achieved through Circle&apos;s payment rails and Arc
                settlement.
              </p>

              <h2 id="services-registry">Services Registry</h2>
              <p>
                The registry contains all available AI services, their costs, and expected input
                formats. You can query the available services programmatically.
              </p>

              <div className="docs-code-block-wrapper">
                <div className="docs-code-block-header">
                  <span className="docs-code-lang">bash</span>
                  <button
                    className="docs-btn-copy"
                    onClick={() => copyCode("curl https://YOUR_DOMAIN/services", 3)}
                  >
                    {copiedIndex === 3 ? "Copied!" : "Copy"}
                  </button>
                </div>
                <pre className="docs-code-block">
                  <code>curl https://YOUR_DOMAIN/services</code>
                </pre>
              </div>

              <h2 id="arc-network">Arc Network</h2>
              <p>
                Arc is the underlying blockchain infrastructure providing fast settlement and low
                latency. Because Arc is an L2 designed for high-throughput, latency for API requests
                remains extremely competitive with Web2 APIs.
              </p>

              <h2 id="api-run">POST /run</h2>
              <p>
                The primary endpoint to execute a service and handle payment automatically. Requires a
                valid API key in the <code>Authorization</code> header.
              </p>

              <h3>Headers</h3>
              <div className="docs-table-wrapper">
                <table className="docs-table">
                  <thead>
                    <tr>
                      <th>Header</th>
                      <th>Value</th>
                      <th>Required</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <code>Authorization</code>
                      </td>
                      <td>
                        <code>nvq_YOUR_API_KEY</code>
                      </td>
                      <td>Yes</td>
                    </tr>
                    <tr>
                      <td>
                        <code>Content-Type</code>
                      </td>
                      <td>
                        <code>application/json</code>
                      </td>
                      <td>Yes</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3>Request Body</h3>
              <div className="docs-table-wrapper">
                <table className="docs-table">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Type</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <code>service_id</code>
                      </td>
                      <td>
                        <code>string</code>
                      </td>
                      <td>
                        The unique identifier of the service (e.g., <code>token_price</code>).
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>input_data</code>
                      </td>
                      <td>
                        <code>string</code>
                      </td>
                      <td>The payload or prompt required by the service.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3>Response</h3>
              <p>
                Returns the result of the AI execution, the price charged, and the blockchain
                transaction hash.
              </p>

              <div className="docs-code-block-wrapper">
                <div className="docs-code-block-header">
                  <span className="docs-code-lang">json</span>
                  <button
                    className="docs-btn-copy"
                    onClick={() =>
                      copyCode(
                        `{
  "service_id": "token_price",
  "result": "The current price of bitcoin is $64,231.00",
  "price_usdc": 0.005,
  "tx_hash": "0x5f3a..."
}`,
                        4
                      )
                    }
                  >
                    {copiedIndex === 4 ? "Copied!" : "Copy"}
                  </button>
                </div>
                <pre className="docs-code-block">
                  <code>
{`{
  "service_id": "token_price",
  "result": "The current price of bitcoin is $64,231.00",
  "price_usdc": 0.005,
  "tx_hash": "0x5f3a..."
}`}
                  </code>
                </pre>
              </div>

              <h2 id="api-services">GET /services</h2>
              <p>
                Returns a list of all available services on the Noviq platform. No authentication
                required.
              </p>

              <h3>Response</h3>
              <div className="docs-code-block-wrapper">
                <div className="docs-code-block-header">
                  <span className="docs-code-lang">json</span>
                  <button
                    className="docs-btn-copy"
                    onClick={() =>
                      copyCode(
                        `[
  {
    "id": "token_price",
    "name": "Token Price Fetcher",
    "description": "Fetches the real-time price of any cryptocurrency token.",
    "price_usdc": 0.005
  },
  {
    "id": "sentiment_analysis",
    "name": "Sentiment Analysis",
    "description": "Analyzes the sentiment of a given text block.",
    "price_usdc": 0.01
  }
]`,
                        5
                      )
                    }
                  >
                    {copiedIndex === 5 ? "Copied!" : "Copy"}
                  </button>
                </div>
                <pre className="docs-code-block">
                  <code>
{`[
  {
    "id": "token_price",
    "name": "Token Price Fetcher",
    "description": "Fetches the real-time price of any cryptocurrency token.",
    "price_usdc": 0.005
  },
  {
    "id": "sentiment_analysis",
    "name": "Sentiment Analysis",
    "description": "Analyzes the sentiment of a given text block.",
    "price_usdc": 0.01
  }
]`}
                  </code>
                </pre>
              </div>

              <h2 id="api-transactions">GET /transactions/&#123;id&#125;</h2>
              <p>
                Fetch the complete transaction history for a given wallet address. This endpoint is
                public and does not require an API key.
              </p>

              <h2 id="api-keys-endpoints">API Key Management</h2>
              <p>
                These endpoints allow you to create, list, and revoke API keys for your wallet address.
                Key creation and revocation require proof of wallet ownership.
              </p>

              <h3>GET /auth/nonce/&#123;wallet_address&#125;</h3>
              <p>
                Generate a one-time nonce for wallet signature verification. The returned{" "}
                <code>message</code> should be signed using EIP-191 <code>personal_sign</code>.
              </p>

              <h3>POST /api-keys</h3>
              <p>
                Generate a new API key. Requires a wallet signature (obtain a nonce first via{" "}
                <code>GET /auth/nonce</code>). The full key is returned <strong>only once</strong> in
                the response — store it securely.
              </p>

              <h3>GET /api-keys/&#123;wallet_address&#125;</h3>
              <p>List all API keys (active and revoked) for a given wallet. Never returns the full key.</p>

              <h3>DELETE /api-keys/&#123;key_prefix&#125;</h3>
              <p>
                Revoke an API key by its prefix. Requires either a valid API key in the{" "}
                <code>Authorization</code> header or a wallet signature (<code>signature</code> +{" "}
                <code>nonce</code>) in the request body.
              </p>

              <h3>GET /wallet/&#123;user_id&#125;</h3>
              <p>
                Returns wallet info and USDC balance. Requires a valid API key in the{" "}
                <code>Authorization</code> header.
              </p>
            </div>
          </article>

          <footer className="docs-footer">
            <div className="docs-footer-content">
              <p>&copy; 2026 Noviq. Built on Arc + Circle.</p>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
