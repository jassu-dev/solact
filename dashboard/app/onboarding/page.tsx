"use client";

import { Suspense, useEffect, useState } from "react";
import { AuthProvider } from "@/components/auth-provider";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, getUser, setAuth } from "@/lib/api";
import { Store, CheckCircle2, ArrowRight, BookOpen, FlaskConical, Loader2 } from "lucide-react";
import { toast } from "sonner";

function OnboardingInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [stores, setStores] = useState<any[]>([]);
  const [shopInput, setShopInput] = useState("");
  const [installing, setInstalling] = useState(false);
  const [syncing, setSyncing] = useState<any>(null);
  const connected = sp.get("connected") === "1";
  const connectedStoreId = sp.get("store_id");

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("/shopify/stores");
        setStores(r.data.stores || []);
        if (connectedStoreId) {
          const s = (r.data.stores || []).find((x: any) => String(x.id) === String(connectedStoreId));
          if (s) {
            setSyncing({ id: s.id, status: s.sync_status, message: s.sync_message });
            toast.success("Store connected successfully!");
          }
        }
      } catch {}
    })();
  }, [connectedStoreId]);

  const mainStore = stores[0];

  async function onInstall(e: React.FormEvent) {
    e.preventDefault();
    setInstalling(true);
    try {
      const r = await api.get("/shopify/install-url", { params: { shop: shopInput } });
      window.location.href = r.data.install_url;
    } finally {
      setInstalling(false);
    }
  }

  async function triggerSync(storeId: number) {
    try {
      const r = await api.post(`/shopify/stores/${storeId}/sync`, { force: false, entities: ["customers", "products", "orders"] });
      setSyncing({ id: storeId, status: r.data.sync_status, message: r.data.sync_message });
      toast.info("Sync started. This may take a minute.");
    } catch {}
  }

  const steps = [
    { title: "Create account", done: true },
    { title: "Connect Shopify store", done: stores.some((s) => s.is_connected) },
    { title: "Sync store data", done: stores.some((s) => s.sync_status === "completed") },
    { title: "Add knowledge / policies", done: false, link: "/dashboard/knowledge" },
    { title: "Test the AI", done: false, link: "/dashboard/test-lab" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/60 via-white to-white">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center font-bold">S</div>
            <span className="font-bold text-slate-900">Solact</span>
          </Link>
          <Link href="/dashboard" className="text-sm text-slate-600 hover:text-slate-900">Skip to dashboard →</Link>
        </div>

        <div className="mt-14">
          <h1 className="text-3xl font-bold text-slate-900">Let's get you up and running</h1>
          <p className="mt-1 text-slate-600">
            5 quick steps to your 24/7 AI customer support employee.
          </p>
        </div>

        <div className="mt-10 grid md:grid-cols-[240px,1fr] gap-8">
          <ol className="space-y-5">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <div className={`h-7 w-7 rounded-full border flex items-center justify-center text-sm font-semibold shrink-0 ${s.done ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-slate-600 border-slate-300"}`}>
                  {s.done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                <div className="pt-0.5">
                  {s.link ? (
                    <Link href={s.link} className={`font-medium ${s.done ? "text-emerald-700" : "text-slate-900"} hover:underline`}>{s.title}</Link>
                  ) : (
                    <div className={`font-medium ${s.done ? "text-emerald-700" : "text-slate-900"}`}>{s.title}</div>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            {!mainStore?.is_connected ? (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-11 w-11 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-900">Step 2 · Connect your Shopify store</h2>
                    <p className="text-sm text-slate-600">Enter your store's myshopify.com domain.</p>
                  </div>
                </div>
                <form onSubmit={onInstall} className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      required value={shopInput}
                      onChange={(e) => setShopInput(e.target.value)}
                      placeholder="mystore.myshopify.com"
                      className="flex-1 h-10 rounded-md border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <button
                      disabled={installing}
                      className="h-10 px-5 rounded-md bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium flex items-center gap-2"
                    >
                      {installing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                      Connect
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">
                    We'll request read-only scopes for customers, products, orders and fulfillments.
                  </p>
                </form>
              </div>
            ) : !syncing?.status || syncing?.status === "idle" ? (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-11 w-11 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-900">Step 3 · Sync your store data</h2>
                    <p className="text-sm text-slate-600">{mainStore.name} is connected. Pull your products, customers, orders.</p>
                  </div>
                </div>
                <button
                  onClick={() => triggerSync(mainStore.id)}
                  className="h-10 px-5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium flex items-center gap-2"
                >
                  Start initial sync <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-11 w-11 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Loader2 className={`w-5 h-5 ${syncing.status !== "completed" && syncing.status !== "failed" ? "animate-spin" : ""}`} />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-900 capitalize">Sync: {syncing.status || "queued"}</h2>
                    <p className="text-sm text-slate-600">{syncing.message || "Working on it..."}</p>
                  </div>
                </div>
                {syncing.status === "completed" && (
                  <div className="flex gap-3 flex-wrap">
                    <Link href="/dashboard/knowledge" className="h-9 px-4 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium flex items-center gap-2">
                      <BookOpen className="w-4 h-4" /> Next: Add knowledge
                    </Link>
                    <Link href="/dashboard/test-lab" className="h-9 px-4 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-medium flex items-center gap-2">
                      <FlaskConical className="w-4 h-4" /> Skip to Test Lab
                    </Link>
                  </div>
                )}
                {syncing.status === "failed" && (
                  <button onClick={() => triggerSync(syncing.id)} className="h-9 px-4 rounded-md border border-red-200 bg-red-50 text-red-700 text-sm font-medium">
                    Retry sync
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-b from-brand-50/60 via-white to-white p-6">Loading onboarding...</div>}>
      <AuthProvider>
        <OnboardingInner />
      </AuthProvider>
    </Suspense>
  );
}
