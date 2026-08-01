import Link from "next/link";
import { SendIcon, ReceiveIcon, CashoutIcon, CirclesIcon, LockIcon } from "@/components/Icons";

/* Sleek White & Deep Blue Fintech Landing page */
export default function Landing() {
  return (
    <div className="relative min-h-screen bg-slate-50/60 text-slate-900 flex flex-col antialiased">
      {/* Background Watermarks — Enlarged Money & Transfer Icons */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none opacity-[0.035] text-[#0a192f]">
        <svg
          className="absolute -top-16 -right-16 w-96 h-96 -rotate-12"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
        </svg>
        <svg
          className="absolute bottom-12 -left-20 w-96 h-96 rotate-45"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5h16.5a1.5 1.5 0 011.5 1.5v9.75a1.5 1.5 0 01-1.5 1.5H3.75a1.5 1.5 0 01-1.5-1.5V6a1.5 1.5 0 01-1.5-1.5zm12 6a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-md flex-1 flex flex-col px-6 py-8">
        <header className="flex items-center justify-between py-2 border-b border-slate-200/60">
          <span className="font-extrabold text-xl tracking-tight text-[#0a192f]">
            Coven
          </span>
          <Link href="/signup" className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200 transition-colors">
            Sign in
          </Link>
        </header>

        <main className="flex-1 flex flex-col justify-center gap-8 py-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700 mb-4">
              <span>Sub-500ms USDC Payments on Arc</span>
            </div>
            <h1 className="text-4xl font-extrabold leading-tight text-[#0a192f] tracking-tight">
              Send to anyone.
              <br />
              From <span className="text-blue-600">any chain</span>.
              <br />
              Cash out <span className="text-slate-700">anywhere</span>.
            </h1>
            <p className="mt-4 text-slate-600 text-sm leading-relaxed">
              Social USDC payments built on Arc. Claim your @username, send money instantly to friends, split bills with your circles, and cash out straight to your bank in 20+ countries.
            </p>
          </div>

          {/* Feature Bullets */}
          <div className="space-y-3.5 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            {[
              { icon: SendIcon, text: "Payments settle on Arc in under 500ms" },
              { icon: ReceiveIcon, text: "Pay from Ethereum, Base, Polygon — CCTP routes it invisibly" },
              { icon: CashoutIcon, text: "Cash out USDC to NGN, GHS, KES & more via Yellow Card" },
              { icon: CirclesIcon, text: "Circles: split bills, collect from groups, track payments" },
              { icon: LockIcon, text: "No seed phrase needed. Just your PIN & @username" },
            ].map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-800">{f.text}</span>
                </div>
              );
            })}
          </div>

          <Link
            href="/signup"
            className="rounded-full bg-[#0a192f] hover:bg-[#0f2b5c] text-white text-center font-bold text-sm py-4 shadow-sm transition-all duration-150 active:scale-[0.98]"
          >
            Get your @username
          </Link>
        </main>

        <footer className="text-center text-xs font-medium text-slate-400 py-2">
          Built on Arc · USDC Native · Circle × Yellow Card
        </footer>
      </div>
    </div>
  );
}
