# Route tests

Tests for the API routes that move money or record on-chain events. They call the **real route
handlers** from `app/api`; only the network is faked (Supabase, Circle and Yellow Card), and where a
route depends on a contract the tests run it against a local chain with the real contracts deployed.

```bash
npm test          # or: pnpm test
```

Takes about 6 seconds.

## Requirements

- Node 22.7 or newer (the tests import the TypeScript sources directly).
- [Foundry](https://getfoundry.sh) (`anvil` and `forge`) for the chain-backed tests. Without it those
  tests are skipped with a message and everything else still runs.
- The contracts are deployed from `contract/out`. If it is missing the tests run `forge build` for you.

## What is covered

| File | What it proves |
|---|---|
| `cashout.test.mjs` | Cash out never requests a payout for USDC it has not received, refuses replays, and switches off when Yellow Card credentials are missing (audit A-2) |
| `transfer-challenge.test.mjs` | The cash-out transfer challenge sends the full amount to the collection wallet and is refused before any PIN when a payout could not be made |
| `payment-replay.test.mjs` | One on-chain transfer is recorded once by send, request-pay, circle-send and split-pay, including the race where only the unique constraint can stop a duplicate (audit A-3) |
| `inbound-sync.test.mjs` | The deposit sync leaves recent transfers to the sender's own confirm and never fails on a duplicate |
| `goal-withdrawals.test.mjs` | A withdrawal is recorded only if the chain agrees, so a member cannot make the others approve a payout they were not shown (audit A-1) |
| `goal-actions.test.mjs` | GoalPool v2: contributions pause during a withdrawal, approvals carry recipient and amount, and the time-locked exit and refunds work |
| `goal-confirms.test.mjs` | Goal creation and contribution are recorded from the chain, not the request, and cannot be replayed or claimed by someone else |
| `splits-escrow.test.mjs` | Bill splits held in SplitEscrow: create, pay, complete, cancel, expire and refund, and the old direct-pay path is refused |

Every challenge a route issues is executed on the local chain exactly as Circle would, so the tests
prove the calls are valid, not only that the routes ran.

## How it fits together

- `helpers/fakes.mjs` is one fake backend shared by every test. Its database enforces the same
  unique keys as the migrations, so a replayed request hits the constraint like it would in Postgres.
- `helpers/chain.mjs` starts anvil on a free port and deploys contracts from `contract/out`.
- `helpers/loader.mjs` resolves the app's `@/...` imports.

## Adding a test

Chain scenarios are stateful, so they run in order inside one test and `makeChecker()` reports each
check as its own subtest. When you fix a bug, first make a test that fails without the fix: re-introduce
the bug and confirm the suite goes red.
