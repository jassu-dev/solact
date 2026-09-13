"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { embedDocument } from "@/lib/embeddings";
import {
  BookOpen, Globe, Shield, HelpCircle, FileText,
  Plus, Loader2, Trash2, RefreshCw, ChevronRight, Search, Eye,
} from "lucide-react";
import { cn, formatRelative, formatDate } from "@/lib/utils";
import { toast } from "sonner";

type DocType = "website" | "shipping_policy" | "return_policy" | "warranty" | "faq" | "text";

const DOC_TYPES: { value: DocType; label: string; icon: any; desc: string; prompt_url?: boolean }[] = [
  { value: "website", label: "Website URL", icon: Globe, desc: "Crawl a help center or page URL", prompt_url: true },
  { value: "shipping_policy", label: "Shipping Policy", icon: BookOpen, desc: "Times, costs, carriers, regions" },
  { value: "return_policy", label: "Return / Refund", icon: BookOpen, desc: "Eligibility windows, exceptions" },
  { value: "warranty", label: "Warranty", icon: Shield, desc: "Coverage, duration, process" },
  { value: "faq", label: "FAQ", icon: HelpCircle, desc: "Frequently asked questions" },
  { value: "text", label: "Text / Document", icon: FileText, desc: "Paste any policy or content" },
];

export default function KnowledgePage() {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<DocType | null>(null);
  const [embedding, setEmbedding] = useState(false);
  const [form, setForm] = useState<{ title: string; source_url: string; content_raw: string }>({
    title: "", source_url: "", content_raw: "",
  });

  async function reload() {
    try {
      const r = await api.get("/knowledge/documents");
      setDocs(r.data.documents || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    const t = setInterval(() => {
      setDocs((cur) =>
        cur.map((d) => {
          if (["processing", "pending", "queued"].includes(d.status)) {
            api.get(`/knowledge/documents/${d.id}`).then((r) => r.data).catch(() => null).then((x) => x ? { ...d, ...x } : d);
          }
          return d;
        })
      );
    }, 3000);
    return () => clearInterval(t);
  }, []);

  async function createDoc(type: DocType) {
    if (type === "website" && !form.source_url.trim()) {
      toast.error("Enter a website URL"); return;
    }
    if (type !== "website" && !form.content_raw.trim()) {
      toast.error("Enter content for this document"); return;
    }
    try {
      if (type === "website") {
        // Website: server fetches + embeds (can't crawl from browser)
        await api.post("/knowledge/documents", {
          doc_type: type,
          title: form.title || undefined,
          source_url: form.source_url || undefined,
        });
        toast.success("Document added and queued for processing");
      } else {
        // Text/policy: embed locally, send pre-computed vectors
        setEmbedding(true);
        toast.info("Generating embeddings locally…");
        const chunks = await embedDocument(form.content_raw);
        setEmbedding(false);
        await api.post("/knowledge/documents/ingest", {
          doc_type: type,
          title: form.title || undefined,
          content_raw: form.content_raw,
          chunks,
        });
        toast.success(`Document added — ${chunks.length} chunk${chunks.length !== 1 ? "s" : ""} stored`);
      }
      setForm({ title: "", source_url: "", content_raw: "" });
      setCreating(null);
      reload();
    } catch {
      setEmbedding(false);
    }
  }

  async function processDoc(id: number) {
    try {
      await api.post(`/knowledge/documents/${id}/process`, {});
      toast.info("Re-processing document");
    } finally {
      reload();
    }
  }

  async function deleteDoc(id: number) {
    if (!confirm("Delete this document and all its chunks?")) return;
    try {
      await api.delete(`/knowledge/documents/${id}`);
      toast.success("Document deleted");
      reload();
    } catch {}
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Knowledge base</h1>
          <p className="text-sm text-slate-600 mt-1">
            Add policies and content so the AI can answer customer questions accurately.
          </p>
        </div>
        <button onClick={reload} className="h-9 px-4 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </header>

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">Add knowledge</h2>
          {creating && (
            <button onClick={() => setCreating(null)} className="text-xs text-slate-500 hover:text-slate-700">
              Cancel
            </button>
          )}
        </div>

        {!creating ? (
          <div className="grid md:grid-cols-3 gap-3">
            {DOC_TYPES.map((dt) => (
              <button key={dt.value} onClick={() => setCreating(dt.value)}
                className="group text-left p-4 rounded-lg border border-slate-200 hover:border-brand-400 hover:bg-brand-50/30 transition flex items-start gap-3">
                <div className="h-9 w-9 rounded-md bg-slate-100 group-hover:bg-brand-100 text-slate-600 group-hover:text-brand-700 flex items-center justify-center shrink-0">
                  <dt.icon className="w-4.5 h-4.5" />
                </div>
                <div>
                  <div className="font-medium text-slate-900 text-sm">{dt.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{dt.desc}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600 ml-auto mt-1" />
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3 bg-slate-50/60 border border-slate-200 rounded-lg p-5">
            <div className="flex items-center gap-2 text-sm text-slate-700">
              {(() => {
                const d = DOC_TYPES.find((x) => x.value === creating)!;
                return <>
                  <div className="h-8 w-8 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-600">
                    <d.icon className="w-4 h-4" />
                  </div>
                  <div className="font-medium">{d.label}</div>
                </>;
              })()}
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Title (optional)</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Summer shipping policy 2026"
                  className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              {DOC_TYPES.find((x) => x.value === creating)?.prompt_url && (
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Source URL</label>
                  <input value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })}
                    placeholder="https://help.yourstore.com/shipping"
                    className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              )}
            </div>
            {creating !== "website" && (
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Content</label>
                <textarea
                  rows={8}
                  value={form.content_raw}
                  onChange={(e) => setForm({ ...form, content_raw: e.target.value })}
                  placeholder="Paste the full text of your policy / FAQ here..."
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setCreating(null)}
                className="h-9 px-4 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-sm">Cancel</button>
              <button onClick={() => createDoc(creating)} disabled={embedding}
                className="h-9 px-4 rounded-md bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium flex items-center gap-2">
                {embedding ? <><Loader2 className="w-4 h-4 animate-spin" /> Embedding…</> : <><Plus className="w-4 h-4" /> Add & process</>}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Documents</h2>
          <span className="text-xs text-slate-500">{docs.length} total</span>
        </div>
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" /> Loading documents...
          </div>
        ) : docs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
              <BookOpen className="w-6 h-6" />
            </div>
            <p className="text-sm text-slate-500">No documents yet. Add your shipping / return policies first.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {docs.map((d) => {
              const dt = DOC_TYPES.find((x) => x.value === d.doc_type) || DOC_TYPES[5];
              return (
                <div key={d.id} className="px-6 py-4 flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                    <dt.icon className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-900">{d.title || dt.label}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase tracking-wide font-medium">
                        {d.doc_type.replace("_", " ")}
                      </span>
                      <DocStatus status={d.status} />
                    </div>
                    {d.source_url && (
                      <a href={d.source_url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline truncate max-w-full inline-block">
                        {d.source_url}
                      </a>
                    )}
                    <div className="mt-1.5 flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                      <span>{d.chunk_count} chunks</span>
                      <span>·</span>
                      <span>Added {formatRelative(d.created_at)}</span>
                      {d.status === "failed" && (
                        <>
                          <span>·</span>
                          <span className="text-red-600 truncate max-w-md" title={d.error_message}>
                            {d.error_message}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(d.status === "failed" || d.status === "ready") && (
                      <button onClick={() => processDoc(d.id)}
                        className="h-8 px-3 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5" /> Re-process
                      </button>
                    )}
                    <button onClick={() => deleteDoc(d.id)}
                      className="h-8 px-3 rounded-md border border-red-200 bg-white hover:bg-red-50 text-red-700 text-xs flex items-center gap-1.5">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
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

function DocStatus({ status }: { status?: string }) {
  const map: Record<string, string> = {
    pending: "bg-slate-100 text-slate-600",
    queued: "bg-amber-100 text-amber-700",
    processing: "bg-blue-100 text-blue-700",
    ready: "bg-emerald-100 text-emerald-700",
    failed: "bg-red-100 text-red-700",
  };
  const cls = map[status || "pending"] || map.pending;
  return <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium capitalize", cls)}>{status || "pending"}</span>;
}
