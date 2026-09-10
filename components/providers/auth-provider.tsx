"use client";

import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { getClientAuth, getGoogleProvider } from "@/lib/firebase/client";
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
    const auth = getClientAuth();
    if (!auth) {
      setLoading(false);
      return;
    }
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
      async signInWithGoogle() {
        const auth = getClientAuth();
        if (!auth) throw new Error("Firebase is not configured yet.");
        const result = await signInWithPopup(auth, getGoogleProvider());
        const idToken = await result.user.getIdToken();
        await apiFetch("/api/auth/session", {
          method: "POST",
          body: JSON.stringify({ idToken }),
        });
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
