import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, toPublicError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

function mapUnknownError(error: unknown) {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) {
    return new AppError("VALIDATION", error.issues[0]?.message || "Invalid input.", 400);
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/reserved|not allowed|already in use|valid domain/i.test(message)) {
    return new AppError("VALIDATION", message, 400);
  }
  if (/id-token|session-cookie|argument.*idToken|Decoding Firebase/i.test(message)) {
    return new AppError("UNAUTHENTICATED", "Google sign-in expired. Please try again.", 401);
  }
  if (/FAILED_PRECONDITION|requires an index/i.test(message)) {
    return new AppError(
      "FIREBASE_ERROR",
      "Firestore needs an index for this query. Dashboard data will load without that query until the index is ready.",
      503,
    );
  }
  if (/odd number of components|must point to a collection/i.test(message)) {
    return new AppError("FIREBASE_ERROR", "Invalid Firestore path. Please retry after the latest update.", 500);
  }
  if (/5 NOT_FOUND|NOT_FOUND:|code.?5\b/i.test(message)) {
    return new AppError(
      "FIREBASE_ERROR",
      "Firestore is not available. In Firebase Console → Firestore Database, create a database in Native mode for this project, then try signing in again.",
      503,
    );
  }
  if (/invalid_grant|Failed to parse private key|DECODER routines|error:1E/i.test(message)) {
    return new AppError(
      "CONFIG_MISSING",
      "Firebase Admin credentials are invalid. Check FIREBASE_ADMIN_PRIVATE_KEY formatting.",
      503,
    );
  }
  if (/Identity Toolkit|API has not been used|PERMISSION_DENIED/i.test(message)) {
    return new AppError(
      "FIREBASE_ERROR",
      "Firebase Admin cannot reach this project. Enable Identity Toolkit and grant the service account access.",
      503,
    );
  }
  return error;
}

export function handleRouteError(error: unknown, context: string) {
  error = mapUnknownError(error);
  const publicError = toPublicError(error);
  logger.error(`${context} failed`, {
    code: publicError.code,
    status: publicError.status,
    message: error instanceof Error ? error.message : "unknown",
  });
  return NextResponse.json(
    {
      error: publicError.error,
      code: publicError.code,
      details: publicError.details,
    },
    { status: publicError.status },
  );
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}
