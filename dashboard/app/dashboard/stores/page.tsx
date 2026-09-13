"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Store, Loader2, Play, PlugZap, AlertTriangle, CheckCircle2, RefreshCw, Database } from "lucide-react";
import { toast } from "sonner";
import { cn, formatDate, formatRelative } from "@/lib/utils";

export default function StoresPage() {
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopInput, setShopInput] = useState("");
  const [installing, setInstalling] = useState(false);
  const [syncStatus, setSyncStatus] = useState<Record<number, any>>({});

  async function reload() {
    try {
      const r = await api.get("/shopify/stores");
      const list = r.data.stores || [];
      setStores(list);
      for (const s of list) {
        const st = await api.get(`/shopify/stores/${s.id}/sync-status`).catch(() => null);
        if (st?.data) {
          setSyncStatus((cur) => ({ ...cur, [s.id]: st.data }));
          if (["running", "queued"].includes(st.data.sync_status)) {
            pollStoreStatus(s.id);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function pollStoreStatus(storeId: number) {
    const maxAttempts = 60; // poll up to 2 minutes
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((res) => setTimeout(res, 2000));
      try {
        const st = await api.get(`/shopify/stores/${storeId}/sync-status`);
        if (st?.data) {
          setSyncStatus((cur) => ({ ...cur, [storeId]: st.data }));
          if (["completed", "failed"].includes(st.data.sync_status)) {
            if (st.data.sync_status === "completed") {
              toast.success("Store sync completed!");
            } else {
              toast.error(st.data.sync_message || "Store sync failed");
            }
            break;
          }
        }
      } catch (err) {
        console.error("Failed to poll store sync status:", err);
      }
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function onInstall(e: React.FormEvent) {
    e.preventDefault();
    setInstalling(true);
    // strip any protocol the user may have pasted
    const shop = shopInput.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    try {
      const r = await api.get("/shopify/install-url", { params: { shop } });
      window.location.href = r.data.install_url;
    } finally {
      setInstalling(false);
    }
  }

  async function triggerSync(s: any) {
    try {
      const r = await api.post(`/shopify/stores/${s.id}/sync`, { force: false, entities: ["customers", "products", "orders"] });
      setSyncStatus((cur) => ({ ...cur, [s.id]: r.data }));
      toast.info("Sync started in background...");
      pollStoreStatus(s.id);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to start sync");
    }
  }

  async function disconnect(s: any) {
    if (!confirm("Disconnect this store? Webhooks will be removed.")) return;
    try {
      const r = await api.post(`/shopify/stores/${s.id}/disconnect`);
      toast.success("Store disconnected");
      reload();
    } catch {}
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stores</h1>
          <p className="text-sm text-slate-600 mt-1">Connect Shopify stores and manage sync status.</p>
        </div>
        <button onClick={reload} className="h-9 px-4 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </header>

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-1">Add a Shopify store</h2>
        <p className="text-sm text-slate-600 mb-4">Enter the myshopify.com domain of the store you want Solact to support.</p>
        <form onSubmit={onInstall} className="flex gap-2 max-w-xl">
          <input required value={shopInput} onChange={(e) => setShopInput(e.target.value)}
            placeholder="mystore.myshopify.com"
            className="flex-1 h-10 rounded-md border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          <button disabled={installing} className="h-10 px-5 rounded-md bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium flex items-center gap-2">
            {installing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />}
            Connect
          </button>
        </form>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Connected stores</h2>
          <span className="text-xs text-slate-500">{stores.length} total</span>
        </div>
        {loading ? (
          <div className="p-10 flex items-center justify-center text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading stores...
          </div>
        ) : stores.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
              <Store className="w-6 h-6" />
            </div>
            <p className="text-sm text-slate-500">No stores connected yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {stores.map((s) => {
              const st = syncStatus[s.id];
              return (
                <div key={s.id} className="p-6 grid lg:grid-cols-[1.2fr,1.4fr,auto] gap-6 items-start">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className={cn("h-11 w-11 rounded-lg flex items-center justify-center text-white", s.is_connected ? "bg-emerald-500" : "bg-slate-400")}>
                        <Store className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900">{s.name || s.shopify_domain}</h3>
                          {s.is_connected && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        </div>
                        <div className="text-xs text-slate-500">{s.shopify_domain}</div>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2 flex-wrap">
                      <button
                        disabled={!s.is_connected || ["running", "queued"].includes(st?.sync_status)}
                        onClick={() => triggerSync(s)}
                        className="h-8 px-3 rounded-md bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5" />
                        {st?.sync_status === "completed" ? "Re-sync" : "Sync store"}
                      </button>
                      {s.is_connected && (
                        <button onClick={() => disconnect(s)} className="h-8 px-3 rounded-md border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-medium flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" /> Disconnect
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-slate-800 flex items-center gap-2">
                        <Database className="w-4 h-4 text-slate-500" /> Sync status
                      </div>
                      <StatusPill status={st?.sync_status || s.sync_status} />
                    </div>
                    {st?.sync_message && (
                      <p className="text-xs text-slate-600 mt-1.5">{st.sync_message}</p>
                    )}
                    <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                      <Stat label="Customers" value={st?.customers_count ?? 0} />
                      <Stat label="Products" value={st?.products_count ?? 0} />
                      <Stat label="Orders" value={st?.orders_count ?? 0} />
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      Last sync: {st?.last_sync_at ? formatRelative(st.last_sync_at) : "never"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 py-2 px-3">
      <div className="text-lg font-bold text-slate-900">{(value ?? 0).toLocaleString()}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">{label}</div>
    </div>
  );
}

function StatusPill({ status }: { status?: string }) {
  const map: Record<string, string> = {
    idle: "bg-slate-100 text-slate-700",
    queued: "bg-amber-100 text-amber-800",
    running: "bg-blue-100 text-blue-800",
    completed: "bg-emerald-100 text-emerald-800",
    failed: "bg-red-100 text-red-800",
  };
  const cls = map[status || "idle"] || map.idle;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full", cls)}>
      {["running", "queued"].includes(status || "") && <Loader2 className="w-3 h-3 animate-spin" />}
      <span className="capitalize">{status || "idle"}</span>
    </span>
  );
}
