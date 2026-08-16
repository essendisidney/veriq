"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { MembershipRole, Organization } from "@/lib/database.types";

export type WorkspaceOrg = Organization & {
  membershipId: string;
  role: MembershipRole;
};

export type WorkspaceUser = {
  id: string;
  email: string;
  fullName: string;
};

type WorkspaceContextValue = {
  organizations: WorkspaceOrg[];
  currentOrg: WorkspaceOrg | null;
  setCurrentOrgId: (id: string) => void;
  user: WorkspaceUser;
};

export const ORG_STORAGE_KEY = "veriq_org_id";
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  children,
  initialOrganizations,
  initialUser,
}: {
  children: React.ReactNode;
  initialOrganizations: WorkspaceOrg[];
  initialUser: WorkspaceUser;
}) {
  const organizations = initialOrganizations;
  const [currentOrgId, setCurrentOrgIdState] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(ORG_STORAGE_KEY);
    if (stored && organizations.some((o) => o.id === stored)) {
      setCurrentOrgIdState(stored);
    } else if (organizations.length > 0) {
      setCurrentOrgIdState(organizations[0]!.id);
    }
  }, [organizations]);

  const setCurrentOrgId = useCallback((id: string) => {
    setCurrentOrgIdState(id);
    localStorage.setItem(ORG_STORAGE_KEY, id);
  }, []);

  const currentOrg = useMemo(
    () => organizations.find((o) => o.id === currentOrgId) ?? null,
    [organizations, currentOrgId],
  );

  const value = useMemo(
    () => ({
      organizations,
      currentOrg,
      setCurrentOrgId,
      user: initialUser,
    }),
    [organizations, currentOrg, setCurrentOrgId, initialUser],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaceOptional() {
  return useContext(WorkspaceContext);
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return ctx;
}
