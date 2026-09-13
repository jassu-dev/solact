"use client";

import { useEffect, useState } from "react";
import { api, getUser } from "@/lib/api";
import { Settings, Key, MessageSquare, Database, ShieldCheck, Save, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [org, setOrg] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [llm, setLlm] = useState({
    base_url: process.env.NEXT_PUBLIC_LLM_BASE || "",
    model: process.env.NEXT_PUBLIC_LLM_MODEL || "",
    api_key: "",
  });
  const [cw, setCw] = useState({
    url: process.env.NEXT_PUBLIC_CHATWOOT_URL || "",
    account_id: process.env.NEXT_PUBLIC_CHATWOOT_ACCOUNT_ID || "",
    token: "",
  });

  useEffect(() => {
    (async () => {
      const me = await api.get("/auth/me").catch(() => null);
      const orgRes = await api.get("/auth/organization").catch(() => null);
      const healthRes = await api.get("/health").catch(() => null);
      if (me) setUser(me.data);
      if (orgRes) setOrg(orgRes.data);
      if (healthRes) setHealth(healthRes.data);
    })();
    const u = getUser();
    if (u && !user) setUser(u);
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-600 mt-1">API keys, integrations, and system status.</p>
      </header>

      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2">
          <Database className="w-4.5 h-4.5 text-brand-600" /> Account
        </h2>
        <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm">
          <Field label="Organization"><span className="text-slate-800 font-medium">{org?.name || "—"}</span> <span className="text-xs text-slate-500 ml-2">slug: {org?.slug}</span></Field>
          <Field label="Member email"><span className="text-slate-800 font-medium">{user?.email || "—"}</span></Field>
          <Field label="Your name"><span className="text-slate-800 font-medium">{user?.name || "—"}</span></Field>
          <Field label="Role"><span className="text-slate-800 capitalize">{user?.role || "—"}</span></Field>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2">
          <Key className="w-4.5 h-4.5 text-brand-600" /> LLM Provider
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Configure the LLM used by the AI employee. Solact works with any OpenAI-compatible API.
        </p>
        <div className="mt-4 grid md:grid-cols-3 gap-3">
          <Input label="API Base URL" value={llm.base_url} onChange={(v) => setLlm({ ...llm, base_url: v })}
            placeholder="https://api.openai.com/v1" />
          <Input label="Model name" value={llm.model} onChange={(v) => setLlm({ ...llm, model: v })}
            placeholder="gpt-4o-mini" />
          <Input label="API Key" type="password" value={llm.api_key} onChange={(v) => setLlm({ ...llm, api_key: v })}
            placeholder="sk-..." />
        </div>
        <div className="mt-3 text-xs text-slate-500">
          V1 reads these values from server-side <code className="px-1.5 py-0.5 rounded bg-slate-100">.env</code>. Input above is for reference only; edit the env file or container secrets to change.
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2">
          <MessageSquare className="w-4.5 h-4.5 text-brand-600" /> Chatwoot Integration
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Chatwoot handles the customer-facing inbox and human handoff. Connect to the same inbox as your website widget / email channel.
        </p>
        <div className="mt-4 grid md:grid-cols-3 gap-3">
          <Input label="Chatwoot URL" value={cw.url} onChange={(v) => setCw({ ...cw, url: v })}
            placeholder="https://chatwoot.example.com" />
          <Input label="Account ID" value={cw.account_id} onChange={(v) => setCw({ ...cw, account_id: v })}
            placeholder="1" />
          <Input label="API Token" type="password" value={cw.token} onChange={(v) => setCw({ ...cw, token: v })}
            placeholder="user_api_access_token" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md p-3.5">
          <span className="font-medium text-slate-700">Chatwoot webhook URL to configure (in Chatwoot → Integrations → Webhooks):</span>
          <code className="font-mono bg-white border border-slate-200 rounded px-2 py-1">
            {(typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_API_BASE_URL || window.location.origin.replace(":3001", ":8000") + "/api/v1") : "")}/integrations/chatwoot/webhook
          </code>
          <span className="text-slate-500">Subscribe to: <code className="bg-white border px-1.5 py-0.5 rounded">message_created</code>, <code className="bg-white border px-1.5 py-0.5 rounded">conversation_created</code>.</span>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-4.5 h-4.5 text-brand-600" /> System status
        </h2>
        <div className="mt-4 grid md:grid-cols-3 gap-3 text-sm">
          <Pill label="Application" value={health?.status || "unknown"} ok={health?.status === "ok"} />
          <Pill label="PostgreSQL" value={health?.postgres || "unknown"} ok={(health?.postgres || "").includes("ok")} />
          <Pill label="Redis" value={health?.redis || "unknown"} ok={(health?.redis || "").includes("ok")} />
        </div>
        <div className="mt-5 flex items-center gap-3 flex-wrap">
          <a href="http://localhost:8000/api/v1/health" target="_blank" rel="noreferrer"
            className="text-xs px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5">
            <ExternalLink className="w-3 h-3" /> Open /health
          </a>
          <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer"
            className="text-xs px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5">
            <ExternalLink className="w-3 h-3" /> Open Swagger docs
          </a>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 block mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
    </div>
  );
}

function Pill({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/40 px-3 py-2 flex items-center justify-between">
      <div className="text-xs text-slate-500 uppercase tracking-wide font-medium">{label}</div>
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full ${ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`} />
        {value}
      </span>
    </div>
  );
}
