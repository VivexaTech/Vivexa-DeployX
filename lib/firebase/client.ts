import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getPublicFirebaseConfig, isPublicFirebaseConfigured } from "@/lib/env";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let persistenceReady: Promise<Auth | null> | null = null;

export function getFirebaseApp() {
  if (typeof window === "undefined") return null;
  if (!isPublicFirebaseConfigured()) return null;
  if (app) return app;
  app = getApps().length ? getApp() : initializeApp(getPublicFirebaseConfig());
  return app;
}

function createBrowserAuth(firebaseApp: FirebaseApp) {
  try {
    return initializeAuth(firebaseApp, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    return getAuth(firebaseApp);
  }
}

export function getClientAuth() {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  if (!auth) auth = createBrowserAuth(firebaseApp);
  return auth;
}

export async function whenAuthReady() {
  if (typeof window === "undefined") return null;
  if (!persistenceReady) {
    persistenceReady = Promise.resolve(getClientAuth());
  }
  return persistenceReady;
}

export function getClientDb() {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  if (!db) db = getFirestore(firebaseApp);
  return db;
}

export function getGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}
