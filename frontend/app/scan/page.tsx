"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { Card, Button, Input, Alert } from "@/components/ui";
import { ScanIcon } from "@/components/Icons";
import { useAuth } from "@/lib/useAuth";

export default function ScanPage() {
  const router = useRouter();
  useAuth();
  const [manual, setManual] = useState("");
  const [error, setError] = useState("");

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
        setError("Camera unavailable. Enter a handle below instead.");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleScan(raw: string) {
    // Coven QRs look like coven://pay?to=alice&amount=20, or raw URLs.
    setError("");
    if (raw.startsWith("coven://") || raw.includes("/send?")) {
      const query = raw.split("?")[1];
      if (query) {
        router.replace(`/send?${query}`);
        return;
      }
    }
    // Otherwise treat it as a bare handle: "alice" or "@alice".
    const clean = raw.replace(/^@/, "").trim();
    if (clean) {
      router.replace(`/send?to=${encodeURIComponent(clean)}`);
      return;
    }
    setError("That QR code isn't a Coven payment code.");
  }

  return (
    <AppShell title="Scan to pay" subtitle="Point your camera at any Coven QR">
      <div className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-2 lg:items-start">
        <Card className="overflow-hidden p-3">
          {/* html5-qrcode injects its own controls here. */}
          <div id="qr-reader" className="overflow-hidden rounded-lg [&_button]:cursor-pointer" />
          <p className="flex items-center justify-center gap-2 py-4 text-xs font-semibold text-ink-soft">
            <ScanIcon className="h-4 w-4 text-accent" />
            Point camera at any Coven QR
          </p>
        </Card>

        <div className="space-y-4">
          {error && <Alert tone="warn">{error}</Alert>}

          <Card className="space-y-4">
            <div>
              <p className="text-sm font-bold text-ink">Or enter a handle</p>
              <p className="mt-1 text-xs text-ink-soft">
                If you already know who you're paying, skip the camera entirely.
              </p>
            </div>
            <Input
              label="Recipient"
              placeholder="@username"
              autoComplete="off"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && manual.trim()) handleScan(manual);
              }}
            />
            <Button
              fullWidth
              disabled={!manual.trim()}
              onClick={() => handleScan(manual)}
            >
              Continue
            </Button>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
