"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownToLine, Pause, Play, RefreshCw, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";
import type { DeploymentStatus } from "@/types/database";

export type LogLine = { source: string; level: string; message: string; created_at: string };

const TERMINAL: DeploymentStatus[] = ["ready", "error", "cancelled"];

/** Terminal-style build log viewer with auto refresh while a build is active. */
export function LogViewer({
  deploymentId,
  initialStatus,
  onStatusChange,
  className,
  height = "h-[420px]",
}: {
  deploymentId: string;
  initialStatus: DeploymentStatus;
  onStatusChange?: (status: DeploymentStatus) => void;
  className?: string;
  height?: string;
}) {
  const [logs, setLogs] = useState<LogLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<DeploymentStatus>(initialStatus);
  const [auto, setAuto] = useState(true);
  const [follow, setFollow] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const statusRes = await fetch(`/api/deployments/${deploymentId}`, { cache: "no-store" });
      if (statusRes.ok) {
        const data = (await statusRes.json()) as { deployment: { status: DeploymentStatus } };
        setStatus(data.deployment.status);
      }
      const res = await fetch(`/api/deployments/${deploymentId}/logs`, { cache: "no-store" });
      const data = (await res.json()) as { logs?: LogLine[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load logs");
      setLogs(data.logs ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load logs");
    }
  }, [deploymentId]);

  useEffect(() => {
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, [load]);

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  useEffect(() => {
    if (!auto || TERMINAL.includes(status)) return;
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [auto, status, load]);

  useEffect(() => {
    if (follow && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs, follow]);

  const active = !TERMINAL.includes(status);
  const plain = (logs ?? []).map((l) => l.message).join("\n");

  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-terminal", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-white/5 px-3 py-2">
        <Terminal className="h-3.5 w-3.5 text-white/40" />
        <span className="font-mono text-[11px] text-white/50">build output</span>
        {active && (
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-amber-300">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-amber-300" /> live
          </span>
        )}
        <div className="ml-auto flex items-center gap-0.5 text-white/50">
          {active && (
            <button
              type="button"
              onClick={() => setAuto((v) => !v)}
              className="rounded p-1.5 hover:bg-white/5 hover:text-white"
              aria-label={auto ? "Pause auto refresh" : "Resume auto refresh"}
              title={auto ? "Pause auto refresh" : "Resume auto refresh"}
            >
              {auto ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => setFollow((v) => !v)}
            className={cn("rounded p-1.5 hover:bg-white/5 hover:text-white", follow && "text-white")}
            aria-label="Follow output"
            title="Follow output"
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={load} className="rounded p-1.5 hover:bg-white/5 hover:text-white" aria-label="Refresh logs" title="Refresh">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          {plain && <CopyButton value={plain} label="Copy logs" className="text-white/50 hover:bg-white/5 hover:text-white" />}
        </div>
      </div>
      <div ref={scrollRef} className={cn("scrollbar-thin overflow-auto px-4 py-3 font-mono text-[12.5px] leading-6", height)} role="log" aria-live="polite">
        {error && (
          <div className="flex flex-col items-start gap-3 py-6">
            <p className="text-red-300">Could not load logs: {error}</p>
            <Button size="sm" variant="secondary" onClick={load}>
              Retry
            </Button>
          </div>
        )}
        {!error && logs === null && (
          <div className="space-y-2 py-2">
            {[70, 45, 85, 30].map((w) => (
              <div key={w} className="h-3 animate-pulse rounded bg-white/5" style={{ width: `${w}%` }} />
            ))}
          </div>
        )}
        {!error && logs?.length === 0 && (
          <p className="py-6 text-white/40">{active ? "Waiting for build output…" : "No logs are available for this deployment."}</p>
        )}
        {logs?.map((line, i) => (
          <div key={i} className="flex gap-4 whitespace-pre-wrap break-all">
            <span className="shrink-0 text-white/25 select-none">
              {new Date(line.created_at).toLocaleTimeString("en-IN", { hour12: false })}
            </span>
            <span
              className={cn(
                "min-w-0",
                line.level === "error" && "text-red-300",
                line.level === "warn" && "text-amber-300",
                line.level === "success" && "text-emerald-300",
                line.level === "command" && "text-white",
                line.level === "info" && "text-terminal-foreground",
              )}
            >
              {line.level === "command" && !line.message.startsWith("$") ? `$ ${line.message}` : line.message}
            </span>
          </div>
        ))}
        {active && logs && logs.length > 0 && <span className="inline-block h-3.5 w-1.5 animate-caret bg-white/60" />}
      </div>
    </div>
  );
}
