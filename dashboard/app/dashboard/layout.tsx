"use client";

import DashboardShell from "@/components/dashboard-shell";
import { AuthProvider } from "@/components/auth-provider";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  );
}
