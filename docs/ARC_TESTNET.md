# Arc Network Reference — Coven

Distilled from [docs.arc.io](https://docs.arc.io/integrate) (fetched 2026-07-17). Everything here is **Arc Testnet** — mainnet addresses are not published yet.

---

## 1. Network Configuration

| Parameter | Value |
|---|---|
| Network name | Arc Testnet |
| Chain ID | `5042002` |
| Native gas token | USDC (18 decimals at the native layer) |
| Block explorer | https://explorer.testnet.arc.io (Blockscout; the old testnet.arcscan.app host now 301-redirects here, which drops the body of `forge verify-contract` POSTs, so always pass the new host as `--verifier-url`) |
| Faucet | https://faucet.circle.com (select Arc Testnet → dispenses testnet USDC) |
| Block time | ~0.5s · deterministic finality on inclusion (single confirmation is final, no reorgs) |

### RPC Endpoints

| Provider | HTTPS | WebSocket |
|---|---|---|
| Primary | `https://rpc.testnet.arc.network` | `wss://rpc.testnet.arc.network` |
| Blockdaemon | `https://rpc.blockdaemon.testnet.arc.network` | `wss://rpc.blockdaemon.testnet.arc.network:443/websocket` |
| dRPC | `https://rpc.drpc.testnet.arc.network` | `wss://rpc.drpc.testnet.arc.network` |
| QuickNode | `https://rpc.quicknode.testnet.arc.network` | `wss://rpc.quicknode.testnet.arc.network` |

### viem / wagmi

`arcTestnet` is a **built-in chain definition** in viem — no manual chain object needed:

```typescript
import { arcTestnet } from "viem/chains";
import { createPublicClient, http } from "viem";

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(process.env.ARC_RPC_URL),
});
```

### Values used across this repo's `.env` files

```bash
ARC_RPC_URL=https://rpc.testnet.arc.network
ARC_CHAIN_ID=5042002
ARC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
```

---

## 2. USDC: The Dual-Decimals Trap ⚠️

**Native USDC and ERC-20 USDC are the SAME asset with two interfaces:**

- **Native interface** — 18 decimals. Used for gas, `msg.value`, plain native sends.
- **ERC-20 interface** — 6 decimals. Used for `transfer` / `transferFrom` / `approve` / `balanceOf`.

Implications for Coven:

- `PayCircle.sol` and `SplitEscrow.sol` interact with USDC **only via the ERC-20 interface at `0x3600...0000`**, so all contract math stays in 6 decimals — matches `toUsdcUnits`/`fromUsdcUnits` in `frontend/lib/contracts/index.ts` and the fee math in the Solidity (`amount_usdc numeric(20,6)` in the DB schema too).
- `balanceOf()` truncates to 6 decimals: dust below `0.000001` USDC exists in the native balance but reads as `0` via ERC-20. Irrelevant at our amounts, but don't be surprised by it.
- **EIP-7708:** every *native* USDC movement (gas payments, native sends) also emits an ERC-20 `Transfer` event — but from a **system address and in 18 decimals**. When indexing `Transfer` logs for activity/history, **filter by emitter = the USDC contract address** to only get real 6-decimal ERC-20 transfers.
- Recipients pay gas from their own USDC earnings — no second token to fund. Circle wallets on Arc make this invisible to end users.

---

## 3. Contract Addresses (Arc Testnet)

### The ones Coven needs

| Contract | Address | Notes |
|---|---|---|
| **USDC** | `0x3600000000000000000000000000000000000000` | ERC-20 interface, 6 decimals — this is `ARC_USDC_ADDRESS` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` | Batch RPC reads (e.g. balance + split status in one call) |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | Optional: gasless approvals for `send`/`splitPayment`/`SplitEscrow.pay` |
| CREATE2 Factory | `0x4e59b44847b379578588920cA78FbF26c0B4956C` | Standard deterministic deployer |
| CCTP TokenMessengerV2 (Domain 26) | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` | Arc's CCTP domain is **26**, not the placeholder `7` used earlier |
| CCTP MessageTransmitterV2 | `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275` | This is `ARC_MESSAGE_TRANSMITTER_ADDRESS` — relays the mint on Arc |

### Other system contracts (reference only)

| Contract | Address |
|---|---|
| EURC | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` |
| GatewayWallet | `0x0077777d7EBA4688BDeF3E311b846F25870A19B9` |
| Memo (tx extension) | `0x5294E9927c3306DcBaDb03fe70b92e01cCede505` |

---

## 4. Gas & Fees

- **EIP-1559 with EWMA smoothing** — base fee is a moving average of block utilization, so costs are stable. Target: **~$0.01 per transaction**.
- **Base fee is paid to the block beneficiary, not burned.**
- Testnet floor: **20 Gwei minimum base fee** (hard ceiling 20,000 Gwei). 30M gas/block.
- Rules for our txs:
  - Set `maxFeePerGas` ≥ **20 Gwei**.
  - `maxPriorityFeePerGas` of 0 is fine; **1 Gwei** improves inclusion under load.
  - Estimate via `eth_gasPrice` (quick) or `eth_feeHistory` (precise).
- **UI guideline from Circle:** display fees in **dollar terms**, not Gwei — matches the app's `formatUSDC` helper anyway.

---

## 5. EVM Differences That Affect Us

Arc is EVM-compatible (Ethereum bytecode + RPC). CREATE2, EIP-7702, and block-hash history behave exactly like Ethereum. Solidity `^0.8.24` and OpenZeppelin work as-is. Differences:

| Difference | Impact on Coven |
|---|---|
| `PREVRANDAO` always returns `0` | None — no randomness used in `PayCircle.sol` / `SplitEscrow.sol` |
| Blob txs (type-3) rejected | None |
| `block.timestamp` non-decreasing, 1s granularity; sub-second blocks can share a timestamp | Fine — `SplitEscrow` deadlines are hour-granularity |
| Value transfers can revert despite sufficient balance (zero address, blocklisted addresses, precompiles) | A blocklisted recipient's `pay()`/`send()` would revert — acceptable, surfaces as a failed API call |
| `SELFDESTRUCT` moves native USDC + emits Transfer log | None — no self-destruct in either contract |
| Two-state tx model: **pending or final**, nothing in between | The backend can treat 1 confirmation (`tx.wait()`) as settled — no polling for N confirmations in `lib/circle/wallets.ts` or `lib/cctp/crossChainPay.ts` |

---

## 6. Foundry: Deploy & Verify

```bash
# contract/.env
ARC_RPC_URL="https://rpc.testnet.arc.network"
DEPLOYER_PRIVATE_KEY="0x..."
ARC_USDC_ADDRESS="0x3600000000000000000000000000000000000000"
PLATFORM_FEE_WALLET="0x..."
PAYCIRCLE_OWNER="0x..."   # required by Deploy.s.sol; must NOT be the deploying key or any key on a server
```

```bash
# Fund the deployer: https://faucet.circle.com → Arc Testnet → testnet USDC (this IS the gas token)

# Each contract has its own script so any can be redeployed without touching the others:
#   script/Deploy.s.sol            PayCircle (needs PAYCIRCLE_OWNER)
#   script/DeploySplitEscrow.s.sol SplitEscrow
#   script/DeployGoalPool.s.sol    GoalPool (optional GOAL_EXIT_DELAY_DAYS, default 30)
# --legacy is required: forge doesn't have chain 5042002 in its built-in
# EIP-1559 support list yet and errors ("Chain 5042002 not supported")
# without it. Arc accepts legacy (type 0) txs fine.
cd contract
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $ARC_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --legacy

# Verify (Blockscout) — pass the verifier chain/URL as CLI flags, not via
# foundry.toml's [etherscan] table. Adding that table breaks `forge script`
# with the same "Chain not supported" error, since it's validated against
# the same built-in chain list at startup.
forge verify-contract <PAYCIRCLE_ADDRESS> src/PayCircle.sol:PayCircle \
  --chain-id 5042002 \
  --verifier blockscout \
  --verifier-url https://explorer.testnet.arc.io/api/ \
  --constructor-args $(cast abi-encode "constructor(address,address,address)" $ARC_USDC_ADDRESS $PLATFORM_FEE_WALLET $PAYCIRCLE_OWNER)

forge verify-contract <SPLITESCROW_ADDRESS> src/SplitEscrow.sol:SplitEscrow \
  --chain-id 5042002 \
  --verifier blockscout \
  --verifier-url https://explorer.testnet.arc.io/api/ \
  --constructor-args $(cast abi-encode "constructor(address)" $ARC_USDC_ADDRESS)

# Interact
cast call <PAYCIRCLE_ADDRESS> "feeTreasury()(address)" --rpc-url $ARC_RPC_URL
```

### Live testnet deployment (2026-07-20)

| Contract | Address |
|---|---|
| PayCircle v3 (deployed 2026-09-23, fee custody) | `0x6F76236742b87376Ef7d27E12968C796081Ed068` |
| SplitEscrow v3 (deployed 2026-09-23, per-split custody) | `0x2aE96b391a9cd89fFFCeDC1c1528E1CEC79DEE35` |
| GoalPool v4 (deployed 2026-09-23, 30-day exit delay, per-goal custody) | `0xf07D6A07313C3D470f8D3305ABC659fDD2462563` |
| Fee treasury | `0x5Ab64c56Df2d01A0c76534E01b6a06Cd3d79391C` |

These are wired into `frontend/.env.example` as `NEXT_PUBLIC_PAYCIRCLE_CONTRACT` / `NEXT_PUBLIC_SPLIT_ESCROW_CONTRACT` / `NEXT_PUBLIC_GOAL_POOL_CONTRACT`. Redeploy and update both places if the contracts change. GoalPool has its own deploy script (`contract/script/DeployGoalPool.s.sol`) so it can be redeployed without touching the other two.

The first GoalPool (`0xB496516bAAb570d73208a5210e4E95381751f428`, deployed 2026-07-25) is retired. It never held any funds. v2 fixes contributions being stranded while a withdrawal is pending, binds an approval to the request's recipient and amount, and adds a time-locked exit so one absent member cannot freeze a pool. GoalPool v2 (`0x49D4F073a25172209333aEB5BFFB42E58a57e9f5`, deployed 2026-09-21) and v3 (`0x059787667ef7Ff3E3F6B97f25d91d0e6F197858E`, deployed 2026-09-23) are also now retired — confirmed 0 USDC balance before each switchover. v3 cleared the exit-countdown fields (`exitAt`/`exitInitiator`) when a goal reaches a terminal state (`Withdrawn` or `Cancelled`) instead of leaving stale countdown data behind. v4 deploys a small per-goal `GoalCustody` contract at `createGoal` and routes every contribution, refund, and withdrawal through it instead of GoalPool's own balance — a USDC-issuer blocklist on one goal's custody address (or on GoalPool itself) can no longer freeze any other goal's funds. Set the exit delay at deploy time with `GOAL_EXIT_DELAY_DAYS` (default 30, minimum 1); it is immutable afterwards, and the app's `GOAL_EXIT_DAYS` in `app/circles/[id]/page.tsx` must match it.

The first SplitEscrow (`0x72AC36A822746a51b0Ff03Df15df19B3E4B5536E`, deployed 2026-07-20) is retired; it never held funds and nothing in the app calls it. v2 (`0x2AD815252A08Ca9E3081fBb40f47f1bF0117d6c7`, deployed 2026-09-22, also now retired, confirmed 0 USDC) pulls refunds instead of pushing them (one blocklisted member can no longer trap everyone's refund), makes `pay` take the recipient and amount the payer expects and revert on any mismatch, and bounds the member count and deadline. v3 deploys a small per-split `SplitCustody` contract at `createSplit` and routes every payment, completion payout, and refund through it instead of SplitEscrow's own balance — the same blocklist-isolation change as GoalPool v4. The app creates splits through it (`/api/splits/create-challenge` and `create-confirm`), so a bill split is held in escrow until every member has paid.

The first PayCircle (`0x5f4c5E9DA66935732e464F447d15E37E33E2daA4`, deployed 2026-07-20) is retired. Its owner was the deployer key, which is also the server's relayer key, so anyone who obtained that key could redirect every fee. It never held funds and nothing in the app calls it. v2 (`0xA55FD28Ef3dce9db4DF48d514aeab08A4b1b968f`, deployed 2026-09-22, also now retired, confirmed 0 USDC) accrues fees in the contract and pays them out with `withdrawFees` (a treasury that cannot receive USDC no longer blocks `send`, `splitPayment` or `collectOfframpFee`), moves ownership in two steps (`transferOwnership`, then `acceptOwnership` by the new owner), disables `renounceOwnership`, and caps group payments at 50 recipients. v3 pulls fees into a dedicated `FeeCustody` contract instead of PayCircle's own balance, so a blocklist on the PayCircle address itself no longer also freezes already-collected fees. Owner: the collection wallet `0x1F7F046F2a2a603Fa30D5340Aa3451Bedd1ed560` (not a server key). Fee treasury: `0x5Ab64c56Df2d01A0c76534E01b6a06Cd3d79391C`. Nothing in the app calls PayCircle yet, so no fees flow through it.

**TODO when PayCircle is wired into the app:** `FeeCustody` is one shared contract, not per-transaction (per-tx isolation isn't worth it — deploying a contract to hold a 0.25–1% fee costs more gas than the fee). So call `withdrawFees()` on a schedule (e.g. daily cron, or after every N fee-bearing calls) instead of letting fees accrue indefinitely — that caps how much a blocklist on the `FeeCustody` address could ever freeze to what's built up since the last sweep.

---

## 7. Circle Wallets on Arc

- Circle Programmable Wallets support Arc Testnet — blockchain identifier **`ARC-TESTNET`** (matches `CIRCLE_BLOCKCHAIN` in `frontend/lib/circle/wallets.ts`).
- **Smart Contract Accounts (SCA) on Arc Testnet work with Circle Gas Station to auto-sponsor transaction fees** — worth using for recipient wallets so brand-new recipients can withdraw/receive before they hold any USDC for gas.
- Circle also offers pre-audited deploy templates via the Wallets API (ERC-20/721/1155/Airdrop) — not needed here; Coven deploys `PayCircle.sol` and `SplitEscrow.sol` itself with Foundry.

---

## 8. Open Questions / To Verify While Building

- Confirm the exact Circle SDK blockchain enum for Arc (`ARC-TESTNET`) in the current `@circle-fin/user-controlled-wallets` version.
- Confirm whether Circle Payouts (offramp) can pull directly from an Arc wallet or requires a Circle Mint/business account intermediary.
- Mainnet addresses/chain ID unpublished — everything above is testnet; keep all addresses in env vars.

### Resolved

- ~~`crossChainPay.ts` mixed CCTP V1 addresses per source chain with Arc's V2 mint leg~~ — replaced with `@cctp-sdk/core`, which uses consistent V2 TokenMessenger/MessageTransmitter addresses across all supported chains (including Arc, domain 26) via CREATE2, confirming the V1/V2 mismatch concern above is moot on V2. The SDK also fixed a latent bug in our hand-rolled code: CCTP v2's raw `MessageSent` event encodes a **zero nonce**, so parsing message bytes directly from the burn receipt (as the old code did) is unreliable — the SDK sources message bytes from Circle's Iris attestation response instead, which is what `lib/cctp/crossChainPay.ts` now does via `AttestationClient.poll()`.
- The burn (client-side, user's own wallet) and relay (server-side, our relayer key) are split across two processes deliberately, so the SDK's own `CctpClient.transfer()`/`resume()` full state machine (which expects both signer roles in one call and persists state to `localStorage`/`/tmp`) isn't used end-to-end. Instead: the client calls `transfer()` with only a source wallet and resolves as soon as `sourceTxHash` appears in a `stateChange` event (ignoring the SDK's own background attempt to also relay, which fails harmlessly without a destination wallet); the server then independently polls `AttestationClient` from that tx hash and submits `receiveMessage` with the relayer key. See `initiateXChainPayment`/`relayToArc` in `lib/cctp/crossChainPay.ts`.
