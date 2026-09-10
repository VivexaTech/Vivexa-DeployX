type LogLevel = "info" | "warn" | "error";

function sanitize(meta?: Record<string, unknown>) {
  if (!meta) return undefined;
  const blocked = ["token", "secret", "password", "authorization", "key", "private", "cookie"];
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    const lower = key.toLowerCase();
    if (blocked.some((item) => lower.includes(item))) {
      next[key] = "[redacted]";
    } else {
      next[key] = value;
    }
  }
  return next;
}

function write(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const payload = {
    level,
    message,
    time: new Date().toISOString(),
    ...sanitize(meta),
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => write("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write("error", message, meta),
};
