import Link from "next/link";

/* Landing page */
export default function Landing() {
  return (
    <div className="mx-auto w-full max-w-md flex-1 flex flex-col px-6 py-10">
      <header className="flex items-center justify-between">
        <span className="font-extrabold text-xl tracking-tight">
          Pay<span className="text-primary">Circle</span>
        </span>
        <Link href="/signup" className="text-sm text-accent font-semibold">
          Sign in
        </Link>
      </header>

      <main className="flex-1 flex flex-col justify-center gap-8 py-12">
        <div>
          <h1 className="text-4xl font-extrabold leading-tight">
            Send to anyone.
            <br />
            From <span className="text-primary">any chain</span>.
            <br />
            Cash out <span className="text-accent">anywhere</span>.
          </h1>
          <p className="mt-4 text-text-2">
            Social USDC payments built on Arc. Get a @username, pay friends in
            under 500ms, split bills with your circles, and cash out to your
            local bank in 20+ countries.
          </p>
        </div>

        <ul className="space-y-3 text-sm">
          {[
            ["⚡", "Payments settle on Arc in under 500ms"],
            ["🌍", "Pay from Ethereum, Base, Polygon — CCTP routes it invisibly"],
            ["🏦", "Cash out USDC to NGN, GHS, KES and more via Yellow Card"],
            ["👥", "Circles: split bills, collect from groups, see who's paid"],
            ["🔑", "No seed phrase. No extension. Just your @username"],
          ].map(([icon, text]) => (
            <li key={text} className="flex items-start gap-3">
              <span className="text-lg">{icon}</span>
              <span className="text-text-2">{text}</span>
            </li>
          ))}
        </ul>

        <Link
          href="/signup"
          className="rounded-full bg-primary hover:bg-primary-hover text-white text-center font-semibold py-4 transition-colors"
        >
          Get your @username
        </Link>
      </main>

      <footer className="text-center text-xs text-text-2/60">
        Built on Arc · USDC native · Circle × Yellow Card
      </footer>
    </div>
  );
}
