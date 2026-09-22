"use client";

import React from "react";
import { ToastProvider } from "@/context/ToastContext";
import { WalletProvider } from "@/context/WalletContext";
import { WalletPanel } from "./WalletPanel";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <WalletProvider>
        {children}
        <WalletPanel />
      </WalletProvider>
    </ToastProvider>
  );
}
