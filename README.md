# PayCircle — Social USDC Payments on Arc

> **Hackathon:** Arc Build Hackathon · Circle × Arc
> **Track:** DeFi (Payments Infrastructure)
> **Chain:** Arc L1 · USDC native gas · Sub-500ms finality
> **Stack:** Next.js 14 · Supabase · Circle Programmable Wallets · CCTP · Yellow Card
> **One Line:** Send USDC to anyone from any chain, cash out to any bank — built around communities not wallets.

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [How It Works — Full Flow](#2-how-it-works--full-flow)
3. [System Architecture](#3-system-architecture)
4. [Smart Contracts](#4-smart-contracts)
5. [Circle & CCTP Integration](#5-circle--cctp-integration)
6. [Yellow Card Offramp Integration](#6-yellow-card-offramp-integration)
7. [Core Features — Detailed Spec](#7-core-features--detailed-spec)
8. [Frontend Pages & UI](#8-frontend-pages--ui)
9. [Backend & API Routes](#9-backend--api-routes)
10. [Database Schema](#10-database-schema)
11. [Revenue Model](#11-revenue-model)
12. [Build Order](#12-build-order)
13. [Environment Variables](#13-environment-variables)
14. [File Structure](#14-file-structure)
15. [Submission Checklist](#15-submission-checklist)

---

## 1. Product Vision

**PayCircle** is a social USDC payments app built on Arc. Users get a @username, a friends list, and belong to Circles — groups where money moves together. Payments settle on Arc in USDC via Circle Programmable Wallets. Senders can pay from any chain — CCTP handles cross-chain routing invisibly. Recipients cash out to their local bank account anywhere in the world.

### Why This Beats Every Existing Crypto Payments App

| App | Cross-chain? | Bank offramp? | No wallet needed? | Social layer? |
|-----|-------------|--------------|------------------|---------------|
| Coinbase Pay | ❌ Base only | ❌ US only | ❌ | ❌ |
| BeerMe | ❌ | ❌ | ❌ | ✅ |
| CIP | ✅ | ❌ | ❌ Needs wallet | ❌ |
| Venmo | ❌ Fiat only | ✅ US only | ✅ | ✅ |
| MiniPay | ❌ Celo only | ⚠️ Limited | ✅ | ❌ |
| **PayCircle** | ✅ Any chain | ✅ 20+ countries | ✅ | ✅ |

### The Arc-Native Flow Nobody Else Can Replicate

```
Sender on Ethereum pays 50 USDC
        ↓
CCTP burns USDC on Ethereum
        ↓
USDC minted on Arc (<500ms)
        ↓
Arc settles to recipient's Circle wallet (USDC)
        ↓
Recipient hits "Cash Out"
        ↓
Yellow Card converts USDC → NGN
        ↓
₦78,000 lands in recipient's First Bank account
```

This full flow — from any chain to a local bank account — is only possible on Arc right now. No other social payments app can do it.

### Who Uses This

**Senders:** Anyone with crypto on any chain who wants to pay a friend, split a bill, or pay a merchant without worrying about which chain the recipient is on.

**Recipients:** People in Nigeria, Ghana, Kenya, and globally who want to receive USDC and cash out to their local bank — without ever touching a wallet or understanding blockchain.

**Merchants:** Market traders, freelancers, and small businesses who want to display a QR code and receive payments that land in their bank account automatically.

**Groups (Circles):** Families splitting household expenses. Teams splitting work costs. Market associations doing group collections. Friend groups splitting travel or dining bills.

---

## 2. How It Works — Full Flow

### New User Onboarding

```
1. Download app / visit web app
2. Enter phone number or email
3. OTP verification → account created
4. Choose @username (unique, permanent)
5. Circle Programmable Wallet created automatically
6. Optional: Add profile photo, display name
7. Optional: Connect existing wallet (MetaMask, Coinbase Wallet)
8. Optional: Save bank details for offramp
```

### Sending a Payment

```
1. Tap "Send"
2. Search @username, phone number, or scan QR code
3. Enter amount in USDC (or local currency — auto-converts)
4. Add a note (optional)
5. Select source:
   a. PayCircle balance (already on Arc)
   b. Connected wallet on another chain → CCTP routes automatically
6. Confirm → payment settles on Arc in <500ms
7. Recipient notified via push + SMS
```

### Requesting a Payment

```
1. Tap "Request"
2. Enter @username or select from friends
3. Enter amount + note ("for dinner last night")
4. Send request → recipient gets notification
5. Recipient taps "Pay" → payment sent in one tap
6. Requester notified of payment
```

### QR Code Payments (Merchant Flow)

```
Merchant side:
1. Open app → tap "Receive"
2. Enter amount (optional — or leave open for customer to enter)
3. QR code generated with amount + wallet encoded
4. Display QR on phone or print it

Customer side:
1. Open PayCircle app → tap "Scan"
2. Point camera at merchant QR
3. Confirm amount → pay
4. Merchant sees payment confirmation instantly
```

### Circles (Group Payments)

```
1. Create a Circle (name it "Lagos Crew", "Office Team", etc.)
2. Invite members by @username or phone
3. Inside a Circle:
   - Send to everyone at once (split equally or custom amounts)
   - Create a bill split (e.g. "Dinner ₦45,000 — split 6 ways")
   - Members see who has paid and who hasn't
   - Request from the whole group at once
4. Circle has a shared activity feed
```

### Cashing Out to Bank

```
1. Tap "Cash Out"
2. Select amount
3. Select saved bank account (or add new one)
4. Confirm
5. Yellow Card / Circle Payouts processes transfer
6. Local currency arrives in bank account (1–3 business days)
7. Confirmation + tracking shown in app
```

---

## 3. System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│               Frontend (Next.js 14 — Mobile-first PWA)       │
│  Home Feed · Send · Request · QR · Circles · Cash Out        │
└────────────────────────┬─────────────────────────────────────┘
                         │ REST + Supabase Realtime
┌────────────────────────▼─────────────────────────────────────┐
│                   Backend (Next.js API Routes)                │
│  Payment Router · CCTP Handler · Offramp Controller          │
└──────┬──────────────────┬──────────────────┬─────────────────┘
       │                  │                  │
┌──────▼──────┐  ┌────────▼────────┐  ┌──────▼──────────────┐
│  Supabase   │  │  Circle Stack   │  │  Arc Contracts       │
│  Postgres   │  │  · Prog Wallets │  │  · PayCircle.sol     │
│  Realtime   │  │  · CCTP v2      │  │  · SplitEscrow.sol   │
│  Storage    │  │  · App Kits     │  │                      │
└─────────────┘  │  · CPN Payouts  │  └─────────────────────┘
                 └─────────────────┘
                         │
                 ┌───────▼────────┐
                 │  Yellow Card   │
                 │  (Africa offramp│
                 │  NGN/GHS/KES)  │
                 └────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), Tailwind CSS, shadcn/ui — mobile-first PWA |
| Backend | Next.js API Routes |
| Database | Supabase (Postgres + Realtime + Storage) |
| Blockchain | Arc L1 — EVM, USDC gas |
| Wallets | Circle Programmable Wallets (one per user) |
| Cross-chain | Circle CCTP v2 (any chain → Arc) |
| Africa offramp | Yellow Card API (NGN, GHS, KES, ZAR, 20 countries) |
| Global offramp | Circle Payouts API (USD ACH, EUR SEPA, GBP Faster Payments) |
| Notifications | Supabase Realtime + Expo Push (mobile) + Resend (email) + Twilio (SMS) |
| Auth | Supabase Auth (phone OTP + email OTP) |

---

## 4. Smart Contracts

### 4.1 PayCircle.sol

Handles on-Arc USDC transfers between Circle wallets. Most P2P payments go direct wallet-to-wallet via Circle APIs — this contract handles split payments, group collections, and fee collection.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PayCircle
 * @notice Handles group payments, split bills, and platform fee collection.
 *         Simple P2P transfers go direct wallet-to-wallet — this contract
 *         is for multi-party payment flows.
 */
contract PayCircle is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable USDC;
    address public feeTreasury;

    // Platform fees in basis points
    uint16 public constant SEND_FEE_BPS = 50;      // 0.5% on cross-chain sends
    uint16 public constant OFFRAMP_FEE_BPS = 100;  // 1.0% on offramp
    uint16 public constant GROUP_FEE_BPS = 25;     // 0.25% on group payments

    struct GroupPayment {
        address initiator;
        address[] recipients;
        uint256[] amounts;
        string note;
        bool executed;
        uint256 createdAt;
    }

    mapping(bytes32 => GroupPayment) public groupPayments;

    event PaymentSent(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 fee,
        string note,
        bytes32 indexed paymentId
    );

    event GroupPaymentCreated(bytes32 indexed groupPaymentId, address indexed initiator, uint256 total);
    event GroupPaymentExecuted(bytes32 indexed groupPaymentId);
    event FeesCollected(uint256 amount);

    error InvalidRecipients();
    error LengthMismatch();
    error AlreadyExecuted();
    error ZeroAmount();
    error NotInitiator();

    constructor(address _usdc, address _feeTreasury, address _owner) Ownable(_owner) {
        USDC = IERC20(_usdc);
        feeTreasury = _feeTreasury;
    }

    /**
     * @notice Send USDC to a single recipient with platform fee.
     * @dev Used for cross-chain payments arriving via CCTP.
     *      Direct on-Arc P2P goes wallet-to-wallet without this contract.
     */
    function send(
        address recipient,
        uint256 amount,
        string calldata note
    ) external nonReentrant returns (bytes32 paymentId) {
        if (amount == 0) revert ZeroAmount();
        if (recipient == address(0)) revert InvalidRecipients();

        uint256 fee = (amount * SEND_FEE_BPS) / 10_000;
        uint256 netAmount = amount - fee;

        USDC.safeTransferFrom(msg.sender, address(this), amount);
        USDC.safeTransfer(recipient, netAmount);
        if (fee > 0) USDC.safeTransfer(feeTreasury, fee);

        paymentId = keccak256(abi.encodePacked(msg.sender, recipient, amount, block.timestamp));

        emit PaymentSent(msg.sender, recipient, netAmount, fee, note, paymentId);
    }

    /**
     * @notice Split a bill across multiple recipients.
     * @dev Initiator deposits total, contract splits to all recipients.
     *
     * @example — Split ₦45,000 dinner across 6 friends
     * payCircle.splitPayment(
     *   [alice, bob, carol, dave, eve, frank],
     *   [7500e6, 7500e6, 7500e6, 7500e6, 7500e6, 7500e6], // 7.5 USDC each
     *   "Dinner at Nkoyo"
     * );
     */
    function splitPayment(
        address[] calldata recipients,
        uint256[] calldata amounts,
        string calldata note
    ) external nonReentrant returns (bytes32 groupPaymentId) {
        if (recipients.length == 0) revert InvalidRecipients();
        if (recipients.length != amounts.length) revert LengthMismatch();

        uint256 total = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            total += amounts[i];
        }

        uint256 fee = (total * GROUP_FEE_BPS) / 10_000;
        uint256 totalWithFee = total + fee;

        USDC.safeTransferFrom(msg.sender, address(this), totalWithFee);

        // Distribute to each recipient
        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] != address(0) && amounts[i] > 0) {
                USDC.safeTransfer(recipients[i], amounts[i]);
            }
        }

        if (fee > 0) USDC.safeTransfer(feeTreasury, fee);

        groupPaymentId = keccak256(abi.encodePacked(msg.sender, total, block.timestamp));

        emit GroupPaymentCreated(groupPaymentId, msg.sender, total);
        emit GroupPaymentExecuted(groupPaymentId);
    }

    /**
     * @notice Collect platform fee on offramp (called by backend before Yellow Card payout).
     */
    function collectOfframpFee(uint256 amount) external nonReentrant returns (uint256 fee, uint256 netAmount) {
        fee = (amount * OFFRAMP_FEE_BPS) / 10_000;
        netAmount = amount - fee;

        USDC.safeTransferFrom(msg.sender, feeTreasury, fee);
        emit FeesCollected(fee);
    }

    // Admin
    function setFeeTreasury(address _feeTreasury) external onlyOwner {
        feeTreasury = _feeTreasury;
    }
}
```

---

### 4.2 SplitEscrow.sol

Holds funds for bill splits where not everyone has paid yet. Releases to recipient when all parties have contributed.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SplitEscrow
 * @notice Escrow for group bill splits. Members contribute their share.
 *         Funds release to recipient (e.g. the person who paid the restaurant)
 *         when all members have paid, or after a deadline.
 */
contract SplitEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable USDC;

    enum SplitStatus { Open, Complete, Expired }

    struct Split {
        address creator;        // Who created the split (paid upfront)
        address recipient;      // Who receives the collected funds
        uint256 totalAmount;    // Total to collect
        uint256 collected;      // How much has been collected so far
        uint256 deadline;       // Timestamp — if not complete, creator can cancel
        SplitStatus status;
        mapping(address => uint256) owed;      // member → amount owed
        mapping(address => bool) paid;          // member → has paid
        address[] members;
        string description;
    }

    mapping(bytes32 => Split) public splits;

    event SplitCreated(bytes32 indexed splitId, address creator, uint256 total, string description);
    event MemberPaid(bytes32 indexed splitId, address member, uint256 amount);
    event SplitComplete(bytes32 indexed splitId, address recipient, uint256 amount);
    event SplitCancelled(bytes32 indexed splitId);

    error SplitNotFound();
    error AlreadyPaid();
    error SplitNotOpen();
    error NotMember();
    error DeadlineNotPassed();
    error NotCreator();

    constructor(address _usdc) {
        USDC = IERC20(_usdc);
    }

    /**
     * @notice Create a bill split.
     * @param members      List of wallet addresses who owe money
     * @param amounts      How much each member owes (parallel array)
     * @param recipient    Who gets the money when all have paid
     * @param description  Human-readable description ("Dinner at Nkoyo")
     * @param deadlineHours Hours until the split expires
     */
    function createSplit(
        address[] calldata members,
        uint256[] calldata amounts,
        address recipient,
        string calldata description,
        uint256 deadlineHours
    ) external returns (bytes32 splitId) {
        require(members.length == amounts.length, "Length mismatch");
        require(members.length > 0, "No members");

        splitId = keccak256(abi.encodePacked(msg.sender, block.timestamp, description));

        Split storage s = splits[splitId];
        s.creator = msg.sender;
        s.recipient = recipient;
        s.deadline = block.timestamp + (deadlineHours * 1 hours);
        s.status = SplitStatus.Open;
        s.description = description;
        s.members = members;

        for (uint256 i = 0; i < members.length; i++) {
            s.owed[members[i]] = amounts[i];
            s.totalAmount += amounts[i];
        }

        emit SplitCreated(splitId, msg.sender, s.totalAmount, description);
    }

    /**
     * @notice Member pays their share.
     */
    function pay(bytes32 splitId) external nonReentrant {
        Split storage s = splits[splitId];
        if (s.creator == address(0)) revert SplitNotFound();
        if (s.status != SplitStatus.Open) revert SplitNotOpen();
        if (s.paid[msg.sender]) revert AlreadyPaid();
        if (s.owed[msg.sender] == 0) revert NotMember();

        uint256 amount = s.owed[msg.sender];
        s.paid[msg.sender] = true;
        s.collected += amount;

        USDC.safeTransferFrom(msg.sender, address(this), amount);
        emit MemberPaid(splitId, msg.sender, amount);

        // Auto-release if fully collected
        if (s.collected >= s.totalAmount) {
            s.status = SplitStatus.Complete;
            USDC.safeTransfer(s.recipient, s.collected);
            emit SplitComplete(splitId, s.recipient, s.collected);
        }
    }

    /**
     * @notice Creator cancels and refunds all who paid (after deadline or manually).
     */
    function cancel(bytes32 splitId) external nonReentrant {
        Split storage s = splits[splitId];
        if (s.creator != msg.sender) revert NotCreator();
        if (s.status != SplitStatus.Open) revert SplitNotOpen();

        s.status = SplitStatus.Expired;

        // Refund members who already paid
        for (uint256 i = 0; i < s.members.length; i++) {
            address member = s.members[i];
            if (s.paid[member]) {
                USDC.safeTransfer(member, s.owed[member]);
            }
        }

        emit SplitCancelled(splitId);
    }

    // View helpers
    function getMemberOwed(bytes32 splitId, address member) external view returns (uint256) {
        return splits[splitId].owed[member];
    }

    function hasMemberPaid(bytes32 splitId, address member) external view returns (bool) {
        return splits[splitId].paid[member];
    }

    function getMembers(bytes32 splitId) external view returns (address[] memory) {
        return splits[splitId].members;
    }
}
```

---

## 5. Circle & CCTP Integration

### 5.1 User Wallet Creation

Every user gets a Circle Programmable Wallet on signup. No seed phrase. No MetaMask. Fully managed.

```typescript
// src/lib/circle/wallets.ts
import { initiateUserControlledWalletsClient } from "@circle-fin/user-controlled-wallets";

const circle = initiateUserControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
});

/**
 * Create a Circle wallet for a new PayCircle user.
 * Called on account creation — before username selection.
 */
export async function createUserWallet(userId: string): Promise<{
  walletId: string;
  walletAddress: string;
}> {
  // Register the user with Circle
  await circle.createUser({ userId });

  // Create Arc wallet
  const { data } = await circle.createUserWallet({
    userId,
    blockchains: ["ARC-TESTNET"],
  });

  const wallet = data.wallets[0];
  return {
    walletId: wallet.id,
    walletAddress: wallet.address,
  };
}

export async function getUSDCBalance(walletId: string): Promise<string> {
  const { data } = await circle.getWalletTokenBalance({
    id: walletId,
    tokenAddress: process.env.ARC_USDC_ADDRESS!,
  });
  return data.tokenBalances[0]?.amount ?? "0";
}
```

### 5.2 CCTP Cross-Chain Payment Handler

When a user pays from a chain other than Arc, CCTP burns the USDC on source chain and mints on Arc.

```typescript
// src/lib/cctp/crossChainPay.ts
import { ethers } from "ethers";

const CCTP_TOKEN_MESSENGER_ABI = [
  "function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken) returns (uint64 nonce)",
];

const CCTP_MESSAGE_TRANSMITTER_ABI = [
  "function receiveMessage(bytes message, bytes attestation) returns (bool)",
];

// Arc domain ID for CCTP
const ARC_DOMAIN = 7; // confirm with Circle docs

/**
 * Initiate a cross-chain payment from any supported chain to Arc.
 *
 * @param sourceProvider    Ethers provider for the source chain
 * @param sourceWallet      Signer on the source chain
 * @param recipientAddress  Arc wallet address of the recipient
 * @param amountUsdc        Amount in USDC (6 decimals)
 * @param sourceChain       Source chain name for logging
 */
export async function initiateXChainPayment({
  sourceProvider,
  sourceWallet,
  recipientAddress,
  amountUsdc,
  sourceChain,
}: {
  sourceProvider: ethers.Provider;
  sourceWallet: ethers.Signer;
  recipientAddress: string;
  amountUsdc: bigint;
  sourceChain: string;
}): Promise<{ txHash: string; nonce: bigint }> {
  const tokenMessengerAddress = getTokenMessengerAddress(sourceChain);
  const usdcAddress = getUSDCAddress(sourceChain);

  const usdc = new ethers.Contract(usdcAddress, [
    "function approve(address spender, uint256 amount) returns (bool)",
  ], sourceWallet);

  // Approve CCTP to spend USDC
  const approveTx = await usdc.approve(tokenMessengerAddress, amountUsdc);
  await approveTx.wait();

  // Convert recipient address to bytes32
  const mintRecipient = ethers.zeroPadValue(recipientAddress, 32);

  const tokenMessenger = new ethers.Contract(
    tokenMessengerAddress,
    CCTP_TOKEN_MESSENGER_ABI,
    sourceWallet
  );

  // Burn USDC on source chain — CCTP will mint on Arc
  const burnTx = await tokenMessenger.depositForBurn(
    amountUsdc,
    ARC_DOMAIN,
    mintRecipient,
    usdcAddress
  );

  const receipt = await burnTx.wait();
  const nonce = extractNonceFromReceipt(receipt);

  return { txHash: receipt.hash, nonce };
}

/**
 * Poll Circle's attestation service and relay the message to Arc.
 * Called by backend after initiateXChainPayment.
 */
export async function relayToArc(
  messageHash: string,
  arcProvider: ethers.Provider
): Promise<string> {
  // Poll for attestation (Circle signs the cross-chain message)
  const attestation = await pollForAttestation(messageHash);

  const transmitter = new ethers.Contract(
    process.env.ARC_MESSAGE_TRANSMITTER_ADDRESS!,
    CCTP_MESSAGE_TRANSMITTER_ABI,
    new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY!, arcProvider)
  );

  const tx = await transmitter.receiveMessage(attestation.message, attestation.attestation);
  const receipt = await tx.wait();
  return receipt.hash;
}

async function pollForAttestation(messageHash: string, maxAttempts = 30): Promise<{
  message: string;
  attestation: string;
}> {
  const url = `https://iris-api-sandbox.circle.com/attestations/${messageHash}`;
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === "complete") return data;
    await sleep(2000);
  }
  throw new Error("Attestation timeout");
}

// Chain-specific contract addresses
function getTokenMessengerAddress(chain: string): string {
  const addresses: Record<string, string> = {
    ethereum: "0xBd3fa81B58Ba92a82136038B25aDec7066af3155",
    base: "0x1682Ae6375C4E4A97e4B583BC394c861A46D8962",
    polygon: "0x9daF8c91AEFAE50b9c0E69629D3F6Ca40cA3B3FE",
    arbitrum: "0x19330d10D9Cc8751218eaf51E8885D058642E08A",
    solana: "CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3",
  };
  return addresses[chain];
}

function getUSDCAddress(chain: string): string {
  const addresses: Record<string, string> = {
    ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    polygon: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    arbitrum: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  };
  return addresses[chain];
}

function extractNonceFromReceipt(receipt: ethers.TransactionReceipt): bigint {
  // Parse MessageSent event from TokenMessenger
  const iface = new ethers.Interface([
    "event MessageSent(bytes message)",
  ]);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === "MessageSent") {
        const message = parsed.args[0];
        // Nonce is at bytes 12–20 of the message
        return BigInt("0x" + message.slice(26, 42));
      }
    } catch {}
  }
  throw new Error("Could not extract nonce from receipt");
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### 5.3 Circle App Kits — Unified Balance

Use Circle's Unified Balance SDK to show users their total USDC balance across all chains in one number.

```typescript
// src/lib/circle/unifiedBalance.ts

export async function getUnifiedBalance(userId: string): Promise<{
  arcBalance: string;
  totalAcrossChains: string;
  breakdown: { chain: string; balance: string }[];
}> {
  // Circle's Unified Balance SDK aggregates balances across chains
  // via CCTP and shows them as a single number
  const { data } = await circleAppKit.getUnifiedBalance({ userId });

  return {
    arcBalance: data.balances.find(b => b.chain === "ARC")?.amount ?? "0",
    totalAcrossChains: data.total,
    breakdown: data.balances.map(b => ({
      chain: b.chain,
      balance: b.amount,
    })),
  };
}
```

---

## 6. Yellow Card Offramp Integration

Yellow Card is Circle's CPN partner for Africa. Handles USDC → NGN/GHS/KES/ZAR bank transfers across 20 African countries.

```typescript
// src/lib/yellowcard/offramp.ts

const YELLOW_CARD_API = "https://api.yellowcard.io/v1";

export interface BankDetails {
  accountNumber: string;
  bankCode: string;        // Yellow Card bank code e.g. "firstbank" for First Bank Nigeria
  accountName: string;
  country: "NG" | "GH" | "KE" | "ZA" | "UG" | "TZ" | "RW" | "CM";
  currency: "NGN" | "GHS" | "KES" | "ZAR" | "UGX" | "TZS" | "RWF" | "XAF";
}

/**
 * Get exchange rate for USDC → local currency.
 * Called client-side when user opens Cash Out screen.
 */
export async function getExchangeRate(
  currency: string
): Promise<{ rate: number; fee: number }> {
  const res = await fetch(`${YELLOW_CARD_API}/rates?currency=${currency}`, {
    headers: { Authorization: `Bearer ${process.env.YELLOW_CARD_API_KEY}` },
  });
  const data = await res.json();
  return {
    rate: data.rate,
    fee: data.fee,
  };
}

/**
 * Initiate a USDC → local currency bank transfer.
 *
 * Flow:
 * 1. Platform receives USDC from user's Circle wallet
 * 2. Yellow Card API called with amount + bank details
 * 3. Yellow Card converts USDC → local currency
 * 4. Local currency wire sent to recipient's bank
 *
 * @param amountUsdc   Amount in USDC (before fees)
 * @param bankDetails  Recipient's bank account
 * @param userId       Internal user ID for tracking
 */
export async function initiateOfframp(
  amountUsdc: number,
  bankDetails: BankDetails,
  userId: string
): Promise<{ payoutId: string; expectedAmount: number; estimatedArrival: string }> {
  const res = await fetch(`${YELLOW_CARD_API}/payouts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.YELLOW_CARD_API_KEY}`,
    },
    body: JSON.stringify({
      amount: amountUsdc,
      currency: "USDC",
      destination: {
        accountNumber: bankDetails.accountNumber,
        bankCode: bankDetails.bankCode,
        accountName: bankDetails.accountName,
        country: bankDetails.country,
        currency: bankDetails.currency,
      },
      reference: userId,
    }),
  });

  const data = await res.json();
  return {
    payoutId: data.id,
    expectedAmount: data.destinationAmount,
    estimatedArrival: data.estimatedArrival,
  };
}

/**
 * Get payout status.
 */
export async function getPayoutStatus(payoutId: string): Promise<{
  status: "pending" | "processing" | "completed" | "failed";
  trackingRef?: string;
}> {
  const res = await fetch(`${YELLOW_CARD_API}/payouts/${payoutId}`, {
    headers: { Authorization: `Bearer ${process.env.YELLOW_CARD_API_KEY}` },
  });
  const data = await res.json();
  return { status: data.status, trackingRef: data.trackingReference };
}

// Supported African banks (Nigeria subset)
export const NIGERIAN_BANKS = [
  { code: "firstbank", name: "First Bank Nigeria" },
  { code: "gtbank", name: "Guaranty Trust Bank" },
  { code: "zenith", name: "Zenith Bank" },
  { code: "access", name: "Access Bank" },
  { code: "uba", name: "United Bank for Africa" },
  { code: "stanbic", name: "Stanbic IBTC Bank" },
  { code: "fidelity", name: "Fidelity Bank" },
  { code: "union", name: "Union Bank" },
  { code: "sterling", name: "Sterling Bank" },
  { code: "wema", name: "Wema Bank" },
  // ... full list
];
```

---

## 7. Core Features — Detailed Spec

### 7.1 @Username System

```typescript
// Validation rules
const USERNAME_RULES = {
  minLength: 3,
  maxLength: 20,
  pattern: /^[a-zA-Z0-9_]+$/,  // letters, numbers, underscore only
  reservedWords: ["paycircle", "admin", "support", "help", "official"],
};

// Username lookup — resolves to wallet address
// Stored in Supabase, indexed for fast lookup
// Users can search by @username, phone number, or display name
```

### 7.2 QR Code Spec

```typescript
// QR code encodes a payment URI
// Format: paycircle://pay?to=@username&amount=50&currency=USDC&note=for+coffee

// Static QR (for receiving any amount):
// paycircle://pay?to=@godbrand

// Dynamic QR (merchant sets amount):
// paycircle://pay?to=@buka_stall&amount=2500&currency=NGN&note=jollof+rice

// QR generation
import QRCode from "qrcode";

export async function generatePaymentQR(params: {
  username: string;
  amount?: number;
  currency?: string;
  note?: string;
}): Promise<string> {
  const uri = buildPaymentURI(params);
  return QRCode.toDataURL(uri, {
    width: 300,
    margin: 2,
    color: { dark: "#0F172A", light: "#FFFFFF" },
  });
}
```

### 7.3 Circles (Groups)

```
Circle Structure:
  - name: string
  - emoji: string (avatar)
  - members: User[]
  - admin: User (creator)
  - activity: Payment[] (shared feed)

Circle Actions:
  - Send to all (split equally)
  - Send to all (custom amounts per member)
  - Request from all
  - Create bill split (escrow)
  - View who has/hasn't paid
```

### 7.4 Activity Feed

```
Each user has a personal feed showing:
  - Payments sent (to @username — amount — note)
  - Payments received (from @username — amount — note)
  - Split requests (pending/paid status)
  - Offramp status updates
  - Circle activity

Feed items show:
  - Avatar / emoji
  - @username
  - Amount in USDC + local currency equivalent
  - Note
  - Timestamp (relative: "2 minutes ago")
  - Status chip (Completed / Pending / Failed)
```

### 7.5 Notifications

```
Push notification triggers:
  - Payment received ("@godbrand sent you $20.00 USDC")
  - Payment request received ("@alice is requesting $15.00 — for dinner")
  - Split bill created ("@office_crew created a split: $180.00 — Team lunch")
  - Offramp completed ("₦78,000 has been sent to your First Bank account")
  - Offramp failed ("Your cash out failed — tap to retry")
  - Circle activity ("@bob paid their share of Team lunch")
```

---

## 8. Frontend Pages & UI

### Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/signup` | Phone/email signup + OTP |
| `/onboard` | Username selection + profile setup |
| `/home` | Activity feed + balance |
| `/send` | Send payment flow |
| `/request` | Request payment flow |
| `/scan` | QR scanner |
| `/receive` | Generate QR to receive |
| `/circles` | List of circles |
| `/circles/[id]` | Circle detail + activity |
| `/circles/create` | Create new circle |
| `/cashout` | Offramp to bank |
| `/profile/[username]` | User profile + send button |
| `/settings` | Account, bank accounts, notifications |
| `/history` | Full transaction history |

---

### Home Screen

```
┌─────────────────────────────────────┐
│  PayCircle          🔔    👤        │
├─────────────────────────────────────┤
│                                     │
│         Your Balance                │
│         $284.50 USDC                │
│         ≈ ₦443,820 NGN              │
│                                     │
│  [Send]  [Request]  [Scan]  [More]  │
│                                     │
├─────────────────────────────────────┤
│  Activity                           │
│                                     │
│  👤 @alice sent you $20.00          │
│     "for dinner last week" · 2m ago │
│                                     │
│  👤 You sent @bob $15.00            │
│     "coffee" · 1h ago               │
│                                     │
│  🔵 Cash out ₦78,000 completed      │
│     First Bank · 3h ago             │
│                                     │
│  👥 @office_crew: Team lunch split  │
│     $180 · 3 of 6 paid · 1d ago    │
│                                     │
└─────────────────────────────────────┘
```

---

### Send Flow

```
Step 1 — Who?
┌─────────────────────────────────────┐
│  ← Send                             │
│                                     │
│  [ 🔍 Search @username or phone ]   │
│                                     │
│  Recent                             │
│  👤 @alice · Alice Chen             │
│  👤 @bob · Bob Mensah               │
│  👤 @carol · Carol Okafor           │
│                                     │
│  [ 📷 Scan QR Code ]                │
└─────────────────────────────────────┘

Step 2 — How much?
┌─────────────────────────────────────┐
│  ← Send to @alice                   │
│                                     │
│         $ 0.00                      │
│         [  USDC  ▼ ]                │
│                                     │
│  Quick: [$5] [$10] [$20] [$50]      │
│                                     │
│  Note (optional)                    │
│  [ for coffee ______________ ]      │
│                                     │
│  Pay from                           │
│  ○ PayCircle balance ($284.50)      │
│  ○ Ethereum wallet (0xabc...def)    │
│  ○ Base wallet                      │
│                                     │
└─────────────────────────────────────┘

Step 3 — Confirm
┌─────────────────────────────────────┐
│  ← Confirm Payment                  │
│                                     │
│  To:      @alice                    │
│  Amount:  $20.00 USDC               │
│  Fee:     $0.00 (P2P on Arc)        │
│  Note:    "for coffee"              │
│  From:    PayCircle balance         │
│                                     │
│  Settles on Arc in <500ms           │
│                                     │
│  [      Confirm & Send      ]       │
└─────────────────────────────────────┘
```

---

### Cash Out Screen

```
┌─────────────────────────────────────┐
│  ← Cash Out                         │
│                                     │
│  Available: $284.50 USDC            │
│                                     │
│  Amount                             │
│  [ $50.00 USDC                  ]   │
│                                     │
│  You'll receive                     │
│  ≈ ₦78,000 NGN                      │
│  Rate: 1 USDC = ₦1,560             │
│  Fee: $0.50 USDC (1%)              │
│  Arrival: 1–2 business days         │
│                                     │
│  Send to                            │
│  ● First Bank — **** 4521 (saved)   │
│  ○ Add new bank account             │
│                                     │
│  [      Cash Out ₦78,000      ]     │
└─────────────────────────────────────┘
```

---

### Circle View

```
┌─────────────────────────────────────┐
│  ← Lagos Crew 🌴           [+ Send] │
│     6 members                       │
├─────────────────────────────────────┤
│  Active Split                       │
│  🍽️ Dinner at Nkoyo                │
│  $120.00 total · 4 of 6 paid       │
│  ████████░░  66%                    │
│  Still owed: @dave $20 · @eve $20  │
│  [Remind All]                       │
├─────────────────────────────────────┤
│  Activity                           │
│                                     │
│  @carol paid $20.00 · 5m ago        │
│  @bob paid $20.00 · 12m ago         │
│  @godbrand created split · 1h ago   │
│  @alice paid $20.00 · 2h ago        │
│  @frank paid $20.00 · 2h ago        │
│                                     │
└─────────────────────────────────────┘
```

---

### Design System

- **Theme:** Dark mode — trust, money, seriousness without corporate stiffness
- **Primary:** `#6366F1` (indigo — community, connection)
- **Accent:** `#22D3EE` (cyan — USDC, on-chain activity, live updates)
- **Success:** `#10B981` (green — completed payments)
- **Background:** `#0A0A0F`
- **Surface:** `#13131A`
- **Border:** `#1E1E2E`
- **Text primary:** `#F8FAFC`
- **Text secondary:** `#94A3B8`
- **Font display:** `Plus Jakarta Sans` (warm, rounded, modern — not corporate)
- **Font mono:** `JetBrains Mono` (amounts only)
- **Corner radius:** `16px` on cards, `999px` on buttons
- **Signature element:** Live payment confirmations — when a payment lands, a full-screen ripple animation pulses from the avatar outward in the accent cyan, then fades. Arc's sub-500ms speed makes this feel instant and magical.

---

## 9. Backend & API Routes

```
POST /api/auth/send-otp
  body: { phone? email? }
  → Supabase auth OTP

POST /api/auth/verify-otp
  body: { phone?, email?, otp }
  → Verifies OTP, creates user + Circle wallet

POST /api/users/create
  body: { userId, username, displayName }
  → Creates user record, reserves @username

GET  /api/users/search?q=alice
  → Search by @username or phone

GET  /api/users/[username]
  → User profile + public stats

POST /api/payments/send
  body: { fromUserId, toUsername, amountUsdc, note, sourceChain? }
  → If on Arc: direct Circle wallet transfer
  → If cross-chain: initiate CCTP flow + relay

POST /api/payments/request
  body: { fromUserId, toUsername, amountUsdc, note }
  → Creates payment request record, sends notification

POST /api/payments/[requestId]/pay
  body: { userId }
  → Executes payment on the request

POST /api/splits/create
  body: { creatorId, members, amounts, description, deadlineHours }
  → Deploys SplitEscrow on-chain, creates Supabase record

POST /api/splits/[splitId]/pay
  body: { userId }
  → Member pays their share on-chain

GET  /api/splits/[splitId]
  → Split status + member payment status

POST /api/circles/create
  body: { creatorId, name, emoji, memberUsernames[] }
  → Creates circle + sends invites

GET  /api/circles/[id]
  → Circle detail with activity feed

POST /api/circles/[id]/send
  body: { fromUserId, totalAmount, splits: {username, amount}[] }
  → Sends to all circle members

GET  /api/activity?userId=xxx&page=1
  → Paginated activity feed

POST /api/cashout/initiate
  body: { userId, amountUsdc, bankDetails }
  → Collects fee on-chain, calls Yellow Card API

GET  /api/cashout/[payoutId]/status
  → Polls Yellow Card for payout status

GET  /api/balance?userId=xxx
  → Circle wallet balance on Arc

POST /api/qr/generate
  body: { username, amount?, note? }
  → Returns QR code data URL

POST /api/cctp/relay
  body: { messageHash, sourceChain }
  → Backend relays CCTP attestation to Arc (internal)
```

---

## 10. Database Schema

```sql
-- Users
create table users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  display_name text,
  phone text unique,
  email text unique,
  avatar_url text,
  circle_wallet_id text unique,
  wallet_address text unique,
  bio text,
  total_sent numeric(20,6) default 0,
  total_received numeric(20,6) default 0,
  created_at timestamptz default now()
);

-- Friends (bidirectional friendship)
create table friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  friend_id uuid references users(id) not null,
  created_at timestamptz default now(),
  unique(user_id, friend_id)
);

-- Circles (groups)
create table circles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text default '👥',
  creator_id uuid references users(id) not null,
  created_at timestamptz default now()
);

-- Circle members
create table circle_members (
  circle_id uuid references circles(id) not null,
  user_id uuid references users(id) not null,
  joined_at timestamptz default now(),
  primary key (circle_id, user_id)
);

-- Payments (all P2P transfers)
create table payments (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid references users(id) not null,
  to_user_id uuid references users(id) not null,
  amount_usdc numeric(20,6) not null,
  fee_usdc numeric(20,6) default 0,
  note text,
  source_chain text default 'ARC',     -- ARC, ETHEREUM, BASE, POLYGON, etc.
  tx_hash text,                         -- Arc transaction hash
  cctp_nonce bigint,                    -- CCTP nonce for cross-chain
  status text default 'completed'
    check (status in ('pending','completed','failed')),
  circle_id uuid references circles(id), -- null for P2P
  created_at timestamptz default now()
);

-- Payment requests
create table payment_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid references users(id) not null,  -- who is requesting
  to_user_id uuid references users(id) not null,    -- who should pay
  amount_usdc numeric(20,6) not null,
  note text,
  status text default 'pending'
    check (status in ('pending','paid','cancelled','expired')),
  payment_id uuid references payments(id),           -- set when paid
  expires_at timestamptz default (now() + interval '7 days'),
  created_at timestamptz default now()
);

-- Bill splits
create table splits (
  id uuid primary key default gen_random_uuid(),
  contract_split_id text,               -- on-chain bytes32 splitId
  creator_id uuid references users(id) not null,
  circle_id uuid references circles(id),
  total_amount_usdc numeric(20,6) not null,
  collected_usdc numeric(20,6) default 0,
  description text not null,
  status text default 'open'
    check (status in ('open','complete','cancelled')),
  deadline timestamptz,
  created_at timestamptz default now()
);

-- Split members
create table split_members (
  split_id uuid references splits(id) not null,
  user_id uuid references users(id) not null,
  amount_owed_usdc numeric(20,6) not null,
  paid boolean default false,
  payment_id uuid references payments(id),
  paid_at timestamptz,
  primary key (split_id, user_id)
);

-- Bank accounts (saved for offramp)
create table bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  bank_name text not null,
  bank_code text not null,
  account_number_encrypted text not null,
  account_name text not null,
  country text not null,
  currency text not null,
  is_default boolean default false,
  created_at timestamptz default now()
);

-- Offramp payouts
create table offramp_payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  amount_usdc numeric(20,6) not null,
  fee_usdc numeric(20,6) not null,
  net_usdc numeric(20,6) not null,
  target_currency text not null,
  expected_amount numeric(20,2),
  bank_account_id uuid references bank_accounts(id),
  yellow_card_payout_id text,
  status text default 'pending'
    check (status in ('pending','processing','completed','failed')),
  tracking_ref text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- Activity feed (denormalized for fast queries)
create table activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,      -- whose feed this appears in
  type text not null
    check (type in ('payment_sent','payment_received','request_received',
                    'request_paid','split_created','split_paid','split_complete',
                    'offramp_completed','offramp_failed','circle_joined')),
  reference_id uuid,                                -- payment_id / split_id / etc.
  actor_id uuid references users(id),              -- who did the action
  amount_usdc numeric(20,6),
  note text,
  read boolean default false,
  created_at timestamptz default now()
);

-- Indexes
create index on users(username);
create index on users(phone);
create index on payments(from_user_id);
create index on payments(to_user_id);
create index on payments(created_at desc);
create index on payment_requests(to_user_id, status);
create index on splits(creator_id);
create index on activity(user_id, created_at desc);
create index on activity(user_id, read);
create index on friendships(user_id);

-- Realtime
alter publication supabase_realtime add table activity;
alter publication supabase_realtime add table payments;
alter publication supabase_realtime add table payment_requests;
alter publication supabase_realtime add table split_members;
alter publication supabase_realtime add table offramp_payouts;
```

---

## 11. Revenue Model

| Action | Fee | When Charged |
|--------|-----|-------------|
| P2P on-Arc payment | **Free** | Never — drives adoption |
| Cross-chain payment (CCTP) | **0.5%** | On settlement to Arc |
| Group / split payment | **0.25%** | On contract execution |
| Offramp to bank | **1.0%** | On Yellow Card payout initiation |
| QR merchant payment | **0.5%** | On settlement |

### Revenue Projection (Conservative)

```
100 active users
Average: $500/month transacted per user
Total volume: $50,000/month

Cross-chain (30%): $15,000 × 0.5% = $75
Group payments (20%): $10,000 × 0.25% = $25
Offramp (50%): $25,000 × 1.0% = $250

Monthly revenue: ~$350
Annual run rate: ~$4,200

At 10,000 users: ~$35,000/month
```

---

## 12. Build Order

### Phase 1: Foundation (Day 1–2)
- [ ] Next.js 14 scaffold — mobile-first PWA config
- [ ] Supabase project + run schema migration
- [ ] Arc testnet connection + Hardhat config
- [ ] Deploy PayCircle.sol to Arc testnet
- [ ] Deploy SplitEscrow.sol to Arc testnet
- [ ] Circle API setup + test wallet creation
- [ ] Supabase Auth — phone OTP working

### Phase 2: Core Identity (Day 3)
- [ ] Signup flow — phone OTP → account created
- [ ] Username selection screen (availability check)
- [ ] Circle wallet provisioned on signup
- [ ] User profile page (`/profile/[username]`)
- [ ] Friend search by @username or phone
- [ ] Add friend flow

### Phase 3: Send & Receive on Arc (Day 4–5)
- [ ] Home screen with balance (Circle wallet USDC)
- [ ] Send flow — search → amount → confirm → execute
- [ ] Direct Circle wallet-to-wallet transfer on Arc
- [ ] Activity feed — payments sent/received
- [ ] Supabase Realtime — live activity updates
- [ ] Push notifications (Expo) for payment received

### Phase 4: Cross-Chain Payments via CCTP (Day 6–7)
- [ ] Wallet connect (MetaMask/Coinbase Wallet) in send flow
- [ ] CCTP initiation from Ethereum/Base/Polygon
- [ ] Backend relay service — polls attestation + relays to Arc
- [ ] Cross-chain payment recorded in Supabase
- [ ] Cross-chain status shown in activity feed

### Phase 5: QR Code System (Day 8)
- [ ] `/receive` — generate QR for your @username
- [ ] Dynamic QR with amount + note pre-filled
- [ ] `/scan` — camera QR scanner
- [ ] QR scanned → auto-populates send flow
- [ ] Merchant mode — generate printable QR

### Phase 6: Payment Requests (Day 9)
- [ ] Request flow — search → amount → note → send
- [ ] Notification to requestee
- [ ] Requestee sees pending requests on home
- [ ] One-tap "Pay" on a request
- [ ] Request expires after 7 days

### Phase 7: Circles & Bill Splits (Day 10–11)
- [ ] Create circle — name, emoji, invite members
- [ ] Circle home — members list + activity
- [ ] Send to all members (equal split)
- [ ] Bill split — SplitEscrow contract deployed per split
- [ ] Members pay their share on-chain
- [ ] Auto-complete when all paid
- [ ] Remind unpaid members

### Phase 8: Offramp (Day 12)
- [ ] Bank account form (Nigeria focus first)
- [ ] Yellow Card API integration
- [ ] Exchange rate display (live)
- [ ] Cash out flow — amount → bank → confirm
- [ ] Fee collection on-chain (PayCircle.collectOfframpFee)
- [ ] Payout status polling + notification on complete

### Phase 9: Polish + Demo Prep (Day 13–14)
- [ ] Seed: 6 demo users, 3 circles, 20+ transactions
- [ ] Landing page (`/`) with product pitch
- [ ] Deploy to Vercel
- [ ] PWA install prompt on mobile
- [ ] Record 3-minute demo video
- [ ] Deck: problem → solution → Arc advantage → demo → traction
- [ ] Submit by August 9

---

## 13. Environment Variables

```bash
# .env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Arc
ARC_RPC_URL=
ARC_CHAIN_ID=
ARC_USDC_ADDRESS=
DEPLOYER_PRIVATE_KEY=
RELAYER_PRIVATE_KEY=                    # Relays CCTP attestations to Arc
NEXT_PUBLIC_PAYCIRCLE_CONTRACT=
NEXT_PUBLIC_SPLIT_ESCROW_CONTRACT=

# Circle
CIRCLE_API_KEY=
CIRCLE_ENTITY_SECRET=

# CCTP
CCTP_ATTESTATION_API=https://iris-api-sandbox.circle.com
ARC_MESSAGE_TRANSMITTER_ADDRESS=

# Yellow Card
YELLOW_CARD_API_KEY=
YELLOW_CARD_SANDBOX=true               # Switch to false for mainnet

# Notifications
NEXT_PUBLIC_EXPO_PROJECT_ID=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
RESEND_API_KEY=

# Encryption (bank account numbers)
ENCRYPTION_KEY=                         # 32-byte hex key

# App
NEXT_PUBLIC_APP_URL=
PLATFORM_FEE_WALLET=                   # Arc address receives platform fees
```

---

## 14. File Structure

```
paycircle/
├── contracts/
│   ├── src/
│   │   ├── PayCircle.sol
│   │   └── SplitEscrow.sol
│   ├── test/
│   │   ├── PayCircle.t.sol
│   │   └── SplitEscrow.t.sol
│   ├── script/
│   │   └── Deploy.s.sol
│   └── foundry.toml
│
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Landing
│   │   ├── signup/page.tsx
│   │   ├── onboard/page.tsx            # Username setup
│   │   ├── home/page.tsx               # Feed + balance
│   │   ├── send/page.tsx
│   │   ├── request/page.tsx
│   │   ├── scan/page.tsx
│   │   ├── receive/page.tsx            # QR generator
│   │   ├── circles/
│   │   │   ├── page.tsx
│   │   │   ├── create/page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── cashout/page.tsx
│   │   ├── profile/
│   │   │   └── [username]/page.tsx
│   │   ├── history/page.tsx
│   │   ├── settings/page.tsx
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── send-otp/route.ts
│   │       │   └── verify-otp/route.ts
│   │       ├── users/
│   │       │   ├── create/route.ts
│   │       │   ├── search/route.ts
│   │       │   └── [username]/route.ts
│   │       ├── payments/
│   │       │   ├── send/route.ts
│   │       │   ├── request/route.ts
│   │       │   └── [requestId]/pay/route.ts
│   │       ├── splits/
│   │       │   ├── create/route.ts
│   │       │   └── [splitId]/pay/route.ts
│   │       ├── circles/
│   │       │   ├── create/route.ts
│   │       │   ├── [id]/route.ts
│   │       │   └── [id]/send/route.ts
│   │       ├── cashout/
│   │       │   ├── initiate/route.ts
│   │       │   └── [payoutId]/status/route.ts
│   │       ├── balance/route.ts
│   │       ├── activity/route.ts
│   │       ├── qr/generate/route.ts
│   │       └── cctp/relay/route.ts     # Internal — relays CCTP to Arc
│   │
│   ├── lib/
│   │   ├── circle/
│   │   │   ├── wallets.ts
│   │   │   └── unifiedBalance.ts
│   │   ├── cctp/
│   │   │   └── crossChainPay.ts
│   │   ├── yellowcard/
│   │   │   └── offramp.ts
│   │   ├── contracts/
│   │   │   ├── paycircle.ts
│   │   │   ├── splitEscrow.ts
│   │   │   └── abis/
│   │   ├── notifications/
│   │   │   ├── push.ts
│   │   │   ├── sms.ts
│   │   │   └── email.ts
│   │   ├── qr.ts
│   │   ├── crypto.ts                   # Bank account encryption
│   │   └── supabase.ts
│   │
│   └── components/
│       ├── home/
│       │   ├── BalanceCard.tsx
│       │   ├── QuickActions.tsx
│       │   └── ActivityFeed.tsx
│       ├── send/
│       │   ├── UserSearch.tsx
│       │   ├── AmountInput.tsx
│       │   ├── SourceSelector.tsx      # Arc balance vs external wallet
│       │   └── ConfirmPayment.tsx
│       ├── circles/
│       │   ├── CircleCard.tsx
│       │   ├── MemberList.tsx
│       │   └── SplitProgress.tsx
│       ├── cashout/
│       │   ├── ExchangeRate.tsx
│       │   ├── BankForm.tsx
│       │   └── PayoutStatus.tsx
│       ├── qr/
│       │   ├── QRGenerator.tsx
│       │   └── QRScanner.tsx
│       └── ui/                         # shadcn components
│
├── public/
│   ├── manifest.json                   # PWA manifest
│   └── icons/
│
├── package.json
├── hardhat.config.ts
├── next.config.js                      # PWA config
└── .env.local
```

---

## 15. Submission Checklist

- [ ] Public GitHub repo with clean README
- [ ] Contracts deployed and verified on Arc testnet
- [ ] Live Vercel deployment (PWA installable on mobile)
- [ ] 6 demo accounts set up with transaction history
- [ ] At least $200 USDC transacted on Arc testnet
- [ ] At least 1 successful CCTP cross-chain payment (Ethereum → Arc)
- [ ] At least 1 successful Yellow Card offramp initiated
- [ ] At least 2 circles with active splits
- [ ] 3-minute Loom demo covering: signup → send → circle split → QR payment → cash out to bank
- [ ] Deck: problem (crypto payments are fragmented) → solution (PayCircle) → Arc advantage (CCTP + sub-500ms + USDC gas) → live demo → revenue model
- [ ] Checkpoint 1 submitted by July 19 ← **This Sunday**
- [ ] Checkpoint 2 submitted by July 26
- [ ] Final submitted by August 9

---

*PayCircle · Send to anyone · From any chain · Cash out anywhere · Built on Arc*
