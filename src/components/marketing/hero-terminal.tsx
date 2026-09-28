"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

type Line = { text: string; kind: "cmd" | "ok" | "muted" | "url" | "blank" };

const SCRIPT: Line[] = [
  { text: "$ deployx deploy", kind: "cmd" },
  { text: "", kind: "blank" },
  { text: "Repository connected", kind: "ok" },
  { text: "Installing dependencies…", kind: "muted" },
  { text: "Build completed in 38s", kind: "ok" },
  { text: "Deployment ready", kind: "ok" },
  { text: "", kind: "blank" },
  { text: "Production:", kind: "muted" },
  { text: "https://example.deployx.in", kind: "url" },
];

export function HeroTerminal() {
  const [visible, setVisible] = useState(1);

  useEffect(() => {
    if (visible >= SCRIPT.length) {
      const reset = setTimeout(() => setVisible(1), 4000);
      return () => clearTimeout(reset);
    }
    const id = setTimeout(() => setVisible((v) => v + 1), visible === 1 ? 900 : 520);
    return () => clearTimeout(id);
  }, [visible]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-terminal shadow-card">
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="ml-3 font-mono text-[11px] text-white/40">~/projects/storefront</span>
      </div>
      <div className="min-h-[260px] px-5 py-4 font-mono text-[13px] leading-7" aria-label="Example deployment output">
        {SCRIPT.slice(0, visible).map((line, i) => (
          <div key={i} className="animate-fade-in">
            {line.kind === "cmd" && <span className="text-white">{line.text}</span>}
            {line.kind === "ok" && (
              <span className="flex items-center gap-2 text-terminal-foreground">
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                {line.text}
              </span>
            )}
            {line.kind === "muted" && <span className="text-white/45">{line.text}</span>}
            {line.kind === "url" && <span className="text-[#9ea1ff] underline decoration-white/20 underline-offset-4">{line.text}</span>}
            {line.kind === "blank" && <span>&nbsp;</span>}
          </div>
        ))}
        <span className="inline-block h-4 w-2 translate-y-0.5 animate-caret bg-white/70" />
      </div>
    </div>
  );
}
