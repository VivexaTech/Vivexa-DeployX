"use client";

import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { getClientAuth, getGoogleProvider } from "@/lib/firebase/client";
import { isPublicFirebaseConfigured as envConfigured } from "@/lib/env";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  redirectError: string | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function postLoginPath() {
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next");
  const plan = params.get("plan");
  if (next && next.startsWith("/")) return next;
  if (plan) return `/dashboard/billing?plan=${encodeURIComponent(plan)}`;
  return "/dashboard";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirectError, setRedirectError] = useState<string | null>(null);
  const handledRedirect = useRef(false);
  const configured = envConfigured();

  useEffect(() => {
    const auth = getClientAuth();
    if (!auth) {
      setLoading(false);
      return;
    }

    void getRedirectResult(auth)
      .then(async (result) => {
        if (!result?.user || handledRedirect.current) return;
        handledRedirect.current = true;
        const idToken = await result.user.getIdToken();
        await apiFetch("/api/auth/session", {
          method: "POST",
          body: JSON.stringify({ idToken }),
        });
        if (window.location.pathname === "/login" || window.location.pathname === "/signup") {
          window.location.assign(postLoginPath());
        }
      })
      .catch((error) => {
        setRedirectError(error instanceof Error ? error.message : "Sign-in failed.");
      });

    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      configured,
      redirectError,
      async signInWithGoogle() {
        const auth = getClientAuth();
        if (!auth) throw new Error("Firebase is not configured yet.");
        await signInWithRedirect(auth, getGoogleProvider());
      },
      async logout() {
        await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
        const auth = getClientAuth();
        if (auth) await signOut(auth);
      },
    }),
    [configured, loading, redirectError, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
