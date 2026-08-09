# Arc Network Reference — Coven

Distilled from [docs.arc.io](https://docs.arc.io/integrate) (fetched 2026-07-17). Everything here is **Arc Testnet** — mainnet addresses are not published yet.

---

## 1. Network Configuration

| Parameter | Value |
|---|---|
| Network name | Arc Testnet |
| Chain ID | `5042002` |
| Native gas token | USDC (18 decimals at the native layer) |
| Block explorer | https://testnet.arcscan.app (Blockscout) |
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
```

```bash
# Fund the deployer: https://faucet.circle.com → Arc Testnet → testnet USDC (this IS the gas token)

# Deploy both contracts via the repo's script (contract/script/Deploy.s.sol)
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
  --verifier-url https://testnet.arcscan.app/api/ \
  --constructor-args $(cast abi-encode "constructor(address,address,address)" $ARC_USDC_ADDRESS $PLATFORM_FEE_WALLET $DEPLOYER_ADDRESS)

forge verify-contract <SPLITESCROW_ADDRESS> src/SplitEscrow.sol:SplitEscrow \
  --chain-id 5042002 \
  --verifier blockscout \
  --verifier-url https://testnet.arcscan.app/api/ \
  --constructor-args $(cast abi-encode "constructor(address)" $ARC_USDC_ADDRESS)

# Interact
cast call <PAYCIRCLE_ADDRESS> "feeTreasury()(address)" --rpc-url $ARC_RPC_URL
```

### Live testnet deployment (2026-07-20)

| Contract | Address |
|---|---|
| PayCircle | `0x5f4c5E9DA66935732e464F447d15E37E33E2daA4` |
| SplitEscrow | `0x72AC36A822746a51b0Ff03Df15df19B3E4B5536E` |
| GoalPool (deployed 2026-07-25) | `0xB496516bAAb570d73208a5210e4E95381751f428` |
| Fee treasury | `0x5Ab64c56Df2d01A0c76534E01b6a06Cd3d79391C` |

These are wired into `frontend/.env.example` as `NEXT_PUBLIC_PAYCIRCLE_CONTRACT` / `NEXT_PUBLIC_SPLIT_ESCROW_CONTRACT` / `NEXT_PUBLIC_GOAL_POOL_CONTRACT`. Redeploy and update both places if the contracts change. GoalPool has its own deploy script (`contract/script/DeployGoalPool.s.sol`) so it can be redeployed without touching the other two.

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
