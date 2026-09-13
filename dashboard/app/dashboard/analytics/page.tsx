"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { BarChart3, TrendingUp, MessageSquare, Sparkles, AlertTriangle, Database, Wrench, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { formatCurrency, cn } from "@/lib/utils";

const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#0ea5e9", "#ec4899"];

export default function AnalyticsPage() {
  const [stores, setStores] = useState<any[]>([]);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [days, setDays] = useState<30>(30);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const s = (await api.get("/shopify/stores")).data.stores || [];
      setStores(s);
      const sid = storeId || s[0]?.id;
      if (sid) {
        setStoreId(sid);
        const r = await api.get("/ai/analytics/summary", { params: { store_id: sid, days } });
        setData(r.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [days]);

  const cards = [
    { label: "Total conversations", value: data?.total_conversations ?? 0, icon: MessageSquare, color: "from-blue-500 to-blue-700" },
    { label: "AI handled", value: data?.ai_handled_conversations ?? 0, icon: Sparkles, color: "from-emerald-500 to-emerald-700" },
    { label: "Escalated", value: data?.escalated_conversations ?? 0, icon: AlertTriangle, color: "from-amber-500 to-amber-700" },
    { label: "Escalation rate", value: `${((data?.escalation_rate || 0) * 100).toFixed(1)}%`, icon: TrendingUp, color: ((data?.escalation_rate || 0) > 0.3) ? "from-red-500 to-red-700" : "from-emerald-500 to-emerald-700" },
    { label: "AI runs", value: data?.total_ai_runs ?? 0, icon: BarChart3, color: "from-violet-500 to-violet-700" },
    { label: "Tokens used", value: (data?.total_tokens_used || 0).toLocaleString(), icon: Database, color: "from-sky-500 to-sky-700" },
    { label: "Tools called", value: data?.total_tools_called ?? 0, icon: Wrench, color: "from-pink-500 to-pink-700" },
  ];

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-sm text-slate-600 mt-1">High-level KPIs and intent mix for the AI employee.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={storeId || ""} onChange={(e) => { setStoreId(Number(e.target.value)); load(); }}
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {!stores.length && <option value="">No stores</option>}
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name || s.shopify_domain}</option>)}
          </select>
          <select
            value={days} onChange={(e) => setDays(Number(e.target.value) as any)}
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </header>

      {loading && <div className="p-10 text-center text-slate-500 text-sm"><Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading analytics...</div>}

      {!loading && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((c, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-500">{c.label}</div>
                  <div className={cn("h-8 w-8 rounded-lg bg-gradient-to-br text-white flex items-center justify-center", c.color)}>
                    <c.icon className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 text-2xl font-bold text-slate-900">{c.value}</div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-slate-900 mb-4">Top intents (last {days} days)</h3>
              {!data?.top_intents?.length ? (
                <div className="h-60 flex items-center justify-center text-sm text-slate-500">
                  No AI runs yet. Try the Test Lab.
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.top_intents} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                      <XAxis dataKey="intent" tick={{ fontSize: 12 }} angle={-20} textAnchor="end" height={50} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-slate-900 mb-4">Conversation outcomes</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "AI handled", value: data?.ai_handled_conversations || 0 },
                        { name: "Escalated", value: data?.escalated_conversations || 0 },
                        { name: "Other", value: Math.max(0, (data?.total_conversations || 0) - (data?.ai_handled_conversations || 0) - (data?.escalated_conversations || 0)) },
                      ].filter((x) => x.value > 0)}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={90}
                      label={(p) => `${p.name}: ${p.value}`}
                    >
                      {COLORS.map((c, i) => <Cell key={i} fill={c} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
