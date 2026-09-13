"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatDate, formatRelative, formatCurrency, cn } from "@/lib/utils";
import { Store, Database, BookOpen, MessageSquare, Sparkles, AlertTriangle, RefreshCw, ChevronRight } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

export default function DashboardHome() {
  const { user } = useAuth();
  const [stores, setStores] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [sRes, cRes] = await Promise.all([
          api.get("/shopify/stores").catch(() => ({ data: { stores: [], total: 0 } })),
          api.get("/conversations", { params: { limit: 5 } }).catch(() => ({ data: { conversations: [], total: 0 } })),
        ]);
        setStores(sRes.data.stores || []);
        setConversations(cRes.data.conversations || []);
        const mainStore = sRes.data.stores?.[0];
        if (mainStore) {
          const a = await api.get("/ai/analytics/summary", { params: { store_id: mainStore.id, days: 30 } }).catch(() => null);
          if (a) setAnalytics(a.data);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const mainStore = stores[0];

  const cards = [
    { label: "Conversations (30d)", value: analytics?.total_conversations ?? "-", icon: MessageSquare, color: "from-blue-500 to-blue-700" },
    { label: "AI Handled", value: analytics?.ai_handled_conversations ?? "-", icon: Sparkles, color: "from-emerald-500 to-emerald-700" },
    { label: "Escalated", value: analytics?.escalated_conversations ?? "-", icon: AlertTriangle, color: "from-amber-500 to-amber-700" },
    { label: "Tokens used", value: analytics?.total_tokens_used?.toLocaleString() ?? "-", icon: Database, color: "from-violet-500 to-violet-700" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-sm text-slate-500">Welcome back{user?.name ? `, ${user.name}` : ""}</div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Dashboard overview</h1>
          <p className="mt-1 text-slate-600 text-sm">
            Here's how your AI employee is handling customer conversations today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mainStore ? (
            <>
              <Link href="/dashboard/knowledge" className="h-9 px-4 text-sm rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" /> Add knowledge
              </Link>
              <Link href="/dashboard/test-lab" className="h-9 px-4 text-sm rounded-md bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Test AI
              </Link>
            </>
          ) : (
            <Link href="/dashboard/stores" className="h-9 px-4 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white flex items-center gap-1.5">
              <Store className="w-4 h-4" /> Connect Shopify
            </Link>
          )}
        </div>
      </div>

      {!mainStore && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 mb-4">
            <Store className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Connect your first Shopify store</h2>
          <p className="mt-1 text-slate-600 max-w-lg mx-auto text-sm">
            This allows Solact to answer customer questions with real customer, order, product, and tracking data.
          </p>
          <Link href="/dashboard/stores" className="mt-5 inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-md text-sm font-medium">
            Connect store <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-500">{c.label}</div>
              <div className={cn("h-8 w-8 rounded-lg bg-gradient-to-br text-white flex items-center justify-center", c.color)}>
                <c.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold text-slate-900">{c.value}</div>
            {analytics && typeof analytics.escalation_rate === "number" && i === 2 && (
              <div className="mt-1 text-xs text-slate-500">
                Rate: <span className={analytics.escalation_rate > 0.3 ? "text-red-600 font-medium" : "text-emerald-600 font-medium"}>
                  {(analytics.escalation_rate * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Connected stores</h3>
            <Link href="/dashboard/stores" className="text-sm text-brand-600 hover:underline">Manage</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {stores.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-500">
                No stores connected yet.
              </div>
            )}
            {stores.map((s) => (
              <div key={s.id} className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center text-white", s.is_connected ? "bg-emerald-500" : "bg-slate-400")}>
                    <Store className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 truncate">{s.name || s.shopify_domain}</div>
                    <div className="text-xs text-slate-500 truncate">{s.shopify_domain}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={s.sync_status} />
                  <span className="text-xs text-slate-500">
                    {s.last_sync_at ? formatRelative(s.last_sync_at) : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Top intents</h3>
            <span className="text-xs text-slate-500">30 days</span>
          </div>
          <div className="p-5 space-y-3">
            {!analytics?.top_intents?.length && (
              <div className="text-sm text-slate-500 py-4 text-center">
                No AI runs yet. Connect a store and test the AI in the Test Lab.
              </div>
            )}
            {(analytics?.top_intents || []).map((it: any, i: number) => {
              const max = Math.max(1, ...(analytics?.top_intents || []).map((x: any) => x.count));
              const pct = (it.count / max) * 100;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-700 font-medium">{it.intent || "unknown"}</span>
                    <span className="text-slate-500">{it.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-brand-500 to-brand-700" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Recent conversations</h3>
          <Link href="/dashboard/conversations" className="text-sm text-brand-600 hover:underline">View all</Link>
        </div>
        {conversations.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No conversations yet. Customer messages will appear here once you connect Chatwoot or send test messages.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {conversations.map((c) => (
              <Link key={c.id} href={`/dashboard/conversations?id=${c.id}`} className="px-5 py-3 flex items-center gap-4 hover:bg-slate-50">
                <div className="h-9 w-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-semibold text-sm">
                  {(c.customer_name || c.customer_email || "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">
                    {c.customer_name || c.customer_email || c.customer_phone || "Anonymous customer"}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {c.customer_email || c.customer_phone || "No contact info"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ConversationBadge status={c.status} escalated={c.escalated} />
                  <span className="text-xs text-slate-500">{formatRelative(c.last_message_at || c.created_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, string> = {
    completed: "bg-emerald-50 text-emerald-700 border-emerald-100",
    running: "bg-blue-50 text-blue-700 border-blue-100",
    queued: "bg-amber-50 text-amber-700 border-amber-100",
    failed: "bg-red-50 text-red-700 border-red-100",
    idle: "bg-slate-50 text-slate-600 border-slate-200",
  };
  const cls = map[status || "idle"] || map.idle;
  return <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium capitalize", cls)}>{status || "idle"}</span>;
}

function ConversationBadge({ status, escalated }: { status?: string; escalated?: boolean }) {
  if (escalated) return <span className="text-xs px-2 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-100 font-medium">Escalated</span>;
  const map: Record<string, string> = {
    open: "bg-slate-50 text-slate-600 border-slate-200",
    ai_handling: "bg-brand-50 text-brand-700 border-brand-100",
    awaiting_human: "bg-amber-50 text-amber-700 border-amber-100",
    human_handling: "bg-violet-50 text-violet-700 border-violet-100",
    resolved: "bg-emerald-50 text-emerald-700 border-emerald-100",
    closed: "bg-slate-100 text-slate-600 border-slate-200",
  };
  const cls = map[status || "open"] || map.open;
  return <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium capitalize", cls)}>{(status || "open").replace("_", " ")}</span>;
}
