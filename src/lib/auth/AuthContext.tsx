"use client";

import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getSharedAuth } from "@/lib/firebase/userApp";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  needsVerification: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (name: string, email: string, password: string) => Promise<User>;
  signInWithGoogle: () => Promise<User>;
  signOut: () => Promise<void>;
  sendVerification: () => Promise<void>;
  refreshUser: () => Promise<boolean>;
  sendReset: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function verificationSettings() {
  if (typeof window === "undefined") return undefined;
  return { url: `${window.location.origin}/login?verified=1`, handleCodeInApp: false };
}

function usesPassword(user: User | null): boolean {
  return Boolean(user?.providerData.some((p) => p.providerId === "password"));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  useEffect(() => {
    const auth = getSharedAuth();
    setPersistence(auth, browserLocalPersistence).catch(() => {});
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const getAuth = useCallback(() => getSharedAuth(), []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const cred = await signInWithEmailAndPassword(getAuth(), email, password);
      if (!cred.user.emailVerified) {
        await sendEmailVerification(cred.user, verificationSettings()).catch(() => {});
      }
      return cred.user;
    },
    [getAuth],
  );

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      const cred = await createUserWithEmailAndPassword(getAuth(), email, password);
      if (name) await updateProfile(cred.user, { displayName: name }).catch(() => {});
      await sendEmailVerification(cred.user, verificationSettings()).catch(() => {});
      return cred.user;
    },
    [getAuth],
  );

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const cred = await signInWithPopup(getAuth(), provider);
    return cred.user;
  }, [getAuth]);

  const signOut = useCallback(async () => {
    await fbSignOut(getSharedAuth());
  }, []);

  const sendVerification = useCallback(async () => {
    const current = getAuth().currentUser;
    if (!current) throw new Error("Sign in again to get a new link.");
    await sendEmailVerification(current, verificationSettings());
  }, [getAuth]);

  const refreshUser = useCallback(async () => {
    const current = getAuth().currentUser;
    if (!current) return false;
    try {
      await reload(current);
    } catch {
      return false;
    }
    setUser(getAuth().currentUser);
    setTick((t) => t + 1);
    return Boolean(getAuth().currentUser?.emailVerified);
  }, [getAuth]);

  const sendReset = useCallback(
    async (email: string) => {
      await sendPasswordResetEmail(getAuth(), email);
    },
    [getAuth],
  );

  const needsVerification = Boolean(user && usesPassword(user) && !user.emailVerified);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      needsVerification,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      sendVerification,
      refreshUser,
      sendReset,
    }),
    [user, loading, needsVerification, signIn, signUp, signInWithGoogle, signOut, sendVerification, refreshUser, sendReset],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export function isEmailTakenError(err: unknown): boolean {
  const code = typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : "";
  return code === "auth/email-already-in-use";
}

export function authErrorMessage(err: unknown): string {
  const code =
    typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : "";
  switch (code) {
    case "auth/invalid-email": return "That email address isn't valid.";
    case "auth/user-not-found":
    case "auth/invalid-credential":
    case "auth/wrong-password": return "Wrong email or password.";
    case "auth/email-already-in-use": return "That email already has an account. Log in instead.";
    case "auth/weak-password": return "Use at least 6 characters.";
    case "auth/popup-closed-by-user": return "You closed the Google window before finishing.";
    case "auth/popup-blocked": return "Your browser blocked the Google popup. Allow popups and try again.";
    case "auth/operation-not-allowed": return "Turn this sign-in method on in Firebase Authentication.";
    case "auth/network-request-failed": return "No connection. Check your internet and try again.";
    case "auth/too-many-requests": return "Too many tries. Wait a minute, then try again.";
    case "auth/requires-recent-login": return "Log in again to do that.";
    default:
      return err instanceof Error && err.message ? err.message : "That didn't work. Try again.";
  }
}
