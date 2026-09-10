import { getClientAuth } from "@/lib/firebase/client";

export type ApiError = {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
  status: number;
};

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const auth = getClientAuth();
  const token = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (response.headers.get("content-type")?.includes("application/pdf")) {
    return response as T;
  }
  const data = await response.json().catch(() => ({ error: "Unexpected response" }));
  if (!response.ok) {
    const error = new Error(data.error || "Request failed") as Error & ApiError;
    error.error = data.error || "Request failed";
    error.code = data.code;
    error.details = data.details;
    error.status = response.status;
    throw error;
  }
  return data as T;
}
