"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { getUser, clearAuth as clearLocal, TOKEN_KEY, USER_KEY, getMe } from "@/lib/api";
import { useRouter, usePathname } from "next/navigation";

type AuthUser = {
  id: number;
  organization_id: number;
  email: string;
  name?: string | null;
  role?: string;
} | null;

type AuthCtx = {
  user: AuthUser;
  loading: boolean;
  logout: () => void;
  reloadUser: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({ user: null, loading: true, logout: () => {}, reloadUser: async () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const reloadUser = async () => {
    try {
      const me = await getMe();
      const mapped = { id: me.id, organization_id: me.organization_id, email: me.email, name: me.name, role: me.role };
      localStorage.setItem(USER_KEY, JSON.stringify(mapped));
      setUser(mapped);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    const tok = localStorage.getItem(TOKEN_KEY);
    if (!tok) {
      setLoading(false);
      return;
    }
    const cached = getUser();
    if (cached) setUser(cached);
    setLoading(false);
    if (!cached) reloadUser();
  }, []);

  useEffect(() => {
    const publicPaths = ["/", "/login", "/register"];
    if (!loading && !user && !publicPaths.includes(pathname)) {
      router.replace("/login");
    }
    if (!loading && user && (pathname === "/login" || pathname === "/register" || pathname === "/")) {
      router.replace("/dashboard");
    }
  }, [user, loading, pathname, router]);

  const logout = () => {
    clearLocal();
    setUser(null);
    router.push("/login");
  };

  return <Ctx.Provider value={{ user, loading, logout, reloadUser }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
