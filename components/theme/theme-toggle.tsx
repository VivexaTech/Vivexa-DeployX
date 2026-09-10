"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return <div className="h-10 w-10 rounded-xl border border-line" />;
  }
  const options = [
    { id: "light", icon: Sun, label: "Light" },
    { id: "dark", icon: Moon, label: "Dark" },
    { id: "system", icon: Monitor, label: "System" },
  ] as const;
  return (
    <div className="inline-flex items-center rounded-xl border border-line bg-bg-elevated p-1">
      {options.map((option) => {
        const Icon = option.icon;
        const active = theme === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-label={option.label}
            onClick={() => setTheme(option.id)}
            className={cn(
              "inline-flex h-8 items-center justify-center rounded-lg px-2 text-muted transition",
              active && "bg-accent-soft text-ink",
            )}
          >
            <Icon className="h-4 w-4" />
            {compact ? null : <span className="ml-1 hidden text-xs font-medium sm:inline">{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
