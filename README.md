# Coven

**Social USDC payments on Arc.** Send to an @username, split bills in a group, save toward a shared goal — and cash out to a local bank account. Payments settle on Arc in USDC, where USDC is also the gas token.

Built for the **Arc Build Hackathon** (Circle × Arc) · DeFi / Payments Infrastructure track.

```
Sender pays 50 USDC  →  settles on Arc (<500ms)  →  recipient's Circle wallet
                                                          ↓
                                              "Cash Out" → Yellow Card
                                                          ↓
                                              ₦78,000 in a Nigerian bank account
```

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

## Deployed contracts — Arc Testnet

| Contract | Address |
|---|---|
| PayCircle | [`0x5f4c5E9DA66935732e464F447d15E37E33E2daA4`](https://testnet.arcscan.app/address/0x5f4c5E9DA66935732e464F447d15E37E33E2daA4) |
| SplitEscrow | [`0x72AC36A822746a51b0Ff03Df15df19B3E4B5536E`](https://testnet.arcscan.app/address/0x72AC36A822746a51b0Ff03Df15df19B3E4B5536E) |
| GoalPool | [`0xB496516bAAb570d73208a5210e4E95381751f428`](https://testnet.arcscan.app/address/0xB496516bAAb570d73208a5210e4E95381751f428) |
| USDC (ERC-20, 6dp) | `0x3600000000000000000000000000000000000000` |

- **`PayCircle`** — fee-bearing sends and one-transaction group payouts.
- **`SplitEscrow`** — holds each member's share of a bill; releases to the recipient once fully collected, refunds everyone on cancel or expiry.
- **`GoalPool`** — variable contributions toward a shared target; withdrawal requires unanimous member approval, so no one can drain the pot alone.

> **Arc's dual-decimals trap:** native USDC is 18 decimals (gas, `msg.value`), the ERC-20 interface is 6 decimals (`transfer`, `balanceOf`). All contract and app math is 6-decimal ERC-20. See [`docs/ARC_TESTNET.md`](docs/ARC_TESTNET.md).

---

## Quickstart

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

## Roadmap

- Cross-chain send UI — the CCTP relay and attestation path are built and the relayer is funded on Arc; the source-chain wallet connector is the remaining piece.
- On-chain settlement for cash-out fees via `PayCircle.collectOfframpFee`.
- Push and SMS notifications alongside the existing in-app feed.

---

## Docs

- [Product & technical spec](docs/SPEC.md)
- [Arc testnet reference](docs/ARC_TESTNET.md)

---

*Coven — send to anyone, cash out anywhere. Built on Arc.*
