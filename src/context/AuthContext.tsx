import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import { auth } from "@/lib/firebase";
import { getAgencyMembership } from "@/lib/firestore";

type FirebaseUser = firebase.User;

interface AuthContextValue {
  user: FirebaseUser | null;
  loading: boolean;
  agencyRole: string | null;
  agencyId: string | null;
  onboardingProgress: number;
  setOnboardingProgress: (step: number) => void;
  reloadAgency: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [agencyRole, setAgencyRole] = useState<string | null>(null);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [onboardingProgress, setOnboardingProgress] = useState(0);

  // Re-reads agency_members/{uid}/profile/data and updates state.
  const applyMembership = useCallback(async (u: FirebaseUser) => {
    try {
      const profile = await getAgencyMembership(u.uid);
      if (profile) {
        setAgencyId((profile.agencyId as string) ?? null);
        setAgencyRole((profile.role as string) ?? null);
        setOnboardingProgress((profile.onboardingStep as number) ?? 3);
      } else {
        setAgencyId(null);
        setAgencyRole(null);
        setOnboardingProgress(0);
      }
    } catch {
      setAgencyId(null);
      setAgencyRole(null);
      setOnboardingProgress(0);
    }
  }, []);

  const reloadAgency = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) return;
    await applyMembership(u);
  }, [applyMembership]);

  useEffect(() => {
    let cancelled = false;

    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) {
        if (cancelled) return;
        setUser(null);
        setAgencyId(null);
        setAgencyRole(null);
        setOnboardingProgress(0);
        setLoading(false);
        return;
      }

      setUser(u);
      await applyMembership(u);
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [applyMembership]);

  return (
    <AuthContext.Provider
      value={{ user, loading, agencyRole, agencyId, onboardingProgress, setOnboardingProgress, reloadAgency }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useAgency() {
  const { agencyRole, agencyId, onboardingProgress } = useAuth();
  return { agencyRole, agencyId, onboardingProgress };
}
