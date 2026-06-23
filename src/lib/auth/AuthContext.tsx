"use client";

import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
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
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (name: string, email: string, password: string) => Promise<User>;
  signInWithGoogle: () => Promise<User>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
      return cred.user;
    },
    [getAuth],
  );

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      const cred = await createUserWithEmailAndPassword(getAuth(), email, password);
      if (name) await updateProfile(cred.user, { displayName: name }).catch(() => {});
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

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, signIn, signUp, signInWithGoogle, signOut }),
    [user, loading, signIn, signUp, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export function authErrorMessage(err: unknown): string {
  const code =
    typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : "";
  switch (code) {
    case "auth/invalid-email": return "That email doesn't look right.";
    case "auth/user-not-found":
    case "auth/invalid-credential":
    case "auth/wrong-password": return "Email or password is incorrect.";
    case "auth/email-already-in-use": return "An account already exists for that email.";
    case "auth/weak-password": return "Choose a password with at least 6 characters.";
    case "auth/popup-closed-by-user": return "Sign in window closed before finishing.";
    case "auth/operation-not-allowed": return "Enable this sign in method in Firebase Authentication.";
    case "auth/network-request-failed": return "Network error. Check your connection and try again.";
    case "auth/too-many-requests": return "Too many attempts. Wait a moment and try again.";
    default:
      return err instanceof Error && err.message ? err.message : "Something went wrong. Try again.";
  }
}
