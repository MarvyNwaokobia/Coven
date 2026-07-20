/**
 * CCTP v2 cross-chain payment handling.
 *
 * Client side: initiateXChainPayment burns USDC on the source chain.
 * Server side: relayToArc polls Circle's attestation service and relays
 * the mint message to Arc.
 */
import { ethers } from "ethers";

const CCTP_TOKEN_MESSENGER_ABI = [
  "function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken) returns (uint64 nonce)",
];

const CCTP_MESSAGE_TRANSMITTER_ABI = [
  "function receiveMessage(bytes message, bytes attestation) returns (bool)",
];

/** Arc CCTP domain — 26 on testnet (see ARC_TESTNET.md §3). Confirm again before mainnet. */
export const ARC_DOMAIN = Number(process.env.NEXT_PUBLIC_ARC_CCTP_DOMAIN ?? 26);

export type SourceChain = "ethereum" | "base" | "polygon" | "arbitrum";

// CCTP TokenMessenger per source chain (mainnet addresses)
const TOKEN_MESSENGER: Record<SourceChain, string> = {
  ethereum: "0xBd3fa81B58Ba92a82136038B25aDec7066af3155",
  base: "0x1682Ae6375C4E4A97e4B583BC394c861A46D8962",
  polygon: "0x9daF8c91AEFAE50b9c0E69629D3F6Ca40cA3B3FE",
  arbitrum: "0x19330d10D9Cc8751218eaf51E8885D058642E08A",
};

const USDC_ADDRESS: Record<SourceChain, string> = {
  ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  polygon: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  arbitrum: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
};

/**
 * Burn USDC on the source chain via CCTP. The recipient is credited on Arc
 * once the backend relays the attested message.
 */
export async function initiateXChainPayment(params: {
  sourceWallet: ethers.Signer;
  recipientAddress: string;
  amountUsdc: bigint;
  sourceChain: SourceChain;
}): Promise<{ txHash: string; messageHash: string; messageBytes: string }> {
  const { sourceWallet, recipientAddress, amountUsdc, sourceChain } = params;
  const tokenMessengerAddress = TOKEN_MESSENGER[sourceChain];
  const usdcAddress = USDC_ADDRESS[sourceChain];

  const usdc = new ethers.Contract(
    usdcAddress,
    ["function approve(address spender, uint256 amount) returns (bool)"],
    sourceWallet
  );

  const approveTx = await usdc.approve(tokenMessengerAddress, amountUsdc);
  await approveTx.wait();

  const mintRecipient = ethers.zeroPadValue(recipientAddress, 32);

  const tokenMessenger = new ethers.Contract(
    tokenMessengerAddress,
    CCTP_TOKEN_MESSENGER_ABI,
    sourceWallet
  );

  const burnTx = await tokenMessenger.depositForBurn(
    amountUsdc,
    ARC_DOMAIN,
    mintRecipient,
    usdcAddress
  );
  const receipt = await burnTx.wait();

  const messageBytes = extractMessageFromReceipt(receipt);
  const messageHash = ethers.keccak256(messageBytes);

  return { txHash: receipt.hash, messageHash, messageBytes };
}

/**
 * Poll Circle's attestation service, then relay the mint message to Arc.
 * Server-side only (uses the relayer key).
 */
export async function relayToArc(messageHash: string): Promise<string> {
  const attestation = await pollForAttestation(messageHash);

  const arcProvider = new ethers.JsonRpcProvider(process.env.ARC_RPC_URL);
  const relayer = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY!, arcProvider);

  const transmitter = new ethers.Contract(
    process.env.ARC_MESSAGE_TRANSMITTER_ADDRESS!,
    CCTP_MESSAGE_TRANSMITTER_ABI,
    relayer
  );

  const tx = await transmitter.receiveMessage(attestation.message, attestation.attestation);
  const receipt = await tx.wait();
  return receipt.hash;
}

async function pollForAttestation(
  messageHash: string,
  maxAttempts = 30
): Promise<{ message: string; attestation: string }> {
  const base = process.env.CCTP_ATTESTATION_API ?? "https://iris-api-sandbox.circle.com";
  const url = `${base}/attestations/${messageHash}`;

  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.status === "complete") {
        return { message: data.message, attestation: data.attestation };
      }
    }
    await sleep(2000);
  }
  throw new Error(`CCTP attestation timeout for ${messageHash}`);
}

function extractMessageFromReceipt(receipt: ethers.TransactionReceipt): string {
  const iface = new ethers.Interface(["event MessageSent(bytes message)"]);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === "MessageSent") return parsed.args[0] as string;
    } catch {
      // not a MessageSent log — keep scanning
    }
  }
  throw new Error("Could not extract CCTP message from receipt");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
