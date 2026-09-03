# Coven

**Social USDC payments on Arc.** Send to an @username, split bills in a group, save toward a shared goal — and cash out to a local bank account. Payments settle on Arc in USDC, where USDC is also the gas token.

```
Sender pays 50 USDC  →  settles on Arc (<500ms)  →  recipient's Circle wallet
                                                          ↓
                                              "Cash Out" → Yellow Card
                                                          ↓
                                              ₦78,000 in a Nigerian bank account
```

---

## What Coven is

Coven is a payments app, not a wallet. Users sign up with an email or phone number, claim a permanent `@username`, and start sending USDC to friends and merchants without ever seeing a seed phrase or a 42-character address. Behind the scenes, every account is backed by a Circle Programmable Wallet — non-custodial, user-controlled, and secured with a PIN the backend never has access to.

Money moves on **Arc**, a purpose-built payments chain where USDC is also the native gas asset. That removes the usual onboarding wall in crypto payments: a new recipient doesn't need a separate token to pay fees before they can move the money they were just sent.

Coven is built for real transfers between real people — splitting rent with roommates, paying a market vendor by QR code, sending money home, or collecting from a group for a shared goal — and for turning that USDC into local currency in a bank account, today across Nigeria, Ghana, Kenya, and South Africa.

---

## Why Arc

- **USDC is the gas token.** Recipients pay fees out of the money they just received — there's no second asset to fund before a new user can move funds.
- **Deterministic finality on inclusion.** One confirmation is final, so the backend treats `tx.wait()` as settled instead of polling for N confirmations.
- **~$0.01 transactions** under EIP-1559 with EWMA smoothing, which keeps per-payment cost stable enough to show users a real fee number.

---

## Features

| | |
|---|---|
| **@usernames** | Claim a permanent handle; pay anyone by `@name` instead of a 42-character address |
| **Non-custodial wallets** | Circle Programmable Wallets, user-controlled — every transfer needs the user's PIN, and the backend can never move funds on its own |
| **Send / request** | One-tap payments and requests, with decline support |
| **QR payments** | Merchants display a QR encoding amount + address; customers scan and confirm |
| **Circles** | Groups with a shared activity feed, group sends, and bill splits |
| **Goal pools** | Group savings on-chain — any member contributes any amount, and releasing the pot needs *every* member's approval |
| **Cash out** | USDC → NGN / GHS / KES / ZAR into a local bank account via Yellow Card |

---

## How a payment actually works

1. **Send.** The sender picks a recipient by `@username`, enters an amount, and confirms with their wallet PIN.
2. **Sign.** The client runs a Circle PIN challenge and signs the transfer — the backend is never handed the PIN and can't initiate a transfer on the user's behalf.
3. **Settle.** The transaction lands on Arc. Finality is on inclusion, so there's no waiting on confirmations before the app treats it as done.
4. **Verify.** The server doesn't trust the client's word that a payment happened. It independently fetches the transaction from Circle and checks the wallet, destination, and amount match before writing a single row to the database. A client cannot fabricate a transaction id and have it recorded as paid.
5. **Notify.** Both sides see the update in real time over Supabase Realtime — activity feed, balances, and notifications update without a refresh.
6. **Cash out (optional).** The recipient can convert their USDC to local currency and send it straight to a bank account through Yellow Card, in Nigeria, Ghana, Kenya, or South Africa.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│           Next.js 16 · App Router · mobile-first PWA         │
│   Home · Send · Request · QR · Circles · Goals · Cash Out    │
└────────────────────────┬─────────────────────────────────────┘
                         │  REST + Supabase Realtime
┌────────────────────────▼─────────────────────────────────────┐
│                  Next.js API routes (server)                 │
│   PIN challenges · transfer verification · CCTP relay        │
└──────┬──────────────────┬──────────────────┬─────────────────┘
       │                  │                  │
┌──────▼──────┐  ┌────────▼────────┐  ┌──────▼───────────────┐
│  Supabase   │  │  Circle         │  │  Arc L1              │
│  Postgres   │  │  · Prog Wallets │  │  · PayCircle.sol     │
│  Realtime   │  │  · CCTP v2      │  │  · SplitEscrow.sol   │
│  Storage    │  └─────────────────┘  │  · GoalPool.sol      │
└─────────────┘           │           └──────────────────────┘
                  ┌───────▼────────┐
                  │  Yellow Card   │  NGN · GHS · KES · ZAR
                  └────────────────┘
```

**Payments are never recorded on trust.** The client runs a Circle PIN challenge, then the server independently fetches that transaction from Circle and checks wallet, destination and amount before a single row is written. A client cannot fabricate a transaction id and have it accepted as paid.

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind v4 |
| Backend | Next.js API routes |
| Database | Supabase — Postgres, Realtime, Storage, RLS |
| Chain | Arc L1 (chain id `5042002`), USDC as gas |
| Wallets | Circle Programmable Wallets (user-controlled, SCA) |
| Cross-chain | Circle CCTP v2 via `@cctp-sdk/core` — Arc is domain 26 |
| Offramp | Yellow Card |
| Auth | Supabase Auth (Google OAuth) |
| Contracts | Solidity 0.8.24, Foundry, OpenZeppelin |

---

## The smart contracts

Three contracts, each handling a specific piece of the money-movement logic on-chain rather than trusting the app's database alone:

- **`PayCircle`** — fee-bearing sends and one-transaction group payouts. This is the core transfer path for direct sends and Circle-wide disbursements.
- **`SplitEscrow`** — holds each member's share of a bill in escrow. Releases to the recipient automatically once the full amount is collected, and refunds every contributor if the split is cancelled or expires unpaid.
- **`GoalPool`** — group savings with variable contributions toward a shared target. Withdrawing the pooled funds requires unanimous approval from every member, so no single person — including whoever created the pool — can drain it alone.

### Deployed contracts — Arc Testnet

| Contract | Address |
|---|---|
| PayCircle | [`0x5f4c5E9DA66935732e464F447d15E37E33E2daA4`](https://explorer.testnet.arc.io/address/0x5f4c5E9DA66935732e464F447d15E37E33E2daA4) |
| SplitEscrow | [`0x2AD815252A08Ca9E3081fBb40f47f1bF0117d6c7`](https://explorer.testnet.arc.io/address/0x2AD815252A08Ca9E3081fBb40f47f1bF0117d6c7) |
| GoalPool | [`0x49D4F073a25172209333aEB5BFFB42E58a57e9f5`](https://explorer.testnet.arc.io/address/0x49D4F073a25172209333aEB5BFFB42E58a57e9f5) |
| USDC (ERC-20, 6dp) | `0x3600000000000000000000000000000000000000` |

> **Arc's dual-decimals trap:** native USDC is 18 decimals (gas, `msg.value`), the ERC-20 interface is 6 decimals (`transfer`, `balanceOf`). All contract and app math is 6-decimal ERC-20. See [`docs/ARC_TESTNET.md`](docs/ARC_TESTNET.md).

---

## Getting started

**Requires** Node 20+, pnpm, a Supabase project, a Circle developer account, and [Foundry](https://book.getfoundry.sh) if you're touching contracts.

```bash
git clone https://github.com/MarvyNwaokobia/Coven.git
cd Coven/frontend
pnpm install
cp .env.example .env.local     # then fill it in — see below
pnpm dev                       # http://localhost:3000
```

**Database.** In the Supabase SQL editor, run `supabase/schema.sql`, then each file in `supabase/migrations/` in numeric order.

**Auth.** Enable the Google provider in Supabase → Authentication → Providers. Add `https://<project>.supabase.co/auth/v1/callback` as an authorized redirect URI in Google Cloud, and `${NEXT_PUBLIC_APP_URL}/auth/callback` to Supabase's Redirect URLs allowlist.

**Environment.** Every key in `.env.example` is read by the app; the file documents where each value comes from. The ones without public defaults:

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API |
| `CIRCLE_API_KEY`, `NEXT_PUBLIC_CIRCLE_APP_ID` | Circle Console → Wallets → User Controlled |
| `RELAYER_PRIVATE_KEY` | Any funded Arc key — relays CCTP mints. Fund at [faucet.circle.com](https://faucet.circle.com) |
| `ENCRYPTION_KEY` | `openssl rand -hex 32` — AES-256-GCM key for bank account numbers at rest |
| `YELLOW_CARD_API_KEY` | Yellow Card partner API |

Never commit `.env.local` — `.env*` is gitignored.

### Contracts

```bash
cd contract
forge install && forge test

# Deploy. --legacy is required: forge doesn't know chain 5042002 for EIP-1559 yet.
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $ARC_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY --broadcast --legacy
```

---

## Repo layout

```
contract/               Foundry workspace
  src/                  PayCircle · SplitEscrow · GoalPool
  test/                 Forge test suites
  script/               Deploy scripts
frontend/
  app/                  Pages + API routes (App Router)
  components/           Shared UI
  lib/
    circle/             Programmable Wallets, PIN challenges, transfer verification
    cctp/               CCTP v2 burn + Arc relay
    yellowcard/         Offramp client
    contracts/          ethers clients + ABIs for the Arc contracts
    server/             Activity, notifications, inbound sync
  supabase/             schema.sql + migrations
docs/
  SPEC.md               Full product + technical spec
  ARC_TESTNET.md        Arc network reference: addresses, gas, EVM differences
```

---

## Security model

- **Non-custodial by design.** Wallets are user-controlled Circle Programmable Wallets. The backend stores no private keys and cannot move a user's funds without that user completing a PIN challenge on their own device.
- **Server-verified settlement.** No payment is recorded as complete because the client said so. The server re-fetches the transaction from Circle and checks the wallet, destination, and amount before writing it to the database.
- **Unanimous approval on shared funds.** `GoalPool` withdrawals require every contributing member to sign off — a majority, or the pool's creator, cannot unilaterally withdraw the group's money.
- **Encrypted bank details.** Linked bank account numbers used for cash-out are encrypted at rest with AES-256-GCM before they touch the database.
- **Row-level security.** Supabase RLS policies scope every read and write to the authenticated user, so one account cannot query another user's private data through the API.

---

## Roadmap

- Cross-chain send UI — the CCTP relay and attestation path are built and the relayer is funded on Arc; the source-chain wallet connector is the remaining piece.
- On-chain settlement for cash-out fees via `PayCircle.collectOfframpFee`.
- Push and SMS notifications alongside the existing in-app feed.
- Expanding cash-out coverage beyond Nigeria, Ghana, Kenya, and South Africa.

---

## Docs

- [Product & technical spec](docs/SPEC.md)
- [Arc testnet reference](docs/ARC_TESTNET.md)

---

*Coven — send to anyone, cash out anywhere. Built on Arc.*
