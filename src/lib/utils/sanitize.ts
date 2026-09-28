const SECRET_PATTERNS: RegExp[] = [
  /gh[pousr]_[A-Za-z0-9]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /rzp_(live|test)_[A-Za-z0-9]{8,}/g,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /sk_(live|test)_[A-Za-z0-9]{10,}/g,
  /(?<=(?:password|secret|token|api[_-]?key)\s*[=:]\s*)["']?[^\s"']{6,}/gi,
];

/**
 * Removes secrets from a log line. Known secret values (e.g. project env var
 * values) are redacted exactly; common token formats are redacted by pattern.
 */
export function sanitizeLogLine(line: string, knownSecrets: string[] = []): string {
  let output = line;
  for (const secret of knownSecrets) {
    if (secret && secret.length >= 4) {
      output = output.split(secret).join("••••••");
    }
  }
  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(pattern, "••••••");
  }
  return output;
}

/** Generic message for unexpected errors; never leaks internals to clients. */
export function publicErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof PublicError) return error.message;
  return fallback;
}

/** An error whose message is safe to show to end users. */
export class PublicError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "PublicError";
    this.status = status;
  }
}
