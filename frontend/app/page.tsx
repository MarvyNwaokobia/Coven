import Link from "next/link";
import Reveal from "@/components/Reveal";
import {
  CovenMark,
  SendIcon,
  RequestIcon,
  ReceiveIcon,
  CashoutIcon,
  UserGroupIcon,
  LockIcon,
  BoltIcon,
  GlobeIcon,
  ShieldIcon,
  TargetIcon,
  ChevronRightIcon,
  CheckCircleIcon,
} from "@/components/Icons";

/* ============================================================================
   Marketing landing page.
   Server component. Motion is CSS and observer driven, interaction is hover/
   focus state, so it stays fast and works with reduced-motion.
   ========================================================================== */

const STEPS = [
  {
    n: "01",
    title: "Claim your @handle",
    body: "Sign in with Google and pick a username. A wallet is provisioned for you on Arc. No seed phrase, just a PIN only you know.",
    icon: LockIcon,
  },
  {
    n: "02",
    title: "Get paid from anywhere",
    body: "Share @yourname or a QR. Friends pay from Ethereum, Base or Polygon and CCTP routes it to Arc invisibly. They never think about chains.",
    icon: GlobeIcon,
  },
  {
    n: "03",
    title: "Spend it or cash out",
    body: "Split bills with your circle, save toward a shared goal, or withdraw straight to your bank account in local currency.",
    icon: CashoutIcon,
  },
];

const FEATURES = [
  {
    icon: BoltIcon,
    title: "Sub-500ms settlement",
    body: "Payments finalise on Arc before you've put your phone away. Peer-to-peer transfers cost nothing in gas.",
  },
  {
    icon: GlobeIcon,
    title: "Any chain in, Arc out",
    body: "Circle's CCTP burns on the source chain and mints on Arc. One balance, no bridging UI, no wrapped tokens.",
  },
  {
    icon: UserGroupIcon,
    title: "Circles, not contacts",
    body: "Group your crew, team or family. Split a bill evenly in two taps and watch who's paid in real time.",
  },
  {
    icon: TargetIcon,
    title: "Shared savings goals",
    body: "Pool USDC toward something together. Withdrawals need every member's approval, enforced on-chain rather than by trust.",
  },
  {
    icon: CashoutIcon,
    title: "Cash out to real banks",
    body: "Yellow Card settles USDC to NGN, GHS, KES and more across 20+ countries, usually within a business day.",
  },
  {
    icon: ShieldIcon,
    title: "Keys stay yours",
    body: "Circle user-controlled wallets mean your PIN unlocks your funds. Coven can't move money without you.",
  },
];

const CURRENCIES = ["NGN", "GHS", "KES", "ZAR", "UGX", "TZS", "XOF", "ZMW"];
const CHAINS = ["Ethereum", "Base", "Polygon", "Arbitrum", "Avalanche", "Optimism"];

export default function Landing() {
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      {/* --------------------------------------------------------- Nav bar */}
      <header className="sticky top-0 z-50 border-b border-line bg-canvas/85 backdrop-blur-lg">
        <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 transition-opacity hover:opacity-70"
          >
            <CovenMark className="h-7 w-7 text-accent" />
            <span className="text-lg font-extrabold tracking-tight">Coven</span>
          </Link>

          <div className="ml-auto hidden items-center gap-1 md:flex">
            {[
              { href: "#how", label: "How it works" },
              { href: "#features", label: "Features" },
              { href: "#cashout", label: "Cash out" },
            ].map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="underline-grow rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft transition-colors duration-200 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <Link
              href="/signup"
              className="hidden rounded-full px-4 py-2 text-sm font-semibold text-ink-soft transition-colors duration-200 hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:block"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="sheen inline-flex min-h-10 items-center rounded-full bg-brand px-4 text-sm font-semibold text-white shadow-e1 transition-[background-color,box-shadow,translate,scale] duration-200 ease-out-soft hover:-translate-y-0.5 hover:bg-brand-hover hover:shadow-e2 active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>

      {/* ----------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="animate-drift pointer-events-none absolute -top-40 left-1/2 h-96 w-5xl max-w-[130vw] -translate-x-1/2 rounded-full bg-accent/8 blur-3xl"
        />

        <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10 lg:px-8 lg:py-24">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-line bg-accent-soft px-3 py-1.5 text-xs font-bold text-accent">
              <BoltIcon className="h-3.5 w-3.5" />
              Sub-500ms USDC payments on Arc
            </span>

            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-balance text-ink sm:text-5xl lg:text-6xl">
              Send money to a name, not an{" "}
              <span className="text-accent">address</span>.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-soft lg:text-lg">
              Coven is a social payments app built on USDC. Claim an @handle, get
              paid from any chain, split bills with your circle, and withdraw to
              your bank account, without ever touching a seed phrase.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="sheen group inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-brand px-7 text-[0.9375rem] font-semibold text-white shadow-e2 transition-[background-color,box-shadow,translate,scale] duration-200 ease-out-soft hover:-translate-y-0.5 hover:bg-brand-hover hover:shadow-e4 active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                Claim your @handle
                <ChevronRightIcon className="h-4 w-4 transition-transform duration-200 ease-out-soft group-hover:translate-x-1" />
              </Link>
              <a
                href="#how"
                className="inline-flex min-h-13 items-center justify-center rounded-full border border-line-strong bg-surface px-7 text-[0.9375rem] font-semibold text-ink shadow-e1 transition-[background-color,border-color,box-shadow,translate,scale] duration-200 ease-out-soft hover:-translate-y-0.5 hover:border-ink hover:bg-surface-2 hover:shadow-e2 active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                See how it works
              </a>
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2">
              {["No seed phrase", "No gas on P2P", "Cash out in 20+ countries"].map((t) => (
                <li key={t} className="flex items-center gap-1.5 text-sm font-medium text-ink-soft">
                  <CheckCircleIcon className="h-4 w-4 shrink-0 text-pos" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Product preview: the actual app, not an abstract graphic. */}
          <AppPreview />
        </div>
      </section>

      {/* ------------------------------------------------------ Chain strip */}
      <section className="border-y border-line bg-surface" aria-label="Supported networks">
        <Reveal className="mx-auto max-w-6xl px-5 py-8 lg:px-8">
          <p className="text-center text-xs font-bold uppercase tracking-[0.14em] text-ink-mute">
            Accepts USDC from
          </p>
          <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2.5">
            {CHAINS.map((c) => (
              <li
                key={c}
                className="cursor-default rounded-full border border-line bg-canvas px-4 py-2 text-sm font-semibold text-ink-soft transition-[translate,scale,border-color,color,box-shadow] duration-200 ease-out-soft hover:-translate-y-0.5 hover:border-accent-line hover:text-ink hover:shadow-e1"
              >
                {c}
              </li>
            ))}
            <li className="cursor-default rounded-full border border-accent-line bg-accent-soft px-4 py-2 text-sm font-bold text-accent transition-transform duration-200 ease-out-soft hover:-translate-y-0.5">
              → settles on Arc
            </li>
          </ul>
        </Reveal>
      </section>

      {/* -------------------------------------------------- How it works */}
      <section id="how" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-24">
          <Reveal className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-balance lg:text-4xl">
              Three steps from signup to spending
            </h2>
            <p className="mt-4 text-base leading-relaxed text-ink-soft">
              The crypto part is real, but you never have to see it. No networks
              to pick, no bridges to approve, no addresses to paste.
            </p>
          </Reveal>

          <ol className="mt-12 grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <Reveal as="li" key={s.n} delay={i * 110}>
                  <div className="group relative h-full rounded-2xl border border-line bg-surface p-6 shadow-e1 transition-[border-color,box-shadow,translate,scale] duration-300 ease-out-soft hover:-translate-y-1.5 hover:border-accent-line hover:shadow-e3">
                    <div className="flex items-center justify-between">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-white transition-[background-color,translate,scale] duration-300 ease-spring group-hover:scale-110 group-hover:bg-accent">
                        <Icon className="h-5 w-5 transition-transform duration-300 ease-spring group-hover:-rotate-6" />
                      </span>
                      <span className="tnum text-2xl font-extrabold text-surface-3 transition-[color,translate,scale] duration-300 ease-out-soft group-hover:-translate-y-0.5 group-hover:text-accent-line">
                        {s.n}
                      </span>
                    </div>
                    <h3 className="mt-5 text-lg font-bold tracking-tight transition-colors duration-300 group-hover:text-accent">
                      {s.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.body}</p>
                  </div>
                </Reveal>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------- Features */}
      <section id="features" className="scroll-mt-20 border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-24">
          <Reveal className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Features</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-balance lg:text-4xl">
              Built for how people actually move money
            </h2>
          </Reveal>

          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <Reveal as="li" key={f.title} delay={(i % 3) * 90}>
                  <div className="group h-full rounded-2xl border border-line bg-canvas p-6 transition-[border-color,background-color,box-shadow,translate,scale] duration-300 ease-out-soft hover:-translate-y-1.5 hover:border-accent-line hover:bg-surface hover:shadow-e2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent transition-[background-color,color,translate,scale] duration-300 ease-spring group-hover:scale-110 group-hover:bg-accent group-hover:text-white">
                      <Icon className="h-5 w-5 transition-transform duration-300 ease-spring group-hover:rotate-6" />
                    </span>
                    <h3 className="mt-4 font-bold tracking-tight transition-colors duration-300 group-hover:text-accent">
                      {f.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{f.body}</p>
                  </div>
                </Reveal>
              );
            })}
          </ul>
        </div>
      </section>

      {/* -------------------------------------------------------- Cash out */}
      <section id="cashout" className="scroll-mt-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-24">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Cash out</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-balance lg:text-4xl">
              USDC in. Local currency in your bank account.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-ink-soft">
              Add your bank once. Coven quotes you the rate and the 1% fee up
              front, then settles through Yellow Card. No separate exchange
              account, no P2P traders, no guessing what lands.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Rate and fee shown before you confirm",
                "Typically 1–2 business days to arrive",
                "Payout status tracked in your history",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm font-medium text-ink-soft">
                  <CheckCircleIcon className="mt-px h-4.5 w-4.5 shrink-0 text-pos" />
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={120} className="rounded-2xl border border-line bg-surface p-6 shadow-e2 lg:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-mute">
              Supported payout currencies
            </p>
            <ul className="mt-4 grid grid-cols-4 gap-2.5">
              {CURRENCIES.map((c) => (
                <li
                  key={c}
                  className="cursor-default rounded-lg border border-line bg-canvas py-3 text-center text-sm font-bold text-ink transition-[background-color,border-color,color,translate,scale,box-shadow] duration-200 ease-out-soft hover:-translate-y-0.5 hover:border-accent-line hover:bg-accent-soft hover:text-accent hover:shadow-e1"
                >
                  {c}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-ink-mute">
              …and more across 20+ countries via Yellow Card.
            </p>

            <div className="mt-6 rounded-xl border border-line bg-canvas p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-ink-soft">You cash out</span>
                <span className="amount font-bold text-ink">$250.00 USDC</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="font-medium text-ink-soft">Fee (1%)</span>
                <span className="amount font-semibold text-ink-soft">−$2.50</span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                <span className="text-sm font-bold text-ink">You receive</span>
                <span className="amount text-lg font-extrabold text-pos">₦371,250</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------ Final CTA */}
      <section className="px-5 pb-16 lg:px-8 lg:pb-24">
        <Reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-brand px-6 py-14 text-center shadow-e3 lg:px-8 lg:py-20">
          <div
            aria-hidden="true"
            className="animate-drift pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-accent/25 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="animate-drift pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-white/5 blur-3xl"
            style={{ animationDelay: "-5s" }}
          />
          <div className="relative">
            <h2 className="text-3xl font-extrabold tracking-tight text-balance text-white lg:text-4xl">
              Your @handle is still available.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/70">
              Sign in with Google, pick a username, set a PIN. You'll be able to
              receive money in under a minute.
            </p>
            <Link
              href="/signup"
              className="sheen group mt-8 inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-white px-8 text-[0.9375rem] font-bold text-ink shadow-e2 transition-[translate,scale,box-shadow] duration-200 ease-out-soft hover:-translate-y-0.5 hover:shadow-e4 active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand"
            >
              Get started free
              <ChevronRightIcon className="h-4 w-4 transition-transform duration-200 ease-out-soft group-hover:translate-x-1" />
            </Link>
          </div>
        </Reveal>
      </section>

      {/* --------------------------------------------------------- Footer */}
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div className="flex items-center gap-2.5">
            <CovenMark className="h-6 w-6 text-accent" />
            <span className="font-extrabold tracking-tight">Coven</span>
          </div>
          <p className="text-sm text-ink-mute">
            Built on Arc · USDC native · Circle CCTP × Yellow Card
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ---------------------------------------------------------- App preview */

const PREVIEW_ROWS = [
  { name: "amara", label: "amara sent you", note: "rent split", amount: "+$120.00", positive: true },
  { name: "tunde", label: "You sent tunde", note: "jollof run", amount: "−$18.50", positive: false },
  { name: "Cash out", label: "Cash out completed", note: "to GTBank ····4471", amount: "−$250.00", positive: false },
];

/**
 * A static rendering of the real home screen. Static on purpose, so it loads
 * instantly and tells a first-time visitor what the product is in one glance.
 */
function AppPreview() {
  return (
    <div
      className="animate-fade-up group/preview relative mx-auto w-full max-w-sm lg:max-w-none"
      style={{ animationDelay: "120ms" }}
    >
      {/* Idle float sits on an inner wrapper so it doesn't fight the entrance
          animation or the hover lift below it. */}
      <div className="animate-float rounded-3xl border border-line bg-surface p-4 shadow-e4 transition-shadow duration-300 ease-out-soft hover:shadow-[0_28px_70px_rgba(10,25,47,0.22)] sm:p-5">
        {/* Balance card */}
        <div className="relative overflow-hidden rounded-2xl bg-brand p-5">
          <div
            aria-hidden="true"
            className="animate-drift pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-accent/30 blur-2xl"
          />
          <div className="relative">
            <p className="text-[0.625rem] font-bold uppercase tracking-[0.14em] text-white/55">
              Available balance
            </p>
            <p className="amount mt-2 text-3xl font-extrabold tracking-tight text-white">
              $1,284.50
              <span className="ml-1.5 align-middle text-xs font-semibold text-white/50">USDC</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="tnum rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[0.6875rem] font-semibold text-white/85">
                ≈ ₦1,926,750 NGN
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[0.6875rem] font-semibold text-white/85">
                <BoltIcon className="h-3 w-3" />
                Arc
              </span>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[
            { label: "Send", icon: SendIcon },
            { label: "Request", icon: RequestIcon },
            { label: "Receive", icon: ReceiveIcon },
            { label: "Cash out", icon: CashoutIcon },
          ].map((a) => {
            const Icon = a.icon;
            return (
              <div
                key={a.label}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-canvas py-3"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-ink">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-[0.625rem] font-bold text-ink-soft">{a.label}</span>
              </div>
            );
          })}
        </div>

        {/* Activity */}
        <div className="mt-3 overflow-hidden rounded-xl border border-line">
          {PREVIEW_ROWS.map((r, i) => (
            <div
              key={r.label}
              className={`flex items-center gap-2.5 bg-canvas px-3 py-3 ${
                i > 0 ? "border-t border-line" : ""
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-bold ${
                  r.positive ? "bg-pos-soft text-pos" : "bg-surface-2 text-ink-soft"
                }`}
              >
                {r.positive ? <ReceiveIcon className="h-3.5 w-3.5" /> : <SendIcon className="h-3.5 w-3.5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-ink">{r.label}</span>
                <span className="block truncate text-[0.6875rem] text-ink-mute">{r.note}</span>
              </span>
              <span
                className={`amount shrink-0 text-xs font-bold ${
                  r.positive ? "text-pos" : "text-ink"
                }`}
              >
                {r.amount}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Floating proof chip, anchoring the speed claim to the visual. */}
      <div className="absolute -bottom-4 -left-3 hidden items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 shadow-e3 sm:flex">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pos-soft text-pos">
          <CheckCircleIcon className="h-3.5 w-3.5" />
        </span>
        <span className="text-xs font-bold text-ink">Settled in 412ms</span>
      </div>
    </div>
  );
}
