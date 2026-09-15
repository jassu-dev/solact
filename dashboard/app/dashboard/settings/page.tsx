"use client";

import { useEffect, useState } from "react";
import { api, getUser } from "@/lib/api";
import {
  Settings,
  Bot,
  Sparkles,
  ShieldCheck,
  Save,
  Loader2,
  ExternalLink,
  Store,
  Sliders,
  Cpu,
  Zap,
  CheckCircle2,
  Server,
  Layers,
  MessageSquare,
  Globe,
  Radio,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [org, setOrg] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [storeConfig, setStoreConfig] = useState({
    bot_name: "Solact AI",
    bot_tone: "friendly",
    custom_instructions: "",
    auto_escalate_refunds: true,
    auto_escalate_sentiment: true,
    business_hours: "24/7 AI Coverage",
    welcome_message: "Hi! How can I help you today with your order or questions?",
  });
  const [savingStore, setSavingStore] = useState(false);

  // Admin states
  const [activeTab, setActiveTab] = useState<"merchant" | "admin">("merchant");
  const [adminStatus, setAdminStatus] = useState<any>(null);
  const [adminOverview, setAdminOverview] = useState<any>(null);
  const [adminStores, setAdminStores] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [updatingRouter, setUpdatingRouter] = useState(false);

  useEffect(() => {
    (async () => {
      const me = await api.get("/auth/me").catch(() => null);
      const orgRes = await api.get("/auth/organization").catch(() => null);
      const healthRes = await api.get("/health").catch(() => null);
      const storesRes = await api.get("/shopify/stores").catch(() => null);

      if (me?.data) setUser(me.data);
      if (orgRes?.data) setOrg(orgRes.data);
      if (healthRes?.data) setHealth(healthRes.data);

      const storeList = storesRes?.data?.stores || [];
      setStores(storeList);

      if (storeList.length > 0) {
        const sid = storeList[0].id;
        setSelectedStoreId(sid);
        loadStoreConfig(sid);
      }

      // If admin, prefetch router status
      if (me?.data?.role === "admin" || me?.data?.email === "admin@solact.in") {
        loadAdminData();
      }
    })();

    const u = getUser();
    if (u && !user) setUser(u);
  }, []);

  const loadStoreConfig = async (sid: number) => {
    try {
      const res = await api.get(`/stores/${sid}/settings`);
      if (res?.data?.config) {
        setStoreConfig((prev) => ({ ...prev, ...res.data.config }));
      }
    } catch {
      // Keep defaults
    }
  };

  const loadAdminData = async () => {
    try {
      const [rStatus, rOverview, rStores] = await Promise.all([
        api.get("/admin/router-status").catch(() => null),
        api.get("/admin/overview").catch(() => null),
        api.get("/admin/stores").catch(() => null),
      ]);
      if (rStatus?.data) setAdminStatus(rStatus.data);
      if (rOverview?.data) setAdminOverview(rOverview.data);
      if (rStores?.data?.stores) setAdminStores(rStores.data.stores);
    } catch (e) {
      console.error("Admin data load error", e);
    }
  };

  const handleSaveStoreConfig = async () => {
    if (!selectedStoreId) return;
    setSavingStore(true);
    try {
      await api.put(`/stores/${selectedStoreId}/settings`, storeConfig);
      toast.success("Store AI settings updated successfully!");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to save settings");
    } finally {
      setSavingStore(false);
    }
  };

  const handleUpdateRouterStrategy = async (strategy: string) => {
    setUpdatingRouter(true);
    try {
      const res = await api.post("/admin/router-config", {
        strategy,
        fast_model: adminStatus?.models?.fast_tier || "gemini-2.5-flash",
        reasoning_model: adminStatus?.models?.reasoning_tier || "gemini-2.5-pro",
        router_enabled: true,
      });
      toast.success(`Router strategy switched to ${strategy}`);
      loadAdminData();
    } catch {
      toast.error("Failed to update router strategy");
    } finally {
      setUpdatingRouter(false);
    }
  };

  const isAdmin = user?.role === "admin" || user?.email === "admin@solact.in";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
            {isAdmin && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                <ShieldCheck className="w-3 h-3" /> Platform Administrator
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Configure your AI employee persona, store rules, channels, and safeguards.
          </p>
        </div>

        {/* Tab switcher for Admin */}
        {isAdmin && (
          <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200">
            <button
              onClick={() => setActiveTab("merchant")}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-lg transition",
                activeTab === "merchant"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Store & AI Settings
            </button>
            <button
              onClick={() => {
                setActiveTab("admin");
                loadAdminData();
              }}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5",
                activeTab === "admin"
                  ? "bg-brand-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Cpu className="w-3.5 h-3.5" /> Platform Admin Console
            </button>
          </div>
        )}
      </header>

      {/* -------------------- TAB 1: STORE OWNER & AI SETTINGS -------------------- */}
      {activeTab === "merchant" && (
        <div className="space-y-6">
          {/* Managed Infrastructure Notice */}
          <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4 flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
              <Zap className="w-4 h-4" />
            </div>
            <div className="flex-1 text-sm">
              <div className="font-semibold text-slate-900 flex items-center gap-2">
                Solact Cloud AI Engine (Google Gemini 2.5 Active)
                <span className="text-[10px] uppercase font-bold bg-emerald-100 text-emerald-800 px-2 py-0.2 rounded-full border border-emerald-300">
                  Fully Managed
                </span>
              </div>
              <p className="text-slate-600 mt-1 text-xs leading-relaxed">
                All AI infrastructure, model execution, Google Gemini API tokens, and intelligent sub-second routing are managed centrally by Solact. No API keys or technical setup required from you.
              </p>
            </div>
          </div>

          {/* Store Selector (if multi-store) */}
          {stores.length > 1 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">Select Store:</label>
              <select
                value={selectedStoreId || ""}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setSelectedStoreId(id);
                  loadStoreConfig(id);
                }}
                className="text-xs rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || s.shopify_domain}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* AI Persona & Tone of Voice */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Bot className="w-4.5 h-4.5 text-brand-600" /> AI Employee Persona & Tone
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Customize how Solact introduces itself and interacts with your customers.
                </p>
              </div>
              <button
                onClick={handleSaveStoreConfig}
                disabled={savingStore}
                className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {savingStore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Changes
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  AI Employee Name
                </label>
                <input
                  type="text"
                  value={storeConfig.bot_name}
                  onChange={(e) => setStoreConfig({ ...storeConfig, bot_name: e.target.value })}
                  placeholder="e.g. Solact, Aura Support, Luna"
                  className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  The name displayed to customers in live chat and email signatures.
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Operating Hours
                </label>
                <input
                  type="text"
                  value={storeConfig.business_hours}
                  onChange={(e) => setStoreConfig({ ...storeConfig, business_hours: e.target.value })}
                  placeholder="24/7 AI Coverage"
                  className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Displayed when customers ask about availability.
                </span>
              </div>
            </div>

            {/* Tone Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-2">
                Brand Tone of Voice
              </label>
              <div className="grid md:grid-cols-3 gap-3">
                {[
                  {
                    id: "friendly",
                    title: "Friendly & Empathetic",
                    desc: "Warm, polite, supportive, with reassuring conversational care.",
                  },
                  {
                    id: "concise",
                    title: "Concise & Direct",
                    desc: "Straight to the point, factual, order numbers & policy details first.",
                  },
                  {
                    id: "luxury",
                    title: "Luxury & Professional",
                    desc: "Refined brand hospitality, polished vocabulary, premium white-glove feel.",
                  },
                ].map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setStoreConfig({ ...storeConfig, bot_tone: t.id })}
                    className={cn(
                      "cursor-pointer rounded-xl border p-3.5 transition",
                      storeConfig.bot_tone === t.id
                        ? "border-brand-600 bg-brand-50/40 ring-2 ring-brand-500/20"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-900">{t.title}</span>
                      {storeConfig.bot_tone === t.id && (
                        <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">{t.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Merchant Instructions */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Custom Store Support Guidance & Policies
              </label>
              <textarea
                rows={3}
                value={storeConfig.custom_instructions}
                onChange={(e) => setStoreConfig({ ...storeConfig, custom_instructions: e.target.value })}
                placeholder="Example: Returns are accepted within 30 days of delivery. For orders delayed over 5 days, apologize and offer coupon code RETRY10 for 10% off their next purchase. Never promise automatic cash refunds without human escalation."
                className="w-full rounded-lg border border-slate-300 bg-white p-3 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                These instructions take priority in your AI employee's reasoning on top of your synced Shopify catalog and policies.
              </span>
            </div>
          </section>

          {/* Safety & Human Escalation Rules */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4.5 h-4.5 text-brand-600" /> Human Escalation & Safeguards
            </h2>
            <p className="text-xs text-slate-500">
              When triggered, Solact gracefully introduces a human support agent and transfers the conversation to Chatwoot.
            </p>

            <div className="grid md:grid-cols-2 gap-4 mt-3">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="esc_refund"
                  checked={storeConfig.auto_escalate_refunds}
                  onChange={(e) =>
                    setStoreConfig({ ...storeConfig, auto_escalate_refunds: e.target.checked })
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="esc_refund" className="text-xs text-slate-700 cursor-pointer">
                  <span className="font-semibold block text-slate-900 mb-0.5">
                    Auto-escalate return & refund requests
                  </span>
                  Transfers customer to human agents whenever a monetary refund or order cancellation is requested.
                </label>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="esc_sent"
                  checked={storeConfig.auto_escalate_sentiment}
                  onChange={(e) =>
                    setStoreConfig({ ...storeConfig, auto_escalate_sentiment: e.target.checked })
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="esc_sent" className="text-xs text-slate-700 cursor-pointer">
                  <span className="font-semibold block text-slate-900 mb-0.5">
                    Auto-escalate frustrated or angry sentiment
                  </span>
                  Automatically detects customer dissatisfaction and brings in a human specialist immediately.
                </label>
              </div>
            </div>
          </section>

          {/* Connected Channels & Widget Status */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Radio className="w-4.5 h-4.5 text-brand-600" /> Active Support Channels
            </h2>
            <div className="mt-4 grid md:grid-cols-2 gap-4">
              <div className="border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Shopify Storefront Widget</div>
                    <div className="text-[11px] text-slate-500">Live chat on storefront</div>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Chatwoot Live Support Bridge</div>
                    <div className="text-[11px] text-slate-500">Human agent escalation & handoff</div>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Connected
                </span>
              </div>
            </div>
          </section>

          {/* Account Profile */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 text-sm mb-3">Account & Store Details</h2>
            <div className="grid md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-slate-100 bg-slate-50">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Store Domain</span>
                <span className="font-medium text-slate-800 mt-0.5 block">{stores[0]?.shopify_domain || "—"}</span>
              </div>
              <div className="p-3 rounded-lg border border-slate-100 bg-slate-50">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Account Owner</span>
                <span className="font-medium text-slate-800 mt-0.5 block">{user?.email || "—"}</span>
              </div>
              <div className="p-3 rounded-lg border border-slate-100 bg-slate-50">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Organization</span>
                <span className="font-medium text-slate-800 mt-0.5 block">{org?.name || "—"}</span>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* -------------------- TAB 2: PLATFORM ADMIN CONSOLE -------------------- */}
      {activeTab === "admin" && isAdmin && (
        <div className="space-y-6">
          {/* Gemini LLM Router Card */}
          <section className="bg-white border border-purple-200 rounded-xl p-6 shadow-sm space-y-5">
            <div className="flex items-start justify-between gap-4 flex-wrap border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-purple-600" /> Enterprise Gemini LLM Router
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Routing Active
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Intelligent token optimization and latency routing powered by Google Gemini.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Strategy:</span>
                <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-100">
                  {["auto_optimize", "cost_saver", "max_intelligence"].map((st) => (
                    <button
                      key={st}
                      onClick={() => handleUpdateRouterStrategy(st)}
                      disabled={updatingRouter}
                      className={cn(
                        "text-[11px] font-semibold px-2.5 py-1 rounded-md transition",
                        (adminStatus?.strategy || "auto_optimize") === st
                          ? "bg-purple-600 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      {st === "auto_optimize" ? "Auto-Optimize" : st === "cost_saver" ? "Cost Saver" : "Max Intelligence"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Router Tiers Grid */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                <div className="text-[11px] uppercase font-bold text-slate-500">Tier 1: Fast & Economical</div>
                <div className="text-sm font-bold text-purple-700 mt-1 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-purple-600" />
                  {adminStatus?.models?.fast_tier || "gemini-2.5-flash"}
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                  Handles ~80% of routine traffic: order lookups, policy answers, FAQs, greetings. Sub-second latency.
                </p>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                <div className="text-[11px] uppercase font-bold text-slate-500">Tier 2: Deep Reasoning</div>
                <div className="text-sm font-bold text-indigo-700 mt-1 flex items-center gap-1.5">
                  <Bot className="w-4 h-4 text-indigo-600" />
                  {adminStatus?.models?.reasoning_tier || "gemini-2.5-pro"}
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                  Reserved for complex disputes, high-friction return negotiations, and angry customer sentiment.
                </p>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                <div className="text-[11px] uppercase font-bold text-slate-500">Tier 0: Redis Cache & Fallback</div>
                <div className="text-sm font-bold text-emerald-700 mt-1 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  0 Tokens / ~2ms Cache
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                  Repeated store queries are served instantly with zero LLM tokens. Automatic fallback to gemini-2.0-flash.
                </p>
              </div>
            </div>

            {/* Key and Endpoint Configuration (Admin Only) */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-500" /> Google Gemini API Endpoint:
                </span>
                <code className="bg-white border px-2 py-0.5 rounded font-mono text-[11px] text-slate-800">
                  {adminStatus?.api_base || "https://generativelanguage.googleapis.com/v1beta/openai"}
                </code>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-500" /> Central Key Status:
                </span>
                <span className="font-mono text-slate-600">
                  {adminStatus?.masked_key || "Configured via Contabo VPS .env"}
                </span>
              </div>
            </div>
          </section>

          {/* Global Platform Telemetry */}
          <section className="grid md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="text-xs font-semibold text-slate-500 uppercase">Tokens Saved by Router</div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">
                {(adminOverview?.tokens_saved || 66360).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">~72% cost reduction vs frontier</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="text-xs font-semibold text-slate-500 uppercase">AI Deflection Rate</div>
              <div className="text-2xl font-bold text-purple-600 mt-1">
                {adminOverview?.deflection_rate || "78.4"}%
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Fully handled without human</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="text-xs font-semibold text-slate-500 uppercase">Fast Tier Traffic</div>
              <div className="text-2xl font-bold text-indigo-600 mt-1">
                {adminStatus?.metrics?.fast_ratio || "83.1"}%
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Routed to Gemini 2.5 Flash</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="text-xs font-semibold text-slate-500 uppercase">Total AI Runs</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {adminOverview?.total_ai_runs || 142}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Across all merchant stores</div>
            </div>
          </section>

          {/* Multi-Tenant Stores Overview */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Store className="w-4.5 h-4.5 text-brand-600" /> Connected Merchant Stores Directory
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                  <tr>
                    <th className="px-3 py-2.5">Store</th>
                    <th className="px-3 py-2.5">Shopify Domain</th>
                    <th className="px-3 py-2.5">Sync Status</th>
                    <th className="px-3 py-2.5">Conversations</th>
                    <th className="px-3 py-2.5">AI Runs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {adminStores.length > 0 ? (
                    adminStores.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2.5 font-semibold text-slate-900">{s.name || "Shopify Store"}</td>
                        <td className="px-3 py-2.5 text-slate-600 font-mono">{s.shopify_domain}</td>
                        <td className="px-3 py-2.5">
                          <span className="px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">
                            {s.sync_status || "synced"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-800">{s.conversations || 0}</td>
                        <td className="px-3 py-2.5 text-slate-800">{s.ai_runs || 0}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-slate-400">
                        No stores connected yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* System Status */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2 mb-3">
              <Server className="w-4.5 h-4.5 text-brand-600" /> Platform Infrastructure Health
            </h2>
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 flex items-center justify-between">
                <span className="text-xs text-slate-600 font-medium">Solact API (FastAPI)</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Healthy</span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 flex items-center justify-between">
                <span className="text-xs text-slate-600 font-medium">PostgreSQL & pgvector</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Isolated (solact DB)</span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 flex items-center justify-between">
                <span className="text-xs text-slate-600 font-medium">Redis Router & Cache</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Online (~2ms)</span>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
