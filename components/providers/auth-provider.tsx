"use client";

import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { googleSignInErrorMessage, isGoogleSignInCancelled } from "@/lib/auth/google-errors";
import { getClientAuth, getGoogleProvider, whenAuthReady } from "@/lib/firebase/client";
import { isPublicFirebaseConfigured as envConfigured } from "@/lib/env";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = envConfigured();

  useEffect(() => {
    let unsub: (() => void) | undefined;
    void whenAuthReady().then((auth) => {
      if (!auth) {
        setLoading(false);
        return;
      }
      unsub = onAuthStateChanged(auth, (next) => {
        setUser(next);
        setLoading(false);
      });
    });
    return () => unsub?.();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      configured,
      async signInWithGoogle() {
        const auth = await whenAuthReady();
        if (!auth) throw new Error("Firebase is not configured yet.");
        try {
          const result = await signInWithPopup(auth, getGoogleProvider());
          const idToken = await result.user.getIdToken(true);
          await apiFetch("/api/auth/session", {
            method: "POST",
            body: JSON.stringify({ idToken }),
          });
        } catch (error) {
          if (isGoogleSignInCancelled(error)) throw error;
          await signOut(auth).catch(() => undefined);
          throw new Error(googleSignInErrorMessage(error));
        }
      },
      async logout() {
        await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
        const auth = getClientAuth();
        if (auth) await signOut(auth);
      },
    }),
    [configured, loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
