import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type SessionTokens = {
  access_token: string;
  refresh_token?: string;
  tenant_id: string;
  member_id?: string;
};

const KEY = "oneledger_session";

export const setSessionTokens = (tokens: SessionTokens) => {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(tokens));
};

export const getSessionTokens = (): SessionTokens | null => {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const clearSessionTokens = () => {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(KEY);
};

export const isAuthenticated = () => !!getSessionTokens()?.access_token;

// Role type for frontend (mirrors backend Role type)
export type Role = "admin" | "member" | "event_manager" | "finance_manager" | "communications_manager";

export type SessionUser = {
  id?: string;
  email?: string;
  roles?: Role[];
};

type SessionState = {
  tokens: SessionTokens | null;
  user: SessionUser | null;
};

type SessionContextValue = {
  authed: boolean;
  tokens: SessionTokens | null;
  user: SessionUser | null;
  setSession: (next: Partial<SessionState>) => void;
  logout: () => void;
  hasRole: (role: Role) => boolean;
  isAdmin: () => boolean;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SessionState>(() => ({
    tokens: getSessionTokens(),
    user: null,
  }));

  useEffect(() => {
    setState((prev) => ({ ...prev, tokens: getSessionTokens() }));
  }, []);

  const setSession = (next: Partial<SessionState>) => {
    setState((prev) => {
      const tokens = next.tokens !== undefined ? next.tokens : prev.tokens;
      const user = next.user !== undefined ? next.user : prev.user;
      if (tokens) {
        setSessionTokens(tokens);
      } else {
        clearSessionTokens();
      }
      return { tokens, user };
    });
  };

  const logout = () => {
    clearSessionTokens();
    setState({ tokens: null, user: null });
  };

  const hasRole = (role: Role): boolean => {
    return state.user?.roles?.includes(role) ?? false;
  };

  const isAdmin = (): boolean => {
    return hasRole("admin");
  };

  const value = useMemo<SessionContextValue>(
    () => ({
      authed: !!state.tokens?.access_token,
      tokens: state.tokens,
      user: state.user,
      setSession,
      logout,
      hasRole,
      isAdmin,
    }),
    [state.tokens, state.user]
  );

  return React.createElement(SessionContext.Provider, { value }, children);
};

export const useSessionContext = () => {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSessionContext must be used within SessionProvider");
  return ctx;
};

