# Coven Testnet Guide

Testnet opens: **9 November 2026** · Network: **Arc Testnet** · Funds: testnet USDC (no real value)

Coven is a social USDC payments app on Arc. Testers send money to an @username, split bills in a group, and save toward a shared goal with friends. Everything on testnet uses free testnet USDC, so try everything and tell us what breaks.

---

## 1. Official links

| Where | Link |
| --- | --- |
| App | https://covenpay.com |
| X | https://x.com/Covenpay |
| Telegram group | https://t.me/+GVyHEXlo41M0Mzc0 |
| Docs | https://covenpay.com/docs |
| Whitepaper | https://covenpay.com/whitepaper |
| USDC faucet | https://faucet.circle.com (choose **Arc Testnet**) |
| Block explorer | https://explorer.testnet.arc.io |
| Source code | https://github.com/MarvyNwaokobia/Coven |

Only trust links posted here or pinned in the official Telegram group. The team will never ask for your PIN, and nobody can recover it for you.

---

## 2. Before you start

You need a Google account and about five minutes. You do **not** need MetaMask, a seed phrase, or any token other than testnet USDC.

1. Open the Coven app and sign in with Google.
2. Claim your @username. It is permanent, so pick one you want to keep.
3. Set your wallet PIN. Coven creates a Circle wallet on Arc Testnet for you. Every payment needs this PIN.
4. Open **Receive** and copy your wallet address (starts with `0x`).
5. Go to https://faucet.circle.com, choose **Arc Testnet** and **USDC**, paste your address and request funds.
6. Back in Coven, check that your balance on Home has gone up. It usually takes a few seconds.

On Arc, USDC also pays the network fee (about $0.01 per transaction), so there is no separate gas token. Keep at least 1 USDC in your wallet so fees never block a payment.

### Network details

| | |
| --- | --- |
| Network | Arc Testnet |
| Chain ID | 5042002 |
| RPC | https://rpc.testnet.arc.network |
| Explorer | https://explorer.testnet.arc.io |
| USDC (ERC-20, 6 decimals) | `0x3600000000000000000000000000000000000000` |
| SplitEscrow (bill splits) | `0x2aE96b391a9cd89fFFCeDC1c1528E1CEC79DEE35` |
| GoalPool (group savings) | `0xf07D6A07313C3D470f8D3305ABC659fDD2462563` |

---

## 3. Eligibility requirements

A tester is **eligible** once they complete all six required stages. The team checks this automatically from recorded on-chain transactions and invite records, so there is nothing to submit.

| Stage | What you do | What counts | Contract | Required |
| --- | --- | --- | --- | --- |
| 1. Wallet set up | Sign in, claim @username, set PIN | A Coven wallet on your account | Circle wallet | Yes |
| 2. Funded | Claim testnet USDC from the faucet | A deposit into your Coven wallet | USDC | No (but every later stage needs funds) |
| 3. Create a circle | Create a circle with at least one other tester | One circle you created | none (off-chain) | Yes |
| 4. Send money | Send USDC to an @username, or send to your circle | One completed send | USDC transfer | Yes |
| 5. Split a bill | Create a bill split in a circle, or pay your share of one | One split created or paid | SplitEscrow | Yes |
| 6. Contribute to a goal | Put USDC into a circle savings goal | One contribution | GoalPool | Yes |
| 7. Invite a friend | Share your invite link (Settings) | One friend who signs up through it and sets up a wallet | none (off-chain) | Yes |

**Bonus activity** (recorded, does not change eligibility): number of transactions, volume moved, goals created, and invites beyond the first.

### Fair-play rules

- One account per person. Clusters of new accounts moving the same funds in a loop may be removed.
- Only transactions made through the Coven app count. Sending USDC straight to a contract from another wallet does not.
- Requirements may change during the testnet. Changes will be announced in Telegram and updated here.

### Open questions for the team

- What do eligible testers receive (rewards, role, early access)?
- Snapshot date: when is eligibility frozen?
- Is there a minimum number of transactions or a minimum volume, beyond one of each stage?

---

## 4. Step-by-step walkthrough

Invite a friend (or a few) with your invite link from **Settings**: one who signs up through it and sets up a wallet completes the Invite stage. Circles, splits and goals all need at least two people with Coven accounts.

### Create a circle
1. Go to **Circles** → **New circle**.
2. Give it a name and add members by @username (they must already have signed up).
3. Create it. Every member sees it under Circles.

### Send money
1. Tap **Send**, search for an @username, enter an amount and an optional note.
2. Confirm with your PIN.
3. Or, inside a circle, send to the whole circle.
4. The payment shows in **History** for both sides within seconds.

### Split a bill (SplitEscrow)
1. Open your circle → **New bill split**.
2. Enter what it is for and the total amount, then confirm with your PIN. This creates the split on-chain.
3. Each member opens the split and pays their share with their PIN. The money is held in escrow.
4. When everyone has paid, the escrow pays the creator automatically.
5. If the split is cancelled or passes its deadline before everyone pays, anyone who paid can claim their money back.

### Save toward a goal (GoalPool)
1. Open your circle → **New savings goal**.
2. Enter what you are saving for and a target amount, then confirm with your PIN.
3. Any member contributes any amount with their PIN.
4. To release the pot, one member requests a withdrawal and **every** member must approve it.
5. If someone stops responding, a member can start an exit. After a 30-day countdown the goal dissolves and everyone can claim back what they put in.

### Optional: try the rest
- **Request** money from someone, and decline or pay a request sent to you.
- **QR**: show your QR on Receive and let a friend scan it with **Scan**.

---

## 5. How activity is tracked

The tracker page (`/testnet` on the app) is **core team only**: it opens only with the team access code (`TESTNET_ACCESS_CODE`), or for a signed-in email listed in `TESTNET_TEAM_EMAILS`. Testers cannot see it. Share the code with the team privately, never in the public channels. It updates every 30 seconds and shows:

- **Totals**: testers, wallets, eligible testers, transactions, USDC volume.
- **Stage progress**: how many testers have completed each stage.
- **Leaderboard**: every tester's username, wallet address, transaction count by type, volume, and a tick for each stage. Searchable by username or address, and exportable as CSV.
- **Live feed**: the latest transactions with their type, the contract they went through, the amount, and a link to the explorer.

| Tracker label | What happened | Contract |
| --- | --- | --- |
| Send | USDC sent to an @username | USDC transfer |
| Circle send | USDC sent inside a circle | USDC transfer |
| Split created | A bill split was opened | SplitEscrow |
| Split paid | A member paid their share | SplitEscrow |
| Goal created | A savings goal was opened | GoalPool |
| Goal contribution | USDC put into a goal | GoalPool |
| Goal payout | A goal released its funds | GoalPool |
| Deposit | USDC arrived from outside Coven (e.g. the faucet) | USDC |

Only transactions the server has verified on-chain are recorded, so a failed or abandoned payment never appears.

---

## 6. Troubleshooting & FAQ

**My faucet USDC isn't showing.** Check you pasted the address from Coven's **Receive** screen and chose Arc Testnet on the faucet. Look up the address on the explorer; if the USDC is there, refresh Home.

**The faucet says I've hit a limit.** The Circle faucet rate-limits requests. Wait and try later, or ask in Telegram for a tester to send you a few USDC by @username.

**A payment is stuck or failed.** Check History. If the money left your wallet (visible on the explorer) but Coven doesn't show it, report it with the transaction hash.

**I forgot my PIN.** The PIN protects your wallet and only you know it. The team cannot reset it. Make a note of it when you set it.

**My split or goal action is greyed out.** Splits need every member to pay; goal contributions pause while a withdrawal is waiting for approval. Approve or cancel the pending withdrawal first.

**Cash out doesn't work.** Cash out to a bank account is not part of the testnet.

### Reporting a bug

Post in the [Telegram group](https://t.me/+GVyHEXlo41M0Mzc0) or open an issue on [GitHub](https://github.com/MarvyNwaokobia/Coven/issues) with:
1. Your @username
2. What you were doing and what you expected
3. What happened instead (a screenshot helps)
4. The transaction hash or explorer link, if any
5. Device and browser

---

## 7. Team launch checklist (internal)

Before announcing, and once a day during the testnet:

- [ ] `GET /api/health` returns `"ok": true` (Database, migrations, Arc RPC, contracts, Circle API all green)
- [ ] Migration `008_referrals.sql` applied to the production Supabase database
- [ ] Testnet deployment has `NEXT_PUBLIC_NETWORK=testnet`, `CIRCLE_BLOCKCHAIN=ARC-TESTNET`, and a Circle `TEST_API_KEY`
- [ ] Relayer wallet funded from the faucet (only needed for cross-chain payments)
- [ ] One team member runs the full walkthrough end to end on the live app: sign up → fund → circle → send → split (create + pay) → goal (create + contribute) → invite a second account
- [ ] `TESTNET_ACCESS_CODE` set in the deployment to a long random code, shared with the team privately
- [ ] `/testnet` tracker opens with the code and shows that run with every stage ticked
- [ ] Links in section 1 pinned in Telegram
- [ ] Someone assigned to watch Telegram for bug reports
- [ ] Point an uptime monitor at `/api/health` (it answers 503 when anything critical is down)
