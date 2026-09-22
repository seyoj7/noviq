"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useToast } from "./ToastContext";

export interface WalletData {
  user_id: string;
  address: string;
  wallet_id: string;
  usdc_balance: number;
}

interface WalletContextType {
  userId: string | null;
  wallet: WalletData | null;
  apiKey: string | null;
  isConnecting: boolean;
  isWalletPanelOpen: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  refreshWallet: () => Promise<void>;
  openWalletPanel: () => void;
  closeWalletPanel: () => void;
  setApiKey: (key: string | null) => void;
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
      on?: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isWalletPanelOpen, setIsWalletPanelOpen] = useState(false);
  const { showToast } = useToast();

  const setApiKey = useCallback((key: string | null) => {
    setApiKeyState(key);
    if (key) {
      localStorage.setItem("noviq_api_key", key);
    } else {
      localStorage.removeItem("noviq_api_key");
    }
  }, []);

  const refreshWallet = useCallback(async () => {
    const saved = localStorage.getItem("noviq_wallet");
    if (!saved) return;
    try {
      const parsed: WalletData = JSON.parse(saved);
      const res = await fetch("/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: parsed.user_id }),
      });
      if (res.ok) {
        const updated: WalletData = await res.json();
        setWallet(updated);
        setUserId(updated.user_id);
        localStorage.setItem("noviq_wallet", JSON.stringify(updated));
      }
    } catch (e) {
      console.error("Silent wallet refresh failed", e);
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    setIsWalletPanelOpen(false);
    setWallet(null);
    setUserId(null);
    setApiKeyState(null);
    localStorage.removeItem("noviq_wallet");
    localStorage.removeItem("noviq_api_key");
    showToast("Wallet disconnected", "info");
  }, [showToast]);

  const connectWallet = useCallback(async () => {
    if (typeof window === "undefined" || typeof window.ethereum === "undefined") {
      showToast("Please install MetaMask (or an EVM wallet) to connect.", "error");
      return;
    }

    setIsConnecting(true);

    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[] | undefined;

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found.");
      }

      const activeAddress = accounts[0];
      setUserId(activeAddress);

      const resp = await fetch("/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: activeAddress }),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const walletData: WalletData = await resp.json();
      setWallet(walletData);
      setUserId(walletData.user_id);
      localStorage.setItem("noviq_wallet", JSON.stringify(walletData));

      showToast("Wallet connected!", "success");
      setIsWalletPanelOpen(true);
    } catch (err: unknown) {
      console.error("Wallet connect error:", err);
      const e = err as { code?: number; message?: string };
      if (e?.code === -32002 || e?.message?.includes("already pending")) {
        showToast(
          "MetaMask is already open. Please click the MetaMask extension icon in your browser toolbar to continue.",
          "warning"
        );
      } else {
        showToast(e?.message || "Failed to connect wallet.", "error");
      }
    } finally {
      setIsConnecting(false);
    }
  }, [showToast]);

  // Restore wallet session on initial mount
  useEffect(() => {
    const restoreSession = () => {
      const savedWallet = localStorage.getItem("noviq_wallet");
      const savedApiKey = localStorage.getItem("noviq_api_key");

      if (savedWallet) {
        try {
          const parsed = JSON.parse(savedWallet);
          setWallet(parsed);
          setUserId(parsed.user_id);
        } catch (e) {
          console.error("Failed to parse saved wallet", e);
        }
      }

      if (savedApiKey) {
        setApiKeyState(savedApiKey);
      }

      void refreshWallet();
    };

    queueMicrotask(restoreSession);
  }, [refreshWallet]);

  // Listen to accountsChanged
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum?.on) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const accList = accounts as string[] | undefined;
      if (!accList || accList.length === 0) {
        disconnectWallet();
      } else if (userId && accList[0].toLowerCase() !== userId.toLowerCase()) {
        void connectWallet();
      }
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, [userId, connectWallet, disconnectWallet]);

  const openWalletPanel = useCallback(() => {
    if (wallet) {
      setIsWalletPanelOpen(true);
    }
  }, [wallet]);

  const closeWalletPanel = useCallback(() => {
    setIsWalletPanelOpen(false);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        userId,
        wallet,
        apiKey,
        isConnecting,
        isWalletPanelOpen,
        connectWallet,
        disconnectWallet,
        refreshWallet,
        openWalletPanel,
        closeWalletPanel,
        setApiKey,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
