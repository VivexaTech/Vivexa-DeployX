export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PLAN_LIMIT"
  | "PLAN_FEATURE"
  | "SUBSCRIPTION_INACTIVE"
  | "RATE_LIMITED"
  | "CONFIG_MISSING"
  | "GITHUB_ERROR"
  | "VERCEL_ERROR"
  | "RAZORPAY_ERROR"
  | "EMAIL_ERROR"
  | "FIREBASE_ERROR"
  | "EXTERNAL_UNAVAILABLE"
  | "INTERNAL";

export class AppError extends Error {
  status: number;
  code: ErrorCode;
  details?: unknown;

  constructor(code: ErrorCode, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function isAppError(error: unknown): error is AppError {
  if (error instanceof AppError) return true;
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: unknown; code?: unknown; status?: unknown; message?: unknown };
  return (
    candidate.name === "AppError" &&
    typeof candidate.code === "string" &&
    typeof candidate.status === "number" &&
    typeof candidate.message === "string"
  );
}

export function toPublicError(error: unknown) {
  if (isAppError(error)) {
    return {
      error: error.message,
      code: error.code,
      details: error.code === "PLAN_LIMIT" || error.code === "PLAN_FEATURE" ? error.details : undefined,
      status: error.status,
    };
  }

  return {
    error: "Authentication service temporarily unavailable",
    code: "INTERNAL" as ErrorCode,
    status: 500,
  };
}
