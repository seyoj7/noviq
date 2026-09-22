"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useWallet } from "@/context/WalletContext";

function truncateAddress(addr: string | null | undefined): string {
  if (!addr || addr.length < 10) return addr || "";
  if (typeof window !== "undefined" && window.innerWidth <= 480) {
    return addr.slice(0, 4) + "···" + addr.slice(-3);
  }
  return addr.slice(0, 6) + "···" + addr.slice(-4);
}

export function Navbar({ activePage }: { activePage?: string }) {
  const { wallet, isConnecting, connectWallet, openWalletPanel } = useWallet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 40;
      setScrolled(isScrolled);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const faucetUrl = wallet?.address
    ? `https://faucet.circle.com/?address=${wallet.address}`
    : "https://faucet.circle.com/";

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <>
      <nav id="navbar" className={`navbar ${scrolled ? "scrolled" : ""}`}>
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
        </div>

        <div className="navbar-links">
          <Link href="/#how-it-works">Workflow</Link>
          <Link href="/#services">Services</Link>
          <Link
            href="/api-keys"
            className={pathname === "/api-keys" || pathname === "/api" || activePage === "api" ? "active" : ""}
          >
            API Keys
          </Link>
          <Link
            href="/docs"
            className={pathname === "/docs" || activePage === "docs" ? "active" : ""}
          >
            Docs
          </Link>
          <Link href="/#history">Logs</Link>
        </div>

        <div className="navbar-controls">
          <a
            href={faucetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm nav-faucet-btn"
            id="btn-faucet"
            title="Get testnet USDC"
          >
            Faucet ↗
          </a>

          <div className="navbar-wallet" id="navbar-wallet">
            {wallet ? (
              <div className="navbar-wallet-info">
                <div
                  className="wallet-address-chip"
                  id="nav-wallet-address"
                  title={wallet.user_id}
                  onClick={openWalletPanel}
                  style={{ cursor: "pointer" }}
                >
                  {truncateAddress(wallet.user_id)}
                </div>
              </div>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                id="btn-connect-wallet"
                onClick={connectWallet}
                disabled={isConnecting}
              >
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>
            )}
          </div>

          <button
            id="btn-mobile-menu"
            className="btn btn-ghost btn-sm btn-icon mobile-menu-toggle"
            aria-label="Open mobile menu"
            onClick={() => setMobileMenuOpen(true)}
          >
            <svg
              width="22"
              height="22"
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

      {/* Mobile Navigation Drawer */}
      <div
        id="mobile-menu"
        className={`mobile-menu ${mobileMenuOpen ? "open" : ""}`}
        aria-hidden={!mobileMenuOpen}
      >
        <div
          className="mobile-menu-backdrop"
          id="mobile-menu-backdrop"
          onClick={closeMobileMenu}
        />
        <div className="mobile-menu-drawer">
          <div className="mobile-menu-header">
            <div className="navbar-brand">
              <Image src="/assets/Noviq.png" alt="Noviq Logo" width={26} height={26} className="brand-logo" />
              <span className="brand-text">noviq</span>
              <span className="beta-badge">beta</span>
            </div>
            <button
              className="btn btn-ghost btn-sm btn-icon"
              id="btn-close-mobile-menu"
              aria-label="Close menu"
              onClick={closeMobileMenu}
            >
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
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <nav className="mobile-menu-links">
            <Link
              href="/#how-it-works"
              className="mobile-menu-link"
              onClick={closeMobileMenu}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              <span>Workflow</span>
            </Link>

            <Link
              href="/#services"
              className="mobile-menu-link"
              onClick={closeMobileMenu}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v3" />
              </svg>
              <span>API Services</span>
            </Link>

            <Link
              href="/api-keys"
              className={`mobile-menu-link ${pathname === "/api-keys" || pathname === "/api" ? "active" : ""}`}
              onClick={closeMobileMenu}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>API Keys</span>
            </Link>

            <Link
              href="/docs"
              className={`mobile-menu-link ${pathname === "/docs" ? "active" : ""}`}
              onClick={closeMobileMenu}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
              <span>Docs</span>
            </Link>

            <Link
              href="/#history"
              className="mobile-menu-link"
              onClick={closeMobileMenu}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Logs</span>
            </Link>
          </nav>

          <div className="mobile-menu-footer">
            <a
              href={faucetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary mobile-menu-btn"
            >
              Circle USDC Faucet ↗
            </a>
            <a
              href="https://github.com/seyoj7/noviq"
              target="_blank"
              rel="noopener noreferrer"
              className="mobile-menu-ext-link"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
              </svg>
              <span>View on GitHub</span>
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
