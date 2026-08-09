"use client";

import { CheckCircleIcon } from "./Icons";

/**
 * Horizontal progress indicator for multi-step flows.
 * Step state is carried by number/check + label + colour, never colour alone.
 */
export default function Stepper({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <ol
      className="flex items-center gap-1.5"
      aria-label={`Step ${current + 1} of ${steps.length}: ${steps[current]}`}
    >
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              aria-hidden="true"
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-bold transition-[background-color,color] duration-300 ease-out-soft ${
                done
                  ? "bg-pos text-white"
                  : active
                    ? "bg-brand text-white"
                    : "bg-surface-3 text-ink-mute"
              }`}
            >
              {done ? <CheckCircleIcon className="h-4 w-4" /> : i + 1}
            </span>
            <span
              className={`hidden text-xs font-bold transition-colors duration-300 sm:block ${
                active ? "text-ink" : "text-ink-mute"
              }`}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={`h-0.5 min-w-3 flex-1 rounded-full transition-colors duration-300 ${
                  done ? "bg-pos" : "bg-surface-3"
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
