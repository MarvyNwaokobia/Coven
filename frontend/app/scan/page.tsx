"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { Card, Button, Input } from "@/components/ui";
import { ScanIcon } from "@/components/Icons";
import { useAuth } from "@/lib/useAuth";

export default function ScanPage() {
  const router = useRouter();
  useAuth();
  const [manual, setManual] = useState("");

  useEffect(() => {
    let scanner: {
      render: (onSuccess: (text: string) => void, onError: () => void) => void;
      clear: () => Promise<void>;
    } | null = null;

    async function init() {
      try {
        const { Html5QrcodeScanner } = await import("html5-qrcode");
        scanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: 250 }, false);

        scanner.render(
          (text: string) => {
            scanner?.clear();
            handleScan(text);
          },
          () => {}
        );
      } catch {
        // Scanner couldn't mount, manual input fallback works
      }
    }

    init();
    return () => {
      if (scanner) {
        try {
          scanner.clear();
        } catch {}
      }
    };
  }, []);

  function handleScan(raw: string) {
    // PayCircle QRs look like paycircle://pay?to=alice&amount=20 or raw URLs
    try {
      if (raw.startsWith("paycircle://") || raw.includes("/send?")) {
        const query = raw.split("?")[1];
        if (query) {
          router.replace(`/send?${query}`);
          return;
        }
      }
      // If user scanned just a username like "alice" or "@alice"
      const clean = raw.replace("@", "").trim();
      if (clean) router.replace(`/send?to=${encodeURIComponent(clean)}`);
    } catch {
      alert("Invalid QR code format");
    }
  }

  return (
    <AppShell title="Scan QR Code">
      <div className="space-y-5">
        <Card className="p-2 text-center">
          <div id="qr-reader" className="overflow-hidden rounded-2xl border-0" />
          <div className="py-4 text-xs font-semibold text-slate-500 flex items-center justify-center gap-2">
            <ScanIcon className="w-4 h-4 text-blue-600" />
            <span>Point camera at any PayCircle QR</span>
          </div>
        </Card>

        <Card className="space-y-3">
          <p className="text-sm font-bold text-slate-900">Or enter handle manually</p>
          <Input
            placeholder="@username"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
          />
          <Button
            className="w-full"
            disabled={!manual.trim()}
            onClick={() => handleScan(manual)}
          >
            Continue
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}
