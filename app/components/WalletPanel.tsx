"use client";

import React from "react";
import { useWallet } from "@/context/WalletContext";
import { useToast } from "@/context/ToastContext";

function truncateAddress(addr: string | null | undefined): string {
  if (!addr || addr.length < 10) return addr || "";
  if (typeof window !== "undefined" && window.innerWidth <= 480) {
    return addr.slice(0, 4) + "···" + addr.slice(-3);
  }
  return addr.slice(0, 6) + "···" + addr.slice(-4);
}

export function WalletPanel() {
  const { wallet, isWalletPanelOpen, closeWalletPanel, disconnectWallet } = useWallet();
  const { showToast } = useToast();

  if (!wallet) return null;

  const balanceFormatted =
    wallet.usdc_balance > 0 && wallet.usdc_balance < 0.01
      ? wallet.usdc_balance.toFixed(3)
      : Number(wallet.usdc_balance || 0).toFixed(2);

  const copyDetail = (label: string, value: string) => {
    navigator.clipboard.writeText(value);
    showToast(`${label} copied!`, "success");
  };

  return (
    <div id="wallet-panel" className={`wallet-panel ${isWalletPanelOpen ? "open" : ""}`}>
      <div
        className="wallet-panel-backdrop"
        id="wallet-backdrop"
        onClick={closeWalletPanel}
      />
      <div className="wallet-panel-content glass-panel">
        <div className="wallet-panel-header">
          <h3>Your Wallet</h3>
          <button
            className="btn btn-ghost btn-sm text-error"
            id="btn-disconnect-wallet"
            title="Disconnect Wallet"
            onClick={disconnectWallet}
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
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>

        <div className="wallet-panel-body" id="wallet-panel-body">
          <div className="wallet-balance-display">
            <div className="wallet-balance-amount">${balanceFormatted}</div>
            <div className="wallet-balance-currency">USDC on Arc Testnet</div>
          </div>

          <div className="wallet-detail">
            <span className="wallet-detail-label">Circle Address</span>
            <div
              className="wallet-detail-value-wrapper"
              onClick={() => copyDetail("Circle Address", wallet.address)}
              title="Click to copy"
            >
              <span className="wallet-detail-value" title={wallet.address}>
                {truncateAddress(wallet.address)}
              </span>
              <svg
                className="wallet-detail-copy-icon"
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
            </div>
          </div>

          <div className="wallet-detail">
            <span className="wallet-detail-label">Wallet ID</span>
            <div
              className="wallet-detail-value-wrapper"
              onClick={() => copyDetail("Wallet ID", wallet.wallet_id)}
              title="Click to copy"
            >
              <span className="wallet-detail-value" title={wallet.wallet_id}>
                {truncateAddress(wallet.wallet_id)}
              </span>
              <svg
                className="wallet-detail-copy-icon"
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
            </div>
          </div>

          <div className="wallet-detail">
            <span className="wallet-detail-label">EVM Address</span>
            <div
              className="wallet-detail-value-wrapper"
              onClick={() => copyDetail("EVM Address", wallet.user_id)}
              title="Click to copy"
            >
              <span className="wallet-detail-value" title={wallet.user_id}>
                {truncateAddress(wallet.user_id)}
              </span>
              <svg
                className="wallet-detail-copy-icon"
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
            </div>
          </div>

          <div className="wallet-detail">
            <span className="wallet-detail-label">Network</span>
            <div className="wallet-detail-value-wrapper wallet-detail-value-wrapper--static">
              <span className="wallet-detail-value" title="Arc Testnet">
                Arc Testnet
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
