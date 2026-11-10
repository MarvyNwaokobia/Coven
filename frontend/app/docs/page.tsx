import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { CovenMark } from "@/components/Icons";
import { NETWORK, NETWORK_LABEL, ARC_CHAIN_ID } from "@/lib/network";
import { EXPLORER_URL } from "@/lib/explorer";
import { GITHUB_URL, TELEGRAM_URL, X_URL } from "@/lib/community";
import { FAUCET_URL as FAUCET, STAGES, TRACKER_ENABLED, TX_KINDS, type TxKind } from "@/lib/testnet";
import DocsNav, { type NavGroup } from "./DocsNav";

export const metadata: Metadata = {
  title: "Docs · Coven",
  description: "Everything about Coven: the testnet, getting started, every feature, fees, security, the smart contracts and the API.",
};

/* ============================================================================
   Coven documentation. One page, grouped sections, contents on the left.
   Addresses and links come from env so a mainnet deployment shows its own.
   ========================================================================== */

const IS_TESTNET = NETWORK === "testnet";
const EXPLORER = EXPLORER_URL;
const WHITEPAPER = "/whitepaper";
const GITHUB = GITHUB_URL;
// Official links. Env can override them (e.g. a staging deployment); otherwise these are used.
const SITE_URL = "https://covenpay.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.includes("localhost") ? SITE_URL : (process.env.NEXT_PUBLIC_APP_URL || SITE_URL);

const USDC = process.env.NEXT_PUBLIC_USDC_ADDRESS ?? (IS_TESTNET ? "0x3600000000000000000000000000000000000000" : undefined);
const SPLIT_ESCROW = process.env.NEXT_PUBLIC_SPLIT_ESCROW_CONTRACT;
const GOAL_POOL = process.env.NEXT_PUBLIC_GOAL_POOL_CONTRACT;
const PAYCIRCLE = process.env.NEXT_PUBLIC_PAYCIRCLE_CONTRACT;

const NAV: NavGroup[] = [
  {
    title: "Start here",
    items: [
      { id: "overview", label: "What is Coven" },
      { id: "testnet", label: "Testnet" },
      { id: "getting-started", label: "Getting started" },
      { id: "eligibility", label: "Eligibility" },
      ...(TRACKER_ENABLED ? [{ id: "tracker", label: "How activity is counted" }] : []),
    ],
  },
  {
    title: "Using Coven",
    items: [
      { id: "usernames", label: "@usernames" },
      { id: "send", label: "Sending money" },
      { id: "requests", label: "Requests" },
      { id: "qr", label: "QR payments" },
      { id: "circles", label: "Circles" },
      { id: "splits", label: "Bill splits" },
      { id: "goals", label: "Savings goals" },
      { id: "activity", label: "History & notifications" },
      { id: "invites", label: "Invites" },
      { id: "cashout", label: "Cash out" },
      { id: "cross-chain", label: "Cross-chain payments" },
    ],
  },
  {
    title: "Reference",
    items: [
      { id: "fees", label: "Fees & limits" },
      { id: "how-it-works", label: "How a payment works" },
      { id: "security", label: "Security" },
      { id: "contracts", label: "Smart contracts" },
      { id: "network", label: "Arc network" },
    ],
  },
  {
    title: "Developers",
    items: [
      { id: "architecture", label: "Architecture" },
      { id: "run-locally", label: "Run it locally" },
      { id: "api", label: "API routes" },
      { id: "operations", label: "Health & operations" },
    ],
  },
  {
    title: "Help",
    items: [
      { id: "faq", label: "FAQ & troubleshooting" },
      { id: "bugs", label: "Reporting a bug" },
      { id: "glossary", label: "Glossary" },
      { id: "roadmap", label: "Roadmap" },
    ],
  },
];

/* ------------------------------------------------------------ primitives */

function Section({ id, title, lead, children }: { id: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32 border-b border-line py-10 first:pt-2 last:border-0 lg:scroll-mt-24">
      <h2 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
        <a href={`#${id}`} className="hover:text-accent">{title}</a>
      </h2>
      {lead && <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">{lead}</p>}
      <div className="mt-5 space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

const H3 = ({ children }: { children: ReactNode }) => <h3 className="pt-3 text-base font-bold text-ink">{children}</h3>;

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="tnum mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
            {i + 1}
          </span>
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-1.5 pl-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-mute" aria-hidden="true" />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Callout({ tone = "info", title, children }: { tone?: "info" | "warn" | "pos"; title: string; children: ReactNode }) {
  const styles = {
    info: "border-accent-line bg-accent-soft",
    warn: "border-warn-line bg-warn-soft",
    pos: "border-pos-line bg-pos-soft",
  }[tone];
  return (
    <div className={`rounded-xl border px-4 py-3.5 ${styles}`}>
      <p className="text-sm font-bold text-ink">{title}</p>
      <div className="mt-1 text-sm leading-relaxed text-ink-soft">{children}</div>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-line bg-surface-2 text-left">
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 text-xs font-bold text-ink-soft">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line align-top last:border-0">
              {r.map((c, j) => (
                <td key={j} className={`px-4 py-2.5 ${j === 0 ? "font-semibold text-ink" : "text-ink-soft"}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Code = ({ children }: { children: ReactNode }) => (
  <code className="break-all rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[0.8125rem] text-ink">{children}</code>
);

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-line bg-ink px-4 py-3.5 font-mono text-[0.8125rem] leading-relaxed text-surface">
      <code>{children}</code>
    </pre>
  );
}

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
      {children}
    </a>
  );
}

function Address({ value }: { value?: string }) {
  if (!value) return <span className="text-ink-mute">not configured</span>;
  return EXPLORER ? (
    <a href={`${EXPLORER}/address/${value}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
      <Code>{value}</Code>
    </a>
  ) : (
    <Code>{value}</Code>
  );
}

/* ------------------------------------------------------------------ page */

export default function DocsPage() {
  const required = STAGES.filter((s) => s.required);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <CovenMark className="h-7 w-7 text-accent" />
              <span className="text-lg font-extrabold tracking-tight text-ink">Coven</span>
            </Link>
            <span className="rounded-md bg-surface-3 px-2 py-0.5 text-xs font-bold text-ink-soft">Docs</span>
          </div>
          <div className="flex items-center gap-2">
            <a href={WHITEPAPER} target="_blank" rel="noopener noreferrer" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft hover:text-ink sm:inline-block">
              Whitepaper
            </a>
            <Link href="/signup" className="rounded-lg bg-ink px-3.5 py-2 text-sm font-bold text-surface hover:bg-ink-2">
              Open the app
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8">
        <aside className="lg:pt-10">
          <DocsNav groups={NAV} />
        </aside>

        <main className="min-w-0 max-w-3xl pb-16 pt-6 lg:pt-10">
          <div className="mb-6">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-line bg-accent-soft px-3 py-1 text-xs font-bold text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
              {NETWORK_LABEL}
            </span>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Coven documentation</h1>
            <p className="mt-2 text-base leading-relaxed text-ink-soft">
              Everything about Coven in one place: joining the testnet, using every feature, what it costs, how your money is
              protected, and how it is built.
            </p>
          </div>

          {/* ===================================================== START HERE */}

          <Section
            id="overview"
            title="What is Coven"
            lead="Coven is a social payments app for USDC. Send to an @username, split bills with friends, save toward a shared goal, and cash out to a local bank account."
          >
            <p>
              Coven is a payments app, not a crypto wallet. You sign in with Google, claim a permanent <strong>@username</strong>,
              and pay people by name instead of by a 42-character address. There is no seed phrase to write down and no second
              token to buy for fees.
            </p>
            <p>
              Every account is backed by a <strong>Circle Programmable Wallet</strong> that you control with a PIN. Payments
              settle on <strong>Arc</strong>, a blockchain built for payments where USDC is also the gas token, so a payment is
              final in under a second and costs about a cent.
            </p>
            <Table
              head={["Feature", "What it does"]}
              rows={[
                ["@usernames", "A permanent handle so people can pay you by name"],
                ["Send & request", "One-tap payments and payment requests, with decline"],
                ["QR payments", "Show a code, get paid. Optional fixed amount for merchants"],
                ["Circles", "Groups with a shared activity feed and group sends"],
                ["Bill splits", "Each member's share is held in an escrow contract until everyone has paid"],
                ["Savings goals", "Pool money toward a target; releasing it needs every member's approval"],
                ["Cash out", "USDC to NGN, GHS, KES or ZAR in a bank account via Yellow Card (not on testnet)"],
              ]}
            />
            <H3>Why Arc</H3>
            <Bullets
              items={[
                <><strong>USDC pays the fee.</strong> Someone who has just received money can spend it straight away, without first buying another token for gas.</>,
                <><strong>Final on inclusion.</strong> One confirmation is final and blocks arrive about every half second, so the app treats a payment as settled as soon as it lands.</>,
                <><strong>Stable, low fees.</strong> About $0.01 per transaction, so the app can show you a real fee in dollars.</>,
              ]}
            />
          </Section>

          <Section
            id="testnet"
            title="Testnet"
            lead={`Coven's public testnet opened on 9 November 2026 on ${NETWORK_LABEL}. Every dollar on testnet is free testnet USDC with no real value.`}
          >
            <p>
              The testnet is where we find what breaks before real money is involved. Use every feature, try odd amounts, invite
              friends, and report anything that looks wrong. Completing the core flows makes you eligible (see{" "}
              <a href="#eligibility" className="font-semibold text-accent hover:underline">Eligibility</a>). The{" "}
              <Ext href={WHITEPAPER}>testnet whitepaper</Ext> sets out the testnet&apos;s objectives, eligibility and
              fair-play policy in full.
            </p>
            <Table
              head={["Where", "Link"]}
              rows={[
                ["App", <Ext key="app" href={APP_URL}>{APP_URL.replace(/^https?:\/\//, "")}</Ext>],
                ["Testnet whitepaper", <Ext key="wp" href={WHITEPAPER}>Download the PDF</Ext>],
                ["X", <Ext key="x" href={X_URL}>@Covenpay</Ext>],
                ["Telegram", <Ext key="tg" href={TELEGRAM_URL}>Coven testnet group</Ext>],
                ["USDC faucet", <Ext key="f" href={FAUCET}>faucet.circle.com</Ext>],
                ...(EXPLORER ? [["Block explorer", <Ext key="e" href={EXPLORER}>{EXPLORER.replace(/^https?:\/\//, "")}</Ext>]] : []),
                ["Source code", <Ext key="g" href={GITHUB}>GitHub</Ext>],
              ]}
            />
            <Callout tone="warn" title="Only trust official links">
              Use the links on this page or pinned in the official channels. Coven will never ask for your PIN, a one-time code
              or a seed phrase, and nobody on the team can recover your PIN.
            </Callout>
            <H3>What is live on testnet</H3>
            <Table
              head={["Feature", "Status"]}
              rows={[
                ["Sign up, @username, wallet", "Live"],
                ["Send, request, QR", "Live"],
                ["Circles and circle sends", "Live"],
                ["Bill splits (SplitEscrow)", "Live"],
                ["Savings goals (GoalPool)", "Live"],
                ["Invites and referrals", "Live"],
                ["Cash out to a bank", "Not part of the testnet"],
                ["Paying in from other chains", "Coming later (see Cross-chain payments)"],
              ]}
            />
          </Section>

          <Section id="getting-started" title="Getting started" lead="You need a Google account and about five minutes. No MetaMask, no seed phrase, no gas token.">
            <Steps
              items={[
                <>Open Coven and <strong>sign in with Google</strong>.</>,
                <>Claim your <strong>@username</strong>. It is permanent, so choose one you want to keep.</>,
                <>Set your <strong>wallet PIN</strong>. Coven creates a Circle wallet on Arc for you, and every payment needs this PIN. Write it down somewhere safe; it cannot be reset by anyone else.</>,
                <>Open <strong>Receive</strong> and copy your wallet address (it starts with <Code>0x</Code>).</>,
                <>Go to <Ext href={FAUCET}>faucet.circle.com</Ext>, choose <strong>Arc Testnet</strong> and <strong>USDC</strong>, paste your address and request funds.</>,
                <>Back in Coven, your balance on <strong>Home</strong> goes up within a few seconds. You are ready.</>,
              ]}
            />
            <Callout title="Keep a little USDC for fees">
              On Arc the network fee is paid in USDC, about $0.01 a transaction. Keep at least 1 USDC in your wallet so a fee never
              blocks a payment.
            </Callout>
            <H3>Wallet setup failed or was interrupted?</H3>
            <p>
              Reload the app and sign in again, then finish setting your PIN. If it still fails, report it with your @username
              (see <a href="#bugs" className="font-semibold text-accent hover:underline">Reporting a bug</a>).
            </p>
          </Section>

          <Section
            id="eligibility"
            title="Eligibility"
            lead={`You are eligible once you have completed all ${required.length} required stages. The team checks this automatically from on-chain transactions and invite records, so there is nothing to submit.`}
          >
            <Table
              head={["Stage", "What you do", "What counts", "Contract", "Required"]}
              rows={[
                ["Wallet set up", "Sign in, claim @username, set PIN", "A Coven wallet on your account", "Circle wallet", "Yes"],
                ["Funded", "Claim testnet USDC from the faucet", "A deposit into your Coven wallet", "USDC", "No, but later stages need funds"],
                ["Create a circle", "Create a circle with at least one other tester", "One circle you created", "None (off-chain)", "Yes"],
                ["Send money", "Send USDC to an @username or inside a circle", "One completed send", "USDC transfer", "Yes"],
                ["Split a bill", "Create a bill split, or pay your share of one", "One split created or paid", "SplitEscrow", "Yes"],
                ["Contribute to a goal", "Put USDC into a circle savings goal", "One contribution", "GoalPool", "Yes"],
                ["Invite a friend", "Share your invite link from Settings", "One friend who signs up through it and sets up a wallet", "None (off-chain)", "Yes"],
              ]}
            />
            <p>
              <strong>Bonus activity</strong> is recorded but does not change eligibility: total transactions, USDC moved, goals
              created, and any invites beyond the first.
            </p>
            <H3>Fair play</H3>
            <Bullets
              items={[
                "One account per person. Clusters of new accounts moving the same funds in a loop may be removed.",
                "Only transactions made through the Coven app count. Sending USDC to a contract from another wallet does not.",
                "Requirements may change during the testnet. Changes are announced in the official channels and on this page.",
              ]}
            />
          </Section>

          {TRACKER_ENABLED && (
          <Section id="tracker" title="How activity is counted" lead="The core team tracks every verified testnet transaction and each tester's progress on an internal tracker.">
            <p>
              Each transaction you make through Coven is recorded with what it did and which contract it went through. Your stages
              are ticked from those records and from your invite link, so you do not need to submit anything. The tracker itself
              is only open to the Coven team; to check your own progress, open <strong>Settings → Testnet</strong>.
            </p>
            <Table
              head={["Tracker label", "What happened", "Contract"]}
              rows={(Object.keys(TX_KINDS) as TxKind[]).map((k) => [TX_KINDS[k].label, KIND_MEANING[k], TX_KINDS[k].contract])}
            />
            <p>
              The tracker lists usernames and wallet addresses, never emails or phone numbers. Only transactions the server has verified on-chain are recorded, so a failed or abandoned
              payment never appears.
            </p>
          </Section>
          )}

          {/* ===================================================== USING COVEN */}

          <Section id="usernames" title="@usernames" lead="Your @username is how people find and pay you. It is permanent.">
            <Bullets
              items={[
                "3 to 20 characters: letters, numbers and underscore.",
                "Not case-sensitive: @Ada and @ada are the same account.",
                <>Some names are reserved, such as <Code>coven</Code>, <Code>admin</Code>, <Code>support</Code>, <Code>help</Code> and <Code>official</Code>.</>,
                <>Your public profile is at <Code>/profile/yourname</Code>.</>,
              ]}
            />
          </Section>

          <Section id="send" title="Sending money" lead="Pay anyone on Coven by @username. Same-chain payments carry no Coven fee.">
            <Steps
              items={[
                <>Tap <strong>Send</strong> and search for an @username.</>,
                "Enter the amount and an optional note.",
                "Check the recipient and the amount, then confirm with your PIN.",
                <>The payment lands in under a second and shows in <strong>History</strong> for both of you.</>,
              ]}
            />
            <Callout tone="warn" title="Payments are final">
              A payment on Arc cannot be reversed. Check the @username before you confirm. If you sent to the wrong person, ask them
              to send it back.
            </Callout>
          </Section>

          <Section id="requests" title="Requests" lead="Ask someone to pay you a set amount. They pay or decline in one tap.">
            <Bullets
              items={[
                <>Go to <strong>Request</strong>, choose an @username, the amount and a note.</>,
                "The other person is notified and can pay (with their PIN) or decline.",
                "A request that is not answered expires after 7 days.",
                "Requests waiting on you are shown on Home.",
              ]}
            />
          </Section>

          <Section id="qr" title="QR payments" lead="Get paid in person by showing a code.">
            <Bullets
              items={[
                <><strong>Open QR</strong>: on <strong>Receive</strong>, show your code. The payer chooses the amount.</>,
                <><strong>Merchant mode</strong>: set a fixed amount and the code carries it, so the customer only confirms.</>,
                <>To pay, open <strong>Scan</strong>, point the camera at the code, check the details and confirm with your PIN.</>,
              ]}
            />
          </Section>

          <Section id="circles" title="Circles" lead="A circle is a group of people who pay each other often: flatmates, a team, family.">
            <Steps
              items={[
                <>Go to <strong>Circles</strong> and choose <strong>New circle</strong>.</>,
                "Name it and add members by @username. Members must already have Coven accounts.",
                "Everyone in the circle sees its activity feed: sends, splits and goals.",
              ]}
            />
            <p>
              Inside a circle you can send to one member or to everyone. Sending to everyone makes one payment per member, and each
              needs your PIN. Bill splits and savings goals also live inside a circle.
            </p>
          </Section>

          <Section id="splits" title="Bill splits" lead="Split a bill and let an escrow contract collect it. You are paid once everyone has paid.">
            <p>
              Splits run on the <strong>SplitEscrow</strong> contract. Each split gets its own small custody contract, so money in
              one split is never mixed with another.
            </p>
            <Steps
              items={[
                <>Open a circle and choose <strong>New bill split</strong>.</>,
                "Describe it, enter the total, and choose who owes what. Confirm with your PIN; this creates the split on-chain with you as the recipient.",
                "Each member opens the split and pays their share with their PIN. The money is held in escrow, not sent to you yet.",
                "When the last share is paid, the escrow pays you the full amount automatically.",
              ]}
            />
            <H3>If not everyone pays</H3>
            <Bullets
              items={[
                "A split has a deadline: 72 hours by default, up to 30 days.",
                "The creator can cancel an open split at any time.",
                "After the deadline anyone can expire it.",
                "Once a split is cancelled or expired, each member who paid claims their own refund from the split.",
              ]}
            />
            <Table
              head={["Rule", "Value"]}
              rows={[
                ["Members per split", "Up to 50"],
                ["Deadline", "72 hours by default, 1 hour to 30 days"],
                ["Who receives", "The split's creator, who does not owe a share"],
                ["A member pays", "Exactly their share, once"],
              ]}
            />
          </Section>

          <Section id="goals" title="Savings goals" lead="Save toward a shared target. Nobody, including the creator, can take the money out alone.">
            <p>
              Goals run on the <strong>GoalPool</strong> contract. Like splits, each goal has its own custody contract.
            </p>
            <Steps
              items={[
                <>Open a circle and choose <strong>New savings goal</strong>. Enter what you are saving for and a target, then confirm with your PIN.</>,
                "Any member contributes any amount, as often as they like, with their PIN.",
                "When it is time to spend, one member requests a withdrawal to a recipient. That request counts as their approval.",
                "Every other member approves the same recipient and amount. When the last approval lands, the money is released automatically.",
              ]}
            />
            <H3>Rules that protect the pot</H3>
            <Bullets
              items={[
                "Only one withdrawal request can be open at a time. The person who requested it can cancel it.",
                "Contributions pause while a withdrawal is waiting for approval.",
                "Each approval names the recipient and amount. If the request is different from what you were shown, your approval is refused.",
                "If someone stops responding, any member can start an exit. After a 30-day countdown the goal can be dissolved and every member claims back exactly what they put in. The member who started the exit can cancel it.",
              ]}
            />
          </Section>

          <Section id="activity" title="History & notifications" lead="Everything that moves through your account, in real time.">
            <Bullets
              items={[
                <><strong>History</strong> lists your sends, receipts, requests, splits and cash outs, with filters and in/out totals.</>,
                "The bell shows notifications: payments received, requests, split and goal updates, approvals waiting on you.",
                "Balances and feeds update live without refreshing the page.",
                "Money sent to your address from outside Coven (for example the faucet) appears as a deposit.",
              ]}
            />
          </Section>

          <Section id="invites" title="Invites" lead="Share your invite link and see who joined through it.">
            <p>
              Your link is in <strong>Settings</strong> and looks like <Code>/r/yourname</Code>. Someone who signs up through it is
              recorded as invited by you, once, and only for a new account. You cannot invite yourself. Your invite count is shown in
              Settings. A friend who joins through your link and sets up a wallet completes your Invite stage.
            </p>
          </Section>

          <Section id="cashout" title="Cash out" lead="Turn USDC into local currency in a bank account. Not part of the testnet.">
            <p>
              Cash out sends USDC to Coven's collection wallet and pays local currency into your bank account through Yellow Card.
              It covers Nigeria (NGN), Ghana (GHS), Kenya (KES) and South Africa (ZAR). Coven charges 1%, shown before you confirm,
              plus the exchange rate quoted by Yellow Card. Bank account numbers are encrypted before they are stored.
            </p>
            <Callout title="On testnet">Cash out is switched off on testnet, because testnet USDC has no value to pay out.</Callout>
          </Section>

          <Section id="cross-chain" title="Cross-chain payments" lead="Paying in from Ethereum, Base, Polygon and other chains. Coming later.">
            <p>
              Coven uses Circle&apos;s CCTP to move USDC from another chain to Arc: the USDC is burned on the source chain and minted
              on Arc, so there is no bridge or wrapped token. The relay and attestation are built; the screen for paying from an
              outside wallet is still in progress. Cross-chain payments carry a 0.5% fee.
            </p>
          </Section>

          {/* ======================================================= REFERENCE */}

          <Section id="fees" title="Fees & limits" lead="What things cost and the limits the contracts enforce.">
            <Table
              head={["Action", "Coven fee", "Network fee"]}
              rows={[
                ["Send, request, QR, circle send", "None", "About $0.01"],
                ["Create or pay a bill split", "None", "About $0.01"],
                ["Create, contribute to or withdraw from a goal", "None", "About $0.01"],
                ["Cross-chain payment in (coming)", "0.5%", "Source chain fee"],
                ["Cash out to a bank (not on testnet)", "1%", "About $0.01, plus Yellow Card's rate"],
              ]}
            />
            <Table
              head={["Limit", "Value"]}
              rows={[
                ["@username length", "3 to 20 characters"],
                ["Request expiry", "7 days"],
                ["Members per bill split", "50"],
                ["Bill split deadline", "1 hour to 30 days (default 72 hours)"],
                ["Open withdrawal requests per goal", "1"],
                ["Goal exit countdown", "30 days"],
              ]}
            />
          </Section>

          <Section id="how-it-works" title="How a payment works" lead="From your PIN to the other person's balance in under a second.">
            <Steps
              items={[
                <><strong>Send.</strong> You choose an @username and an amount and enter your PIN.</>,
                <><strong>Sign.</strong> Your device completes a Circle PIN challenge and signs the transfer. The server never sees your PIN and cannot start a transfer for you.</>,
                <><strong>Settle.</strong> The transaction lands on Arc. It is final on inclusion.</>,
                <><strong>Verify.</strong> The server fetches the transaction from Circle and the chain itself and checks the wallet, recipient and amount before recording anything. A made-up transaction id is refused, and one transaction can only be recorded once.</>,
                <><strong>Notify.</strong> Both sides see the payment immediately in their feed, balance and notifications.</>,
              ]}
            />
            <p>
              Splits and goals work the same way: your PIN signs the contract call, then the server reads the result from the chain
              (the events the contract emitted) and records only what the chain says happened.
            </p>
          </Section>

          <Section id="security" title="Security" lead="Your money stays under your control, and the app records only what the chain confirms.">
            <Bullets
              items={[
                <><strong>Non-custodial wallets.</strong> Wallets are user-controlled Circle Programmable Wallets. Coven stores no private keys and cannot move your funds without your PIN.</>,
                <><strong>Server-verified settlement.</strong> Nothing is marked paid because the app said so; it is checked on-chain first.</>,
                <><strong>Escrow and unanimous approval.</strong> Split money waits in escrow until everyone has paid. Goal money needs every member&apos;s approval to leave.</>,
                <><strong>Isolated custody.</strong> Each split and each goal holds its money in its own contract, so a problem with one cannot freeze another.</>,
                <><strong>Approvals bound to details.</strong> Paying a split or approving a goal withdrawal names the recipient and amount; a mismatch is refused on-chain.</>,
                <><strong>Encrypted bank details.</strong> Account numbers are encrypted with AES-256-GCM before storage.</>,
                <><strong>Row-level security.</strong> Database rules limit every read and write to the signed-in user.</>,
                <><strong>Network guard.</strong> A mainnet deployment refuses to run with testnet settings left in, and a testnet one refuses a live Circle key.</>,
              ]}
            />
            <Callout tone="warn" title="Protect yourself">
              Coven will never ask for your PIN, a one-time code or a seed phrase, in a message or anywhere else. Anyone who does is
              not Coven.
            </Callout>
          </Section>

          <Section id="contracts" title="Smart contracts" lead={`Coven's contracts on ${NETWORK_LABEL}. Written in Solidity 0.8.24 with OpenZeppelin, tested with Foundry.`}>
            <Table
              head={["Contract", "Address", "Used for"]}
              rows={[
                ["SplitEscrow", <Address key="s" value={SPLIT_ESCROW} />, "Bill splits"],
                ["GoalPool", <Address key="g" value={GOAL_POOL} />, "Savings goals"],
                ["PayCircle", <Address key="p" value={PAYCIRCLE} />, "Fee-bearing sends (deployed, not yet used by the app)"],
                ["USDC (ERC-20, 6 decimals)", <Address key="u" value={USDC} />, "The money itself"],
              ]}
            />
            <H3>SplitEscrow</H3>
            <p>Holds each member&apos;s share until the split is complete, then pays the recipient. Refunds are pulled by each member.</p>
            <Table
              head={["Function", "Who", "What it does"]}
              rows={[
                [<Code key="1">createSplit(members, amounts, recipient, description, deadlineHours)</Code>, "Creator", "Opens a split and deploys its custody contract"],
                [<Code key="2">pay(splitId, expectedRecipient, expectedAmount)</Code>, "Member", "Pays your share; reverts if the details differ"],
                [<Code key="3">cancel(splitId)</Code>, "Creator", "Closes an open split so payers can claim refunds"],
                [<Code key="4">expire(splitId)</Code>, "Anyone", "Closes a split after its deadline"],
                [<Code key="5">claimRefund(splitId)</Code>, "Member who paid", "Returns your share from a closed split"],
              ]}
            />
            <p>
              Events: <Code>SplitCreated</Code>, <Code>MemberPaid</Code>, <Code>SplitComplete</Code>, <Code>SplitCancelled</Code>,{" "}
              <Code>Refunded</Code>.
            </p>
            <H3>GoalPool</H3>
            <p>Pools contributions toward a target. Funds leave only by unanimous approval, or through the time-locked exit.</p>
            <Table
              head={["Function", "Who", "What it does"]}
              rows={[
                [<Code key="1">createGoal(members, targetAmount, description)</Code>, "Creator", "Opens a goal and deploys its custody contract"],
                [<Code key="2">contribute(goalId, amount)</Code>, "Member", "Adds USDC to the pot"],
                [<Code key="3">requestWithdrawal(goalId, recipient)</Code>, "Member", "Proposes releasing the pot to a recipient"],
                [<Code key="4">approveWithdrawal(withdrawalId, recipient, amount)</Code>, "Member", "Approves; the last approval releases the funds"],
                [<Code key="5">cancelWithdrawalRequest(withdrawalId)</Code>, "Requester", "Withdraws the proposal"],
                [<Code key="6">startExit(goalId) / cancelExit(goalId)</Code>, "Member", "Starts or stops the exit countdown"],
                [<Code key="7">dissolve(goalId)</Code>, "Member", "Closes the goal after the countdown"],
                [<Code key="8">claimRefund(goalId)</Code>, "Member", "Returns your own contributions after dissolving"],
              ]}
            />
            <p>
              Events: <Code>GoalCreated</Code>, <Code>Contributed</Code>, <Code>WithdrawalRequested</Code>,{" "}
              <Code>WithdrawalApproved</Code>, <Code>WithdrawalExecuted</Code>, <Code>WithdrawalCancelled</Code>,{" "}
              <Code>ExitStarted</Code>, <Code>ExitCancelled</Code>, <Code>GoalCancelled</Code>, <Code>Refunded</Code>.
            </p>
            <H3>PayCircle</H3>
            <p>
              Fee-bearing single and group payments (up to 50 recipients) and cash-out fee collection. Fees go to a separate custody
              contract and are withdrawn by an owner wallet that is not a server key. It is deployed but the app does not route
              payments through it yet.
            </p>
          </Section>

          <Section id="network" title="Arc network" lead="Details for wallets, explorers and developers.">
            <Table
              head={["Setting", "Value"]}
              rows={[
                ["Network", NETWORK_LABEL],
                ["Chain ID", String(ARC_CHAIN_ID)],
                ...(IS_TESTNET ? [["RPC", <Code key="r">https://rpc.testnet.arc.network</Code>]] : []),
                ...(EXPLORER ? [["Explorer", <Ext key="e" href={EXPLORER}>{EXPLORER.replace(/^https?:\/\//, "")}</Ext>]] : []),
                ["Gas token", "USDC"],
                ["Block time", "About 0.5 seconds, final on inclusion"],
                ["Typical fee", "About $0.01"],
              ]}
            />
            <Callout title="USDC has two faces on Arc">
              Native USDC (used for gas) has 18 decimals; the ERC-20 interface at <Code>0x3600…0000</Code> has 6. They are the same
              money. Coven and its contracts always use the 6-decimal ERC-20 interface.
            </Callout>
          </Section>

          {/* ====================================================== DEVELOPERS */}

          <Section id="architecture" title="Architecture" lead="A Next.js app, a Postgres database, Circle wallets and three contracts on Arc.">
            <CodeBlock>{`Next.js 16 app (mobile-first PWA)
  Home · Send · Request · QR · Circles · Goals · Cash out
        │  REST + Supabase Realtime
Next.js API routes (server)
  PIN challenges · on-chain verification · CCTP relay
   │                 │                    │
Supabase          Circle               Arc
 Postgres          Programmable         SplitEscrow · GoalPool
 Realtime          Wallets, CCTP v2     PayCircle · USDC
 Storage                │
                   Yellow Card (cash out)`}</CodeBlock>
            <Table
              head={["Layer", "Choice"]}
              rows={[
                ["Frontend", "Next.js 16 (App Router), React 19, Tailwind CSS 4"],
                ["Backend", "Next.js API routes"],
                ["Database", "Supabase: Postgres, Realtime, Storage, row-level security"],
                ["Auth", "Supabase Auth with Google"],
                ["Wallets", "Circle Programmable Wallets, user-controlled"],
                ["Chain", `Arc (chain ${ARC_CHAIN_ID}), USDC as gas`],
                ["Cross-chain", "Circle CCTP v2 (Arc is domain 26)"],
                ["Cash out", "Yellow Card"],
                ["Contracts", "Solidity 0.8.24, OpenZeppelin, Foundry"],
              ]}
            />
          </Section>

          <Section id="run-locally" title="Run it locally" lead="Requires Node 22 or 24, pnpm, a Supabase project and a Circle developer account. Foundry for the contracts.">
            <CodeBlock>{`git clone ${GITHUB}.git
cd Coven/frontend
pnpm install
cp .env.example .env.local   # fill it in; every key is documented there
pnpm dev                     # http://localhost:3000`}</CodeBlock>
            <Bullets
              items={[
                <><strong>Database:</strong> in the Supabase SQL editor run <Code>supabase/schema.sql</Code>, then each file in <Code>supabase/migrations/</Code> in number order.</>,
                <><strong>Auth:</strong> enable the Google provider in Supabase, and allow <Code>{"<app url>/auth/callback"}</Code> as a redirect URL.</>,
                <><strong>Tests:</strong> <Code>pnpm test</Code> runs the API route tests; the contract-backed ones need Foundry.</>,
                <><strong>Contracts:</strong> <Code>cd contract && forge install && forge test</Code>. Deploy scripts need <Code>--legacy</Code> on Arc.</>,
              ]}
            />
          </Section>

          <Section id="api" title="API routes" lead="The server routes the app calls. Routes that act for a user need the user's Supabase session token.">
            <p>
              Money-moving actions are two steps: a <Code>…-challenge</Code> route builds the transaction and returns a Circle
              challenge for the user&apos;s PIN, and a <Code>…-confirm</Code> route verifies the result on-chain and records it.
            </p>
            <Table
              head={["Area", "Routes"]}
              rows={[
                ["Account", <Code key="a">/api/me · /api/users/create · /api/users/search · /api/users/[username] · /api/profile/avatar</Code>],
                ["Wallet", <Code key="w">/api/circle/init · /api/circle/complete · /api/circle/status · /api/circle/transfer-challenge · /api/balance</Code>],
                ["Payments", <Code key="p">/api/payments/send · /api/payments/request · /api/payments/[requestId]/pay · /api/payments/[requestId]/reject</Code>],
                ["Circles", <Code key="c">/api/circles · /api/circles/create · /api/circles/[id] · /api/circles/[id]/send</Code>],
                ["Splits", <Code key="s">/api/splits/create-challenge · create-confirm · [splitId]/pay-challenge · pay-confirm · action-challenge · action-confirm</Code>],
                ["Goals", <Code key="g">/api/goals/create-challenge · create-confirm · [goalId]/contribute-* · withdraw-request-* · withdraw-approve-* · action-*</Code>],
                ["Activity", <Code key="h">/api/activity · /api/history · /api/history/export · /api/notifications · /api/notifications/unread-count</Code>],
                ["Invites", <Code key="r">/api/referrals · /api/referrals/claim</Code>],
                ["Cash out", <Code key="o">/api/banks · /api/cashout/initiate · /api/cashout/[payoutId]/status</Code>],
                ["Public", <Code key="t">/api/health</Code>],
                ["Core team", <Code key="tt">/api/testnet</Code>],
              ]}
            />
          </Section>

          <Section id="operations" title="Health & operations" lead="Two endpoints for running the testnet.">
            <H3>GET /api/health</H3>
            <p>
              Checks the configuration, the database and its migrations, the Arc RPC, the deployed contracts, the Circle API key,
              the relayer&apos;s gas and whether cash out is configured. Answers <Code>200</Code> when every critical check passes and{" "}
              <Code>503</Code> when one fails, so an uptime monitor can watch it directly. Anyone sees only{" "}
              <Code>{'{ "ok": true }'}</Code>; the per-check detail needs the operator token (<Code>HEALTH_TOKEN</Code>, sent as a bearer
              token).
            </p>
            <H3>GET /api/testnet</H3>
            <p>
              The data behind the tracker: totals, stage counts, every tester&apos;s progress and the latest 100 transactions. Rebuilt
              at most every 30 seconds. It needs the team access code (<Code>TESTNET_ACCESS_CODE</Code>, sent as the{" "}
              <Code>x-access-code</Code> header) or a sign-in whose email is in <Code>TESTNET_TEAM_EMAILS</Code>. Without either
              it answers <Code>401</Code>; a wrong code answers <Code>403</Code>.
            </p>
            <H3>Daily checklist during the testnet</H3>
            <Bullets
              items={[
                <><Code>/api/health</Code> returns <Code>{'"ok": true'}</Code>.</>,
                "The relayer wallet still holds testnet USDC.",
                "Someone on the team runs the full flow once: sign up, fund, circle, send, split, goal.",
                "New bug reports are triaged.",
              ]}
            />
          </Section>

          {/* ============================================================ HELP */}

          <Section id="faq" title="FAQ & troubleshooting">
            <Faq q="My faucet USDC is not showing.">
              Check that you pasted the address from Coven&apos;s <strong>Receive</strong> screen and chose Arc Testnet on the faucet.
              Look the address up on the explorer. If the USDC is there, refresh Home.
            </Faq>
            <Faq q="The faucet says I have hit a limit.">
              Circle&apos;s faucet limits how often you can claim. Try again later, or ask another tester to send you a few USDC by
              @username.
            </Faq>
            <Faq q="I forgot my PIN.">
              Only you know your PIN, and nobody at Coven can reset it. Keep it somewhere safe when you set it.
            </Faq>
            <Faq q="A payment left my wallet but Coven does not show it.">
              Find the transaction on the explorer and report it with the transaction hash and your @username.
            </Faq>
            <Faq q="I sent money to the wrong person.">
              Payments are final. Ask the person to send it back.
            </Faq>
            <Faq q="I cannot contribute to a goal.">
              Contributions pause while a withdrawal is waiting for approval. Approve it, or ask the requester to cancel it.
            </Faq>
            <Faq q="My split never completed.">
              It completes only when everyone has paid. After the deadline (or if the creator cancels) every member who paid can
              claim a refund from the split.
            </Faq>
            <Faq q="Someone in my goal stopped responding.">
              Start an exit. After 30 days the goal can be dissolved and everyone claims back what they put in.
            </Faq>
            <Faq q="How do I check my progress?">
              Open <strong>Settings → Testnet</strong> to see which stages you have ticked. It updates within a minute of each
              transaction. If you think something was missed, ask in the Telegram group with your @username.
            </Faq>
            <Faq q="Do I need ETH or another token for gas?">No. On Arc the fee is paid in USDC, about a cent.</Faq>
            <Faq q="Is testnet USDC worth anything?">No. It is free and only exists for testing.</Faq>
          </Section>

          <Section id="bugs" title="Reporting a bug" lead="A good report gets fixed fast.">
            <p>
              Post in the official <Ext href={TELEGRAM_URL}>Telegram group</Ext> or open an
              issue on <Ext href={`${GITHUB}/issues`}>GitHub</Ext>, and include:
            </p>
            <Steps
              items={[
                "Your @username.",
                "What you were doing and what you expected.",
                "What happened instead. A screenshot helps.",
                "The transaction hash or explorer link, if there is one.",
                "Your device and browser.",
              ]}
            />
            <Callout tone="warn" title="Never share your PIN">A bug report never needs your PIN. Anyone asking for it is not Coven.</Callout>
          </Section>

          <Section id="glossary" title="Glossary">
            <Table
              head={["Term", "Meaning"]}
              rows={[
                ["Arc", "The blockchain Coven runs on, built for payments, with USDC as its gas token"],
                ["USDC", "A dollar stablecoin issued by Circle. 1 USDC is designed to equal $1"],
                ["Testnet", "A practice network with free tokens that have no value"],
                ["Faucet", "A site that hands out free testnet tokens"],
                ["Wallet address", "Your account's public identifier on-chain, starting with 0x"],
                ["PIN", "The code that approves every payment from your wallet"],
                ["Circle", "A group in Coven (not to be confused with Circle the company)"],
                ["Escrow", "A contract that holds money until agreed conditions are met"],
                ["Transaction hash", "The unique id of a transaction, used to find it on the explorer"],
                ["Explorer", "A website that shows every transaction and address on the chain"],
                ["CCTP", "Circle's protocol for moving USDC between chains by burning and minting"],
                ["Gas", "The network fee for a transaction; on Arc it is paid in USDC"],
              ]}
            />
          </Section>

          <Section id="roadmap" title="Roadmap" lead="What comes after the testnet.">
            <Bullets
              items={[
                "Paying in from other chains in the app (the CCTP relay is already built).",
                "Cash-out fees settled on-chain through PayCircle.",
                "Push and SMS notifications alongside the in-app feed.",
                "Cash out in more countries beyond Nigeria, Ghana, Kenya and South Africa.",
                "Mainnet launch on Arc.",
              ]}
            />
          </Section>
        </main>
      </div>
    </div>
  );
}

const KIND_MEANING: Record<TxKind, string> = {
  send: "USDC sent to an @username",
  group_send: "USDC sent to a member inside a circle",
  split_create: "A bill split was opened",
  split_pay: "A member paid their share of a split",
  goal_create: "A savings goal was opened",
  goal_contribute: "USDC put into a goal",
  goal_payout: "A goal released its funds",
  deposit: "USDC arrived from outside Coven, such as the faucet",
};

function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl border border-line bg-surface px-4 py-3 open:shadow-e1">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-ink">
        {q}
        <span className="text-ink-mute transition-transform group-open:rotate-45" aria-hidden="true">+</span>
      </summary>
      <div className="mt-2 text-sm leading-relaxed text-ink-soft">{children}</div>
    </details>
  );
}
