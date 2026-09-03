import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSession, type CognitoSession } from "@/lib/auth/cognito-client";

export type AppRole = "Admin" | "RegistrationOfficer" | "CheckinOfficer";

export function useSession() {
  const [session, setSession] = useState<CognitoSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession().then((s) => {
      setSession(s);
      setLoading(false);
    });
  }, []);

  return { session, loading };
}

export function useCurrentStaff() {
  const { session, loading } = useSession();
  const groups = (session?.groups ?? []) as string[];

  return {
    session,
    loading,
    groups,
    isAdmin: groups.includes("Admin"),
    isRegOfficer: groups.includes("RegistrationOfficer"),
    isCheckinOfficer: groups.includes("CheckinOfficer"),
    isStaff: groups.length > 0,
    displayName: session?.name ?? session?.email ?? "",
    email: session?.email ?? "",
  };
}
