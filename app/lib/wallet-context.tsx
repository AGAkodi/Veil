"use client";

import { DecryptPermission } from "@provablehq/aleo-wallet-adaptor-core";
import {
  WalletReadyState,
  type WalletAdapter,
  type WalletName,
} from "@provablehq/aleo-wallet-standard";
import {
  AleoWalletProvider,
  useWallet as useAleoWallet,
} from "@provablehq/aleo-wallet-adaptor-react";
import { LeoWalletAdapter } from "@provablehq/aleo-wallet-adaptor-leo";
import { ShieldWalletAdapter } from "@provablehq/aleo-wallet-adaptor-shield";
import { Network, type TransactionOptions, type TransactionStatusResponse } from "@provablehq/aleo-types";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { PROGRAM_ID, describeWalletError } from "./aleo";

/**
 * The funded testnet account used throughout this build's on-chain testing
 * (see README's Testnet Deployment table). Offered as an explicit, clearly
 * labeled "demo mode" fallback — never the default outcome of clicking
 * Connect — for browsers without either wallet extension installed. The
 * address is public data already visible on the testnet explorer.
 */
const DEMO_ADDRESS =
  "aleo15m50rvhx0glq0hjv807c2t0z40et9ljmvdjrqv8f4pr8evzs2qysfnv2un";

export const NETWORK = Network.TESTNET;

type WalletStatus = "disconnected" | "connecting" | "connected";

export type WalletOption = {
  name: WalletName;
  displayName: string;
  recommended: boolean;
  installed: boolean;
  installUrl: string;
};

type WalletState = {
  status: WalletStatus;
  address: string | null;
  isDemo: boolean;
  error: string | null;
  walletOptions: WalletOption[];
  connect: (name: WalletName) => Promise<void>;
  connectDemo: () => void;
  disconnect: () => void;
  /** undefined outside a real connection (not connected, or demo mode). */
  requestRecords:
    | ((
        program: string,
        includePlaintext?: boolean,
        statusFilter?: "all" | "spent" | "unspent"
      ) => Promise<unknown[]>)
    | undefined;
  executeTransaction:
    | ((options: TransactionOptions) => Promise<{ transactionId: string } | undefined>)
    | undefined;
  transactionStatus: ((id: string) => Promise<TransactionStatusResponse>) | undefined;
};

const WalletStateContext = createContext<WalletState | null>(null);

const SHIELD_INSTALL_URL =
  "https://chromewebstore.google.com/detail/shield/hhddpjpacfjaakjioinajgmhlbhfchao";
const LEO_INSTALL_URL = "https://www.leo.app/download";

function WalletBridge({ children }: { children: React.ReactNode }) {
  const {
    wallets,
    selectWallet,
    connect: aleoConnect,
    disconnect: aleoDisconnect,
    connected,
    connecting,
    address: realAddress,
    requestRecords,
    executeTransaction,
    transactionStatus,
  } = useAleoWallet();

  const [isDemo, setIsDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const walletOptions: WalletOption[] = useMemo(
    () =>
      wallets.map(({ adapter, readyState }) => ({
        name: adapter.name,
        displayName: adapter.name,
        recommended: adapter.name === "Shield Wallet",
        installed: readyState === WalletReadyState.INSTALLED,
        installUrl: adapter.name === "Shield Wallet" ? SHIELD_INSTALL_URL : LEO_INSTALL_URL,
      })),
    [wallets]
  );

  const connect = useCallback(
    async (name: WalletName) => {
      setError(null);
      try {
        selectWallet(name);
        await aleoConnect(NETWORK);
      } catch (err) {
        setError(describeWalletError(err));
        throw err;
      }
    },
    [selectWallet, aleoConnect]
  );

  const connectDemo = useCallback(() => {
    setError(null);
    setIsDemo(true);
  }, []);

  const disconnect = useCallback(() => {
    setIsDemo(false);
    setError(null);
    if (connected) void aleoDisconnect().catch(() => {});
  }, [aleoDisconnect, connected]);

  const status: WalletStatus = isDemo
    ? "connected"
    : connecting
      ? "connecting"
      : connected
        ? "connected"
        : "disconnected";

  const value: WalletState = useMemo(
    () => ({
      status,
      address: isDemo ? DEMO_ADDRESS : realAddress,
      isDemo,
      error,
      walletOptions,
      connect,
      connectDemo,
      disconnect,
      requestRecords: isDemo ? undefined : requestRecords,
      executeTransaction: isDemo ? undefined : executeTransaction,
      transactionStatus: isDemo ? undefined : transactionStatus,
    }),
    [
      status,
      isDemo,
      realAddress,
      error,
      walletOptions,
      connect,
      connectDemo,
      disconnect,
      requestRecords,
      executeTransaction,
      transactionStatus,
    ]
  );

  return (
    <WalletStateContext.Provider value={value}>
      {children}
    </WalletStateContext.Provider>
  );
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const wallets = useMemo<WalletAdapter[]>(
    () => [new ShieldWalletAdapter(), new LeoWalletAdapter({ appName: "Veil" })],
    []
  );

  return (
    <AleoWalletProvider
      wallets={wallets}
      network={NETWORK}
      decryptPermission={DecryptPermission.UponRequest}
      programs={[PROGRAM_ID]}
      autoConnect
    >
      <WalletBridge>{children}</WalletBridge>
    </AleoWalletProvider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletStateContext);
  if (!ctx) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return ctx;
}

export function truncateAddress(address: string) {
  return `${address.slice(0, 9)}…${address.slice(-6)}`;
}
