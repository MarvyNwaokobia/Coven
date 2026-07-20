"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { Card, Input, Button } from "@/components/ui";
import { parsePaymentURI } from "@/lib/qr";
import { useAuth } from "@/lib/useAuth";

/**
 * Camera QR scanner using the native BarcodeDetector API,
 * with a manual @username fallback for unsupported browsers.
 */
export default function ScanPage() {
  const router = useRouter();
  useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;

    async function start() {
      if (!("BarcodeDetector" in window)) {
        setSupported(false);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });

        const scan = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes[0]?.rawValue;
            if (value) {
              const parsed = parsePaymentURI(value);
              if (parsed) {
                const q = new URLSearchParams({ to: parsed.username });
                if (parsed.amount) q.set("amount", String(parsed.amount));
                if (parsed.note) q.set("note", parsed.note);
                router.replace(`/send?${q.toString()}`);
                return;
              }
            }
          } catch {
            // detection frame failed — keep scanning
          }
          raf = requestAnimationFrame(scan);
        };
        raf = requestAnimationFrame(scan);
      } catch {
        setError("Camera access denied — enter a username instead.");
      }
    }

    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [router]);

  return (
    <AppShell title="Scan to pay">
      <div className="space-y-4">
        {supported && !error ? (
          <Card className="overflow-hidden p-0 aspect-square relative">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted
              playsInline
            />
            <div className="absolute inset-8 border-2 border-accent/70 rounded-2xl pointer-events-none" />
          </Card>
        ) : (
          <Card className="py-8 text-center text-sm text-text-2">
            {error || "QR scanning isn't supported in this browser."}
          </Card>
        )}

        <Card className="space-y-3">
          <p className="text-sm font-semibold">Or pay by username</p>
          <Input
            placeholder="@username"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
          />
          <Button
            className="w-full"
            disabled={!manual.trim()}
            onClick={() =>
              router.push(`/send?to=${encodeURIComponent(manual.replace(/^@/, ""))}`)
            }
          >
            Continue
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}
