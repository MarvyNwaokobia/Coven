/**
 * CCTP v2 cross-chain payment handling, built on @cctp-sdk/core.
 *
 * Client side: initiateXChainPayment burns USDC on the source chain using
 * the SDK's state machine (approve + depositForBurn), then hands off as
 * soon as the burn confirms — it does NOT wait for the SDK to also relay,
 * since that would require the relayer's private key in the browser.
 *
 * Server side: relayToArc polls Circle's attestation service for the
 * signed message (via the SDK's AttestationClient, which sidesteps CCTP
 * v2's raw-event zero-nonce bug) and submits receiveMessage on Arc using
 * the relayer key.
 */
import { ethers } from "ethers";
import type { WalletClient, Address } from "viem";
import {
  CctpClient,
  AttestationClient,
  getChain,
  MESSAGE_TRANSMITTER_ABI,
  type SupportedChain,
  type TransferStateSnapshot,
} from "@cctp-sdk/core";

const CCTP_ENV = (process.env.NEXT_PUBLIC_CCTP_ENV as "mainnet" | "testnet") ?? "testnet";

/** Chains Coven currently offers as a cross-chain payment source. */
export type SourceChain = "ethereum" | "base" | "polygon" | "arbitrum";

/**
 * Per-chain RPC endpoints. These are not optional: every chain in the SDK's
 * testnet registry ships with `rpc: undefined`, so without an override its
 * public-client helper calls viem's `http()` with no URL and throws
 * "No URL was provided to the Transport" before any transfer can start.
 * Public defaults keep the demo working; override via env for a paid node.
 */
const RPC_URLS: Record<SourceChain | "arc", string> = {
  ethereum:
    process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com",
  base: process.env.NEXT_PUBLIC_BASE_RPC_URL ?? "https://base-sepolia-rpc.publicnode.com",
  polygon: process.env.NEXT_PUBLIC_POLYGON_RPC_URL ?? "https://polygon-amoy-bor-rpc.publicnode.com",
  arbitrum:
    process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL ?? "https://arbitrum-sepolia-rpc.publicnode.com",
  arc: process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network",
};

/**
 * The SDK looks its `rpcs` map up by `chainConfig.name.toLowerCase()` — the
 * display name ("ethereum sepolia"), not the `SupportedChain` key
 * ("ethereum") its own type advertises. We register both spellings so the
 * lookup resolves either way, and keeps working if the SDK fixes the key.
 */
function rpcOverrides(): Partial<Record<SupportedChain, string>> {
  const out: Record<string, string> = {};
  for (const [chain, url] of Object.entries(RPC_URLS)) {
    out[chain] = url;
    try {
      out[getChain(chain as SupportedChain, CCTP_ENV).name.toLowerCase()] = url;
    } catch {
      // Chain not in this env's registry (e.g. arc has no mainnet entry yet).
    }
  }
  return out as Partial<Record<SupportedChain, string>>;
}

function getCctpClient(): CctpClient {
  return new CctpClient({
    env: CCTP_ENV,
    attestationApiUrl: process.env.CCTP_ATTESTATION_API,
    rpcs: rpcOverrides(),
  });
}

/**
 * Burn USDC on the source chain via CCTP. Resolves as soon as the burn
 * transaction confirms — the SDK's own state machine keeps running in the
 * background attempting to reach the relay step, but without a destination
 * wallet client that leg fails harmlessly; the real relay happens via
 * relayToArc() server-side.
 */
export async function initiateXChainPayment(params: {
  sourceWallet: WalletClient;
  recipientAddress: Address;
  amountUsdc: bigint;
  sourceChain: SourceChain;
}): Promise<{ txHash: `0x${string}`; transferId: string }> {
  const { sourceWallet, recipientAddress, amountUsdc, sourceChain } = params;
  const client = getCctpClient();

  const transfer = await client.transfer(
    { from: sourceChain, to: "arc" as SupportedChain, amount: amountUsdc, recipient: recipientAddress },
    sourceWallet
  );

  return new Promise((resolve, reject) => {
    const onStateChange = (snap: TransferStateSnapshot) => {
      if (snap.sourceTxHash) {
        cleanup();
        resolve({ txHash: snap.sourceTxHash, transferId: transfer.transferId });
      }
    };
    const onError = () => {
      // Errors that land before we've captured a burn tx hash are real
      // failures (e.g. approval rejected). Errors afterward are the SDK's
      // own relay attempt failing without a destination wallet — expected
      // and harmless since our backend takes over from here.
      if (!transfer.currentSnapshot.sourceTxHash) {
        cleanup();
        reject(new Error(transfer.currentSnapshot.error?.message ?? "CCTP burn failed"));
      }
    };
    function cleanup() {
      transfer.off("stateChange", onStateChange);
      transfer.off("error", onError);
    }
    transfer.on("stateChange", onStateChange);
    transfer.on("error", onError);
  });
}

/**
 * Poll Circle's attestation service for the signed message, then relay it
 * to Arc. Server-side only (uses the relayer key).
 */
export async function relayToArc(params: {
  sourceTxHash: `0x${string}`;
  sourceChain: SourceChain;
}): Promise<string> {
  const { sourceTxHash, sourceChain } = params;
  const sourceDomain = getChain(sourceChain, CCTP_ENV).domain;

  const attestationClient = new AttestationClient(
    process.env.CCTP_ATTESTATION_API ?? "https://iris-api-sandbox.circle.com"
  );
  const { messageBytes, attestation } = await attestationClient.poll(sourceTxHash, sourceDomain, {
    maxAttempts: 30,
    intervalMs: 2000,
  });

  const arcProvider = new ethers.JsonRpcProvider(process.env.ARC_RPC_URL);
  const relayer = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY!, arcProvider);

  const transmitter = new ethers.Contract(
    process.env.ARC_MESSAGE_TRANSMITTER_ADDRESS!,
    MESSAGE_TRANSMITTER_ABI,
    relayer
  );

  const tx = await transmitter.receiveMessage(messageBytes, attestation);
  const receipt = await tx.wait();
  return receipt.hash;
}

/** Fee + time estimate for a cross-chain send — for display before confirming. */
export async function estimateCrossChainFee(params: {
  sourceChain: SourceChain;
  amountUsdc: bigint;
}) {
  const client = getCctpClient();
  return client.estimateFee({
    from: params.sourceChain,
    to: "arc" as SupportedChain,
    amount: params.amountUsdc,
    fast: true,
  });
}
