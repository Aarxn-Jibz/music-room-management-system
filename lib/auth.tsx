"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  band_id: string | null;
  bands: { id: string; name: string }[];
  mustChangePassword?: boolean;
}

export interface Session {
  user: SessionUser;
  expires: string;
}

type Status = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  data: Session | null;
  status: Status;
  update: () => Promise<Session | null>;
}

const AUTH_REFRESH_EVENT = "rejoy:auth-refresh";

const AuthContext = createContext<AuthContextValue>({
  data: null,
  status: "loading",
  update: async () => null,
});

function toSession(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  bands?: { id: string; name: string }[];
  mustChangePassword?: boolean;
}): Session {
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      band_id: user.bands && user.bands.length > 0 ? user.bands[0].id : null,
      bands: user.bands ?? [],
      mustChangePassword: user.mustChangePassword,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

async function fetchMe(): Promise<Session | null> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) return null;
    const user = (await res.json()) as {
      id: string;
      name: string;
      email: string;
      role: string;
      bands?: { id: string; name: string }[];
      mustChangePassword?: boolean;
    };
    return toSession(user);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  const refresh = useCallback(async () => {
    const next = await fetchMe();
    setSession(next);
    setStatus(next ? "authenticated" : "unauthenticated");
    return next;
  }, []);

  useEffect(() => {
    refresh();
    const listener = () => {
      refresh();
    };
    window.addEventListener(AUTH_REFRESH_EVENT, listener);
    return () => window.removeEventListener(AUTH_REFRESH_EVENT, listener);
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ data: session, status, update: refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useSession(): AuthContextValue {
  return useContext(AuthContext);
}

interface SignInOptions {
  email?: string;
  password?: string;
  redirect?: boolean;
  callbackUrl?: string;
}

export async function signIn(
  _provider: string,
  options?: SignInOptions,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: options?.email, password: options?.password }),
      credentials: "include",
    });
    if (!res.ok) {
      return { error: "CredentialsSignin" };
    }
    window.dispatchEvent(new Event(AUTH_REFRESH_EVENT));
    return { ok: true };
  } catch {
    return { error: "CredentialsSignin" };
  }
}

export async function signOut(options?: { callbackUrl?: string }): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  } catch {
    // Logout is best-effort; client state is cleared regardless.
  }
  const url = options?.callbackUrl || "/";
  window.location.assign(url);
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const res = await fetch("/api/auth/me/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
      credentials: "include",
    });
    if (!res.ok) {
      return { error: "Invalid current password" };
    }
    window.dispatchEvent(new Event(AUTH_REFRESH_EVENT));
    return { ok: true };
  } catch {
    return { error: "Something went wrong. Please try again." };
  }
}
