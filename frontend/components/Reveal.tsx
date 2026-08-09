"use client";

import { ElementType, ReactNode, useEffect, useRef, useState } from "react";

/**
 * Reveals its children when they scroll into view.
 *
 * The `reveal` class ships in the server HTML (hidden state), and `is-visible`
 * is added on intersection. Anything already on screen at mount reveals
 * immediately, so above-the-fold content never waits on a scroll event.
 */
export default function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
}: {
  children: ReactNode;
  /** Stagger offset in ms. Capped so long sequences stay responsive. */
  delay?: number;
  as?: ElementType;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        // One-shot: content should not re-animate when scrolled past again.
        observer.disconnect();
      },
      // Start slightly before the element edge so it is already settling
      // by the time it is comfortably in view.
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      style={{ ["--reveal-delay" as string]: `${Math.min(delay, 400)}ms` }}
      className={`reveal ${visible ? "is-visible" : ""} ${className}`}
    >
      {children}
    </Tag>
  );
}
