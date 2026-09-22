"use client";

import React, { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { ThemeToggle } from "./components/ThemeToggle";
import { useWallet } from "@/context/WalletContext";
import { useToast } from "@/context/ToastContext";
import "./page.css";

interface ServiceItem {
  id: string;
  name: string;
  description: string;
  price_usdc: number;
}

interface TransactionItem {
  service_id: string;
  cost: number;
  status: string;
  txHash?: string;
  paymentRef?: string;
  time: string;
}


const EXAMPLE_INPUTS: Record<string, string> = {
  token_price: "bitcoin",
  twitter_fetch: "elonmusk",
  "nemotron-3-super": "What is the capital of France?",
};

function truncateRef(ref: string | null | undefined): string {
  if (!ref || ref.length < 16) return ref || "—";
  return ref.slice(0, 8) + "···" + ref.slice(-8);
}

export default function LandingPage() {
  const { userId, apiKey } = useWallet();
  const { showToast } = useToast();

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [activeSnippetTab, setActiveSnippetTab] = useState<"python" | "node">("python");
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "https://YOUR_DOMAIN"
  );

  // Scroll reveal observer
  useEffect(() => {
    const revealElements = document.querySelectorAll(".reveal-on-scroll");
    if (!revealElements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    revealElements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [services, servicesError]);

  // Fetch services from backend
  const loadServices = useCallback(async () => {
    setLoadingServices(true);
    setServicesError(null);
    try {
      const resp = await fetch("/services", {
        headers: { "Content-Type": "application/json" },
      });
      if (!resp.ok) {
        throw new Error(`Server responded with status: ${resp.status}`);
      }
      const data: ServiceItem[] = await resp.json();
      if (Array.isArray(data) && data.length > 0) {
        setServices(data);
        setSelectedService(data[0]);
      } else {
        setServices([]);
        setSelectedService(null);
      }
    } catch (err: unknown) {
      console.warn("Backend services unavailable:", err);
      setServices([]);
      setSelectedService(null);
      setServicesError("Unable to connect to backend services. Please ensure the API server is running.");
    } finally {
      setLoadingServices(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      loadServices();
    });
  }, [loadServices]);

  // Fetch transactions for connected wallet
  useEffect(() => {
    if (!userId) {
      queueMicrotask(() => setTransactions([]));
      return;
    }

    async function loadTransactions() {
      try {
        const resp = await fetch(`/transactions/${encodeURIComponent(userId || "")}`);
        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data)) {
            const sorted = (data as TransactionItem[]).sort(
              (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
            );
            setTransactions(sorted);
          }
        }
      } catch (err) {
        console.error("Failed to load transactions", err);
      }
    }

    loadTransactions();
  }, [userId]);

  const handleSelectService = (service: ServiceItem) => {
    setSelectedService(service);
  };

  const handleCopySnippet = () => {
    const serviceId = selectedService ? selectedService.id : "token_price";
    const inputData = EXAMPLE_INPUTS[serviceId] || "example_data";
    const key = apiKey || "nvq_YOUR_API_KEY";

    let textToCopy = "";
    if (activeSnippetTab === "python") {
      textToCopy = `import requests

response = requests.post("${origin}/run",
    headers={"Authorization": "${key}"},
    json={
        "service_id": "${serviceId}",
        "input_data": "${inputData}"
    }
)
print(response.json()["result"])`;
    } else {
      textToCopy = `const response = await fetch("${origin}/run", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Authorization": "${key}"
    },
    body: JSON.stringify({
        "service_id": "${serviceId}",
        "input_data": "${inputData}"
    })
});
const data = await response.json();
console.log(data.result);`;
    }

    navigator.clipboard.writeText(textToCopy);
    showToast(`${activeSnippetTab === "python" ? "Python" : "Node.js"} snippet copied!`, "success");
  };

  const currentOrigin = origin;
  const currentServiceId = selectedService ? selectedService.id : "token_price";
  const currentExampleInput = EXAMPLE_INPUTS[currentServiceId] || "example_data";

  return (
    <>
      <Navbar />
      <ThemeToggle />

      {/* Hero Section */}
      <header id="hero" className="hero">
        <div className="hero-content-wrapper">
          <div className="hero-content-left">
            <div className="hero-eyebrow">PAY-PER-REQUEST FOR APIS</div>
            <h1 className="hero-title">
              Stop paying for
              <br />
              <span className="hero-title-highlight">API subscriptions.</span>
            </h1>
            <p className="hero-subtitle">
              APIs priced in fractions of a cent. No subscriptions, no gas fees — sign once, get
              results instantly, settled on Arc.
            </p>
            <div className="hero-actions">
              <button
                className="btn btn-primary btn-lg"
                id="btn-get-started"
                onClick={() => {
                  document.getElementById("services")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Explore Services
              </button>
              <Link href="/playground" className="btn btn-secondary btn-lg">
                Playground →
              </Link>
            </div>
            <div className="hero-credit-note">
              ARC{" "}
              <span style={{ fontSize: "0.65em", verticalAlign: "middle", opacity: 0.7, margin: "0 4px" }}>
                &bull;
              </span>{" "}
              CIRCLE{" "}
              <span style={{ fontSize: "0.65em", verticalAlign: "middle", opacity: 0.7, margin: "0 4px" }}>
                &bull;
              </span>{" "}
              USDC{" "}
              <span style={{ fontSize: "0.65em", verticalAlign: "middle", opacity: 0.7, margin: "0 4px" }}>
                &bull;
              </span>{" "}
              NANOPAYMENTS
            </div>
          </div>

          <div className="hero-content-right">
            <div className="hero-diagram-box">
              <div className="diagram-header">
                <div className="diagram-eyebrow">TRANSACTION FLOW</div>
                <div className="diagram-protocol-badges">
                  <span className="protocol-badge">x402</span>
                  <span className="protocol-badge">EIP-3009</span>
                  <span className="protocol-badge">Circle</span>
                  <span className="protocol-badge">USDC</span>
                </div>
              </div>

              {/* Desktop SVG Diagram */}
              <div className="diagram-desktop-view">
                <svg viewBox="0 0 510 300" xmlns="http://www.w3.org/2000/svg" className="diagram-svg">
                  <defs>
                    <marker id="arr-m" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-auto">
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#6B6570" />
                    </marker>
                    <marker id="arr-g" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-auto">
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#34D399" />
                    </marker>
                    <marker id="arr-a" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-auto">
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#D0C9B9" />
                    </marker>
                    <marker id="arr-blue" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-auto">
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#60A5FA" />
                    </marker>
                  </defs>

                  {/* ROW 1: Request Layer */}
                  <text x="16" y="20" fontFamily="'JetBrains Mono', monospace" fontSize="9" fill="#B8B2A8" letterSpacing="0.08em" fontWeight="700">01 REQUEST</text>
                  <line x1="90" y1="15" x2="494" y2="15" stroke="#4A454E" strokeWidth="0.75" />

                  <rect x="16" y="40" width="120" height="38" rx="5" fill="#252228" stroke="#4A454E" strokeWidth="1" />
                  <text x="76" y="64" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="11" fontWeight="700" fill="#FFFFFF">api_call()</text>

                  <line x1="136" y1="59" x2="188" y2="59" stroke="#6B6570" strokeWidth="1.2" strokeDasharray="4 3" markerEnd="url(#arr-a)" />

                  <rect x="195" y="40" width="120" height="38" rx="5" fill="#252228" stroke="#4A454E" strokeWidth="1" />
                  <text x="255" y="64" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="11" fontWeight="700" fill="#FFFFFF">Noviq</text>

                  <line x1="315" y1="59" x2="367" y2="59" stroke="#6B6570" strokeWidth="1.2" strokeDasharray="4 3" markerEnd="url(#arr-a)" />

                  <rect x="374" y="40" width="120" height="38" rx="5" fill="#252228" stroke="#4A454E" strokeWidth="1" />
                  <text x="434" y="55" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="10.5" fontWeight="700" fill="#FFFFFF">Balance</text>
                  <text x="434" y="68" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="8.5" fill="#D0C9B9" fontWeight="500">Pre-check ✓</text>

                  {/* ROW 2: Service Layer */}
                  <text x="16" y="125" fontFamily="'JetBrains Mono', monospace" fontSize="9" fill="#B8B2A8" letterSpacing="0.08em" fontWeight="700">02 SERVICE</text>
                  <line x1="85" y1="120" x2="494" y2="120" stroke="#4A454E" strokeWidth="0.75" />

                  <rect x="16" y="145" width="120" height="38" rx="5" fill="#252228" stroke="#4A454E" strokeWidth="1" />
                  <text x="76" y="160" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="10.5" fontWeight="700" fill="#FFFFFF">API Service</text>
                  <text x="76" y="173" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="8.5" fill="#D0C9B9" fontWeight="500">Runs First</text>

                  <line x1="136" y1="164" x2="188" y2="164" stroke="#6B6570" strokeWidth="1.2" strokeDasharray="4 3" markerEnd="url(#arr-a)" />

                  <rect x="195" y="145" width="120" height="38" rx="5" fill="#252228" stroke="#4A454E" strokeWidth="1" />
                  <text x="255" y="160" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="10.5" fontWeight="700" fill="#FFFFFF">&#123;JSON&#125;</text>
                  <text x="255" y="173" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="8.5" fill="#D0C9B9" fontWeight="500">Result Ready</text>

                  <line x1="315" y1="164" x2="367" y2="164" stroke="#6B6570" strokeWidth="1.2" strokeDasharray="4 3" markerEnd="url(#arr-a)" />

                  <rect x="374" y="145" width="120" height="38" rx="5" fill="#252228" stroke="#4A454E" strokeWidth="1" />
                  <text x="434" y="169" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="11" fontWeight="700" fill="#FFFFFF">✓ Success</text>

                  {/* ROW 3: Payment Layer */}
                  <text x="16" y="230" fontFamily="'JetBrains Mono', monospace" fontSize="9" fill="#B8B2A8" letterSpacing="0.08em" fontWeight="700">03 PAYMENT</text>
                  <line x1="90" y1="225" x2="494" y2="225" stroke="#4A454E" strokeWidth="0.75" />

                  <rect x="16" y="250" width="120" height="38" rx="5" fill="#252228" stroke="#4A454E" strokeWidth="1" />
                  <text x="76" y="265" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="10.5" fontWeight="700" fill="#FFFFFF">Circle</text>
                  <text x="76" y="278" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="8.5" fill="#D0C9B9" fontWeight="500">Programmable Wallets</text>

                  <line x1="136" y1="269" x2="188" y2="269" stroke="#6B6570" strokeWidth="1.2" strokeDasharray="4 3" markerEnd="url(#arr-a)" />

                  <rect x="195" y="250" width="120" height="38" rx="5" fill="#252228" stroke="#4A454E" strokeWidth="1" />
                  <text x="255" y="265" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="10.5" fontWeight="700" fill="#FFFFFF">USDC</text>
                  <text x="255" y="278" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="8.5" fill="#D0C9B9" fontWeight="500">transfer() on Arc</text>

                  <line x1="315" y1="269" x2="367" y2="269" stroke="#6B6570" strokeWidth="1.2" strokeDasharray="4 3" markerEnd="url(#arr-a)" />

                  <rect x="374" y="250" width="120" height="38" rx="5" fill="#252228" stroke="#4A454E" strokeWidth="1" />
                  <text x="434" y="274" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="11" fontWeight="700" fill="#FFFFFF">TX Confirmed ✓</text>
                </svg>
              </div>

              {/* Mobile Flow Diagram */}
              <div className="diagram-mobile-view">
                <div className="mobile-flow-layer">
                  <div className="mobile-flow-layer-header">
                    <span className="mobile-flow-layer-num">01</span>
                    <span className="mobile-flow-layer-title">REQUEST</span>
                  </div>
                  <div className="mobile-flow-steps">
                    <div className="mobile-flow-node">
                      <span className="mobile-flow-node-title">api_call()</span>
                    </div>
                    <div className="mobile-flow-arrow">→</div>
                    <div className="mobile-flow-node">
                      <span className="mobile-flow-node-title">Noviq</span>
                    </div>
                    <div className="mobile-flow-arrow">→</div>
                    <div className="mobile-flow-node">
                      <span className="mobile-flow-node-title">Balance</span>
                      <span className="mobile-flow-node-sub">Pre-check ✓</span>
                    </div>
                  </div>
                </div>

                <div className="mobile-flow-layer">
                  <div className="mobile-flow-layer-header">
                    <span className="mobile-flow-layer-num">02</span>
                    <span className="mobile-flow-layer-title">SERVICE</span>
                  </div>
                  <div className="mobile-flow-steps">
                    <div className="mobile-flow-node">
                      <span className="mobile-flow-node-title">API Service</span>
                      <span className="mobile-flow-node-sub">Runs First</span>
                    </div>
                    <div className="mobile-flow-arrow">→</div>
                    <div className="mobile-flow-node">
                      <span className="mobile-flow-node-title">&#123;JSON&#125;</span>
                      <span className="mobile-flow-node-sub">Result Ready</span>
                    </div>
                    <div className="mobile-flow-arrow">→</div>
                    <div className="mobile-flow-node">
                      <span className="mobile-flow-node-title">✓ Success</span>
                    </div>
                  </div>
                </div>

                <div className="mobile-flow-layer">
                  <div className="mobile-flow-layer-header">
                    <span className="mobile-flow-layer-num">03</span>
                    <span className="mobile-flow-layer-title">PAYMENT</span>
                  </div>
                  <div className="mobile-flow-steps">
                    <div className="mobile-flow-node">
                      <span className="mobile-flow-node-title">Circle</span>
                      <span className="mobile-flow-node-sub">Programmable Wallets</span>
                    </div>
                    <div className="mobile-flow-arrow">→</div>
                    <div className="mobile-flow-node">
                      <span className="mobile-flow-node-title">USDC</span>
                      <span className="mobile-flow-node-sub">transfer() on Arc</span>
                    </div>
                    <div className="mobile-flow-arrow">→</div>
                    <div className="mobile-flow-node">
                      <span className="mobile-flow-node-title">TX Confirmed ✓</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="hero-diagram-caption">
              Your agent calls an API, the service runs first — you only pay in USDC via Circle when
              the result is delivered. Settled instantly on Arc, zero gas fees.
            </p>
          </div>
        </div>

        <div className="section-manifesto reveal-on-scroll">
          <div className="manifesto-container">
            <div className="manifesto-left">
              <ul className="strikethrough-list">
                <li>sign ups</li>
                <li>credit cards</li>
                <li>subscriptions</li>
                <li>passwords</li>
              </ul>
            </div>
          </div>
        </div>
      </header>

      {/* How It Works Section */}
      <section id="how-it-works" className="section section-how">
        <div className="section-header reveal-on-scroll">
          <h2 className="section-title">How It Works</h2>
          <p className="section-subtitle">Four steps from zero to a live API response</p>
        </div>

        <div className="workflow-pipeline">
          {/* Step 1 */}
          <div className="wf-step reveal-on-scroll delay-100">
            <div className="wf-step-head">
              <span className="wf-num">01</span>
              <div className="wf-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2"></rect>
                  <path d="M16 7V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v3"></path>
                </svg>
              </div>
              <h3 className="wf-title">Connect Wallet</h3>
            </div>
            <p className="wf-desc">
              Connect via any EVM-compatible wallet. Your wallet address acts as your identity. Upon
              connecting, a Circle Programmable Wallet is provisioned for you.
            </p>
          </div>

          <div className="wf-connector" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </div>

          {/* Step 2 */}
          <div className="wf-step reveal-on-scroll delay-200">
            <div className="wf-step-head">
              <span className="wf-num">02</span>
              <div className="wf-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <h3 className="wf-title">Generate API Key</h3>
            </div>
            <p className="wf-desc">
              Go to the <strong>API</strong> page and sign with your wallet for ownership
              verification to generate a key tied to your wallet address. The key is displayed only
              once.
            </p>
          </div>

          <div className="wf-connector" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </div>

          {/* Step 3 */}
          <div className="wf-step reveal-on-scroll delay-300">
            <div className="wf-step-head">
              <span className="wf-num">03</span>
              <div className="wf-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6"></polyline>
                  <polyline points="8 6 2 12 8 18"></polyline>
                </svg>
              </div>
              <h3 className="wf-title">Call <code className="wf-inline-code">/run</code></h3>
            </div>
            <p className="wf-desc">
              POST to <code>/run</code> using an <code>Authorization: nvq_…</code> header. Provide a{" "}
              <code>service_id</code> and your <code>input_data</code>. The backend authenticates
              your key.
            </p>
          </div>

          <div className="wf-connector" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </div>

          {/* Step 4 */}
          <div className="wf-step reveal-on-scroll delay-400">
            <div className="wf-step-head">
              <span className="wf-num">04</span>
              <div className="wf-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>
              <h3 className="wf-title">Pay &amp; Receive Result</h3>
            </div>
            <p className="wf-desc">
              A USDC micro-transfer is executed on Arc. Once the transaction is confirmed on-chain,
              the requested service runs and returns the JSON result.
            </p>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section id="services" className="section section-services">
        <div className="section-header reveal-on-scroll">
          <h2 className="section-title">Choose an API Service</h2>
          <p className="section-subtitle">Data integrations and utilities. Priced per request in USDC.</p>
        </div>

        <div className="agents-grid" id="services-grid">
          {loadingServices ? (
            <div className="agents-loading">
              <div className="spinner"></div>
              <p>Loading services...</p>
            </div>
          ) : servicesError ? (
            <div className="agents-error" id="services-error-state">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>Backend Unavailable</h3>
              <p>{servicesError}</p>
              <button
                className="btn btn-secondary btn-sm"
                id="btn-retry-services"
                onClick={loadServices}
                style={{ marginTop: "0.5rem" }}
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
                  style={{ marginRight: "6px", display: "inline-block", verticalAlign: "middle", marginBottom: 0, color: "inherit" }}
                >
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                Retry Connection
              </button>
            </div>
          ) : services.length === 0 ? (
            <div className="agents-empty" id="services-empty-state">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>No Services Available</h3>
              <p>No API services are currently available.</p>
              <button
                className="btn btn-secondary btn-sm"
                id="btn-refresh-services"
                onClick={loadServices}
                style={{ marginTop: "0.5rem" }}
              >
                Refresh
              </button>
            </div>
          ) : (
            services.map((service, index) => {
              const priceFormatted =
                service.price_usdc < 0.01
                  ? service.price_usdc.toFixed(3)
                  : service.price_usdc.toFixed(2);
              const isSelected = selectedService?.id === service.id;

              return (
                <div
                  key={service.id}
                  className={`agent-card service-card ${isSelected ? "selected" : ""}`}
                  style={{ animationDelay: `${index * 0.1}s`, cursor: "pointer" }}
                  onClick={() => handleSelectService(service)}
                >
                  <div className="agent-card-header">
                    <span className="agent-card-name">{service.name}</span>
                    <span className="agent-card-price agent-card-price--accent">
                      ${priceFormatted} USDC
                    </span>
                  </div>
                  <p className="agent-card-desc">{service.description}</p>
                  <div className="agent-card-footer">
                    <span className="agent-card-cta">API Integration →</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Global Snippet Panel */}
      <section id="global-snippet" className="section section-snippet section-snippet-wrapper">
        <div className="code-snippet-panel reveal-on-scroll">
          <div className="code-snippet-header">
            <div className="code-snippet-dots">
              <div className="code-snippet-dot red"></div>
              <div className="code-snippet-dot yellow"></div>
              <div className="code-snippet-dot green"></div>
            </div>
            <div className="code-snippet-tabs">
              <button
                className={`snippet-tab ${activeSnippetTab === "python" ? "active" : ""}`}
                onClick={() => setActiveSnippetTab("python")}
              >
                Python
              </button>
              <button
                className={`snippet-tab ${activeSnippetTab === "node" ? "active" : ""}`}
                onClick={() => setActiveSnippetTab("node")}
              >
                Node.js
              </button>
            </div>
          </div>
          <div className="code-snippet-body">
            <button className="code-snippet-copy" id="btn-copy-snippet" onClick={handleCopySnippet}>
              Copy
            </button>

            {activeSnippetTab === "python" ? (
              <pre id="snippet-python">
                <code>
                  <span className="syntax-keyword">import </span>
                  <span className="syntax-module">requests</span>
                  {"\n\n"}
                  <span className="syntax-variable">response</span> = <span className="syntax-module">requests</span>.post(
                  <span className="syntax-string">&quot;{currentOrigin}/run&quot;</span>,
                  {"\n    "}headers=&#123;<span className="syntax-string">&quot;Authorization&quot;</span>: <span className="syntax-string">&quot;{apiKey || "nvq_YOUR_API_KEY"}&quot;</span>&#125;,
                  {"\n    "}json=&#123;
                  {"\n        "}<span className="syntax-string">&quot;service_id&quot;</span>: <span className="syntax-string" id="snippet-service-id">&quot;{currentServiceId}&quot;</span>,
                  {"\n        "}<span className="syntax-string">&quot;input_data&quot;</span>: <span className="syntax-string" id="snippet-input-data">&quot;{currentExampleInput}&quot;</span>
                  {"\n    "}&#125;
                  {"\n"}&#41;
                  {"\n"}
                  <span className="syntax-builtin">print</span>(response.json()[<span className="syntax-string">&quot;result&quot;</span>])
                </code>
              </pre>
            ) : (
              <pre id="snippet-node">
                <code>
                  <span className="syntax-keyword">const</span> response = <span className="syntax-keyword">await</span>{" "}
                  <span className="syntax-builtin">fetch</span>(<span className="syntax-string">&quot;{currentOrigin}/run&quot;</span>, &#123;
                  {"\n    "}method: <span className="syntax-string">&quot;POST&quot;</span>,
                  {"\n    "}headers: &#123;
                  {"\n        "}<span className="syntax-string">&quot;Content-Type&quot;</span>: <span className="syntax-string">&quot;application/json&quot;</span>,
                  {"\n        "}<span className="syntax-string">&quot;Authorization&quot;</span>: <span className="syntax-string">&quot;{apiKey || "nvq_YOUR_API_KEY"}&quot;</span>
                  {"\n    "}&#125;,
                  {"\n    "}body: <span className="syntax-builtin">JSON</span>.stringify(&#123;
                  {"\n        "}<span className="syntax-string">&quot;service_id&quot;</span>: <span className="syntax-string" id="snippet-service-id-node">&quot;{currentServiceId}&quot;</span>,
                  {"\n        "}<span className="syntax-string">&quot;input_data&quot;</span>: <span className="syntax-string" id="snippet-input-data-node">&quot;{currentExampleInput}&quot;</span>
                  {"\n    "}&#125;)
                  {"\n"}&#125;);
                  {"\n"}
                  <span className="syntax-keyword">const</span> data = <span className="syntax-keyword">await</span> response.json();
                  {"\n"}
                  <span className="syntax-builtin">console</span>.log(data.result);
                </code>
              </pre>
            )}
          </div>
        </div>
      </section>

      {/* Transaction History / Logs Section */}
      <section id="history" className="section section-history">
        <div className="section-header reveal-on-scroll">
          <h2 className="section-title">Transaction History</h2>
          <p className="section-subtitle">Your recent agent runs and payment authorizations.</p>
        </div>
        <div className="history-table-wrapper glass-panel">
          <div className="history-table-inner">
            <div className="history-table-header-box">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Service</th>
                    <th>Cost</th>
                    <th>Status</th>
                    <th>Tx Hash</th>
                  </tr>
                </thead>
              </table>
            </div>
            <div className="history-table-body-box">
              {transactions.length > 0 ? (
                <table className="history-table">
                  <tbody id="history-tbody">
                    {transactions.map((entry, idx) => {
                      const isFailed = entry.status === "failed";
                      const statusLabel = isFailed ? "Failed" : "Done";
                      const statusIcon = isFailed ? "❌" : "✅";
                      const txRef = entry.txHash || entry.paymentRef || "";

                      let formattedTime = "";
                      try {
                        formattedTime = new Date(entry.time).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: true,
                        });
                      } catch {
                        formattedTime = String(entry.time || "");
                      }

                      const costFormatted =
                        entry.cost > 0 && entry.cost < 0.01
                          ? entry.cost.toFixed(3)
                          : Number(entry.cost || 0).toFixed(2);

                      const matchedService = services.find((s) => s.id === entry.service_id);
                      const displayService = matchedService ? matchedService.name : entry.service_id || "Unknown";

                      return (
                        <tr key={idx}>
                          <td className="history-cell-time">{formattedTime}</td>
                          <td className="history-cell-service">{displayService}</td>
                          <td className="history-cell-cost">${costFormatted}</td>
                          <td className="history-cell-status">
                            {statusIcon} {statusLabel}
                          </td>
                          <td className="history-cell-tx">
                            <div className="history-tx-wrapper">
                              <a
                                href={`https://testnet.arcscan.app/tx/${txRef}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ref-mono history-tx-link"
                              >
                                {truncateRef(txRef)}
                              </a>
                              {txRef && (
                                <button
                                  type="button"
                                  className="btn-icon"
                                  onClick={() => {
                                    navigator.clipboard.writeText(txRef);
                                    showToast("Tx Hash copied!", "success");
                                  }}
                                  title="Copy to clipboard"
                                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "inline-flex", alignItems: "center" }}
                                >
                                  <svg
                                    className="history-tx-copy-icon"
                                    width="12"
                                    height="12"
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
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="history-empty" id="history-empty">
                  <p>{userId ? "No transactions yet." : "Connect wallet to view transactions."}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
