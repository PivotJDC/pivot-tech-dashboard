import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  steps: string[];
  /** Zero-based index of the current (in-progress) step. */
  current: number;
}

/** Horizontal numbered step tracker. Steps before `current` render as done. */
export function StepIndicator({ steps, current }: StepIndicatorProps) {
  return (
    <ol className="flex w-full items-center">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const last = i === steps.length - 1;
        return (
          <li
            key={label}
            className={cn("flex items-center", !last && "flex-1")}
          >
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary text-primary",
                  !done && !active && "border-border text-muted-foreground",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span
                className={cn(
                  "max-w-[5.5rem] text-center text-xs leading-tight",
                  active ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {!last && (
              <span
                className={cn(
                  "mx-1 mb-5 h-0.5 flex-1 rounded",
                  done ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
