"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import {
  LayoutDashboard,
  Store,
  BookOpen,
  MessageSquare,
  FlaskConical,
  BarChart3,
  Settings,
  LogOut,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/stores", label: "Stores", icon: Store },
  { href: "/dashboard/knowledge", label: "Knowledge & Policies", icon: BookOpen },
  { href: "/dashboard/conversations", label: "Conversations", icon: MessageSquare },
  { href: "/dashboard/agents", label: "Human Agents", icon: Users },
  { href: "/dashboard/test-lab", label: "AI Test Lab", icon: FlaskConical },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed top-0 left-0 h-screen w-64 bg-white border-r border-slate-200 flex flex-col z-30">
        {/* Brand Header with custom icon logo */}
        <div className="h-18 border-b border-slate-200 flex items-center px-5 gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden border border-slate-100 shadow-xs bg-white p-0.5 flex items-center justify-center shrink-0">
            <img src="/icon.png" alt="Solact" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-900 text-base">Solact</span>
              <span className="text-[10px] uppercase tracking-wide bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded-full font-bold border border-brand-200">
                V1
              </span>
            </div>
            <span className="text-[11px] text-slate-400">AI Support for Shopify</span>
          </div>
        </div>

        {/* Sidebar Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-brand-50 text-brand-700 font-semibold shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <item.icon className="w-4.5 h-4.5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Account / Footer */}
        <div className="border-t border-slate-200 p-3 space-y-2">
          <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
            <div className="text-xs font-semibold text-slate-900 truncate">
              {user?.name || user?.email || "Shopify Merchant"}
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              {user?.email || "admin@solact.in"}
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full rounded-xl px-3 py-2 text-xs font-medium text-slate-600 hover:bg-red-50 hover:text-red-700 transition"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      <main className="pl-64 min-h-screen">
        <div className="px-8 py-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
