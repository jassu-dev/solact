"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import {
  FlaskConical, Send, Loader2, Sparkles, Database, Search,
  Wrench, Bot, AlertTriangle, Shield, ChevronDown, ChevronRight,
  ZoomIn, User, Package, ClipboardList, MapPin, CheckCircle2, XCircle,
  Activity, Zap,
} from "lucide-react";
import { cn, formatDate, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import React from "react";

class TestLabErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("TestLab ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
          <div className="flex items-center gap-2 font-semibold text-lg">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            An error occurred while displaying the AI test results
          </div>
          <p className="mt-2 text-sm text-red-700">
            {this.state.error?.message || "Unknown error"}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md"
          >
            Retry Test Lab
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function TestLabPage() {
  return (
    <TestLabErrorBoundary>
      <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading test lab...</div>}>
        <TestLabPageContent />
      </Suspense>
    </TestLabErrorBoundary>
  );
}

function TestLabPageContent() {
  const sp = useSearchParams();
  const initialRunId = sp.get("run_id");
  const prefill = sp.get("q") || "";
  const [query, setQuery] = useState(prefill || "Where is order #10492?");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (initialRunId) loadRun(initialRunId);
  }, [initialRunId]);

  const loadRun = async (id: any) => {
    setLoading(true);
    try {
      const r = await api.get(`/ai/runs/${id}`);
      setResult(r.data);
    } catch {
      toast.error("Run not found");
    } finally {
      setLoading(false);
    }
  };

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await api.post("/ai/test-lab", { query: query.trim() });
      setResult(r.data);
      setOpen({ response: true, shopify: true, tools: true, knowledge: true });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Failed to execute AI test run";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <FlaskConical className="w-4 h-4 text-brand-600" /> AI Test Lab
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Debug the AI employee</h1>
        <p className="text-sm text-slate-600 mt-1">
          Enter a realistic customer question to see exactly how Solact detects intent, retrieves data, uses tools, and decides whether to answer or escalate.
        </p>
      </header>

      <form onSubmit={run} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <label className="text-sm font-medium text-slate-700 block mb-2">Customer message</label>
        <div className="flex gap-2 items-start">
          <textarea
            rows={3}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Example: Where is order #10492? It never arrived."
            className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            disabled={loading || !query.trim()}
            className="h-11 px-5 rounded-md bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-medium flex items-center gap-2 shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Run
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            "Where is order #10492?",
            "Can I return an order I placed 2 weeks ago?",
            "Tell me about the Premium Widget",
            "How long does shipping take to California?",
            "I want to speak to a human agent NOW",
            "My order arrived broken, I need a refund",
          ].map((q) => (
            <button
              key={q} type="button" onClick={() => setQuery(q)}
              className="text-xs px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-brand-50 hover:border-brand-200 hover:text-brand-700 text-slate-600 transition"
            >
              {q}
            </button>
          ))}
        </div>
      </form>

      {!result && !loading && (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
          <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Run any customer message above to see a full AI trace.</p>
        </div>
      )}

      {loading && !result && (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center shadow-sm">
          <Loader2 className="w-6 h-6 text-brand-600 animate-spin mx-auto mb-3" />
          <div className="text-sm text-slate-600">AI is thinking, retrieving data, and running tools...</div>
        </div>
      )}

      {result && (
        <div className="space-y-5">
          <Row openKey="response" title="Final AI response" icon={Bot} accent="brand" defaultOpen
            right={
              <div className="flex items-center gap-2 text-xs">
                {result.raw_llm_response?.includes("REDIS CACHE HIT") && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                    <Zap className="w-3 h-3 text-indigo-600 fill-indigo-600" /> Redis Cached (~10ms)
                  </span>
                )}
                {result.raw_llm_response?.includes("INSTANT GREETING") && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                    <Zap className="w-3 h-3 text-amber-600 fill-amber-600" /> Instant Greeting (&lt;1ms)
                  </span>
                )}
                {result.raw_llm_response?.includes("INSTANT HANDOFF") && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
                    <Zap className="w-3 h-3 text-orange-600 fill-orange-600" /> Instant Handoff (&lt;1ms)
                  </span>
                )}
                {result.escalated ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                    <AlertTriangle className="w-3 h-3" /> Escalated
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Answered
                  </span>
                )}
                {result.safety_passed ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium">
                    <Shield className="w-3 h-3" /> Safety OK
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-100 font-medium">
                    <XCircle className="w-3 h-3" /> {result.safety_reason || "Unsafe"}
                  </span>
                )}
              </div>
            }
            open={open} toggle={toggle}>
            <div className="whitespace-pre-wrap rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm leading-relaxed text-slate-800">
              {result.final_response || "(no response generated)"}
            </div>
            {(result.escalation_reason || result.error_message) && (
              <div className="mt-3 text-sm text-slate-600">
                <strong className="text-slate-800">Escalation reason:</strong>{" "}
                <span className="text-red-700">{result.escalation_reason || result.error_message}</span>
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <Metric label="Model" value={result.llm_model || "—"} />
              <Metric label="Prompt tokens" value={result.prompt_tokens} />
              <Metric label="Completion tokens" value={result.completion_tokens} />
              <Metric label="Total tokens" value={result.total_tokens} />
            </div>
          </Row>

          <Row openKey="intent" title={`Intent · ${result.intent || "unknown"}${result.intent_confidence ? ` (${(result.intent_confidence * 100).toFixed(0)}%)` : ""}`}
            icon={Search} accent="violet" defaultOpen open={open} toggle={toggle}>
            <div className="text-sm text-slate-600">
              The AI classified this message under this intent, which drives what tools and knowledge get used.
            </div>
          </Row>

          <Row openKey="shopify" title="Identified Shopify context" icon={Database} accent="blue" defaultOpen open={open} toggle={toggle}>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-2">
                  <User className="w-3.5 h-3.5" /> Customer
                </div>
                {result.identified_customer ? (
                  <div className="space-y-1.5 text-sm">
                    <div><span className="text-slate-500">Name:</span> <span className="text-slate-800 font-medium">{result.identified_customer.first_name || ""} {result.identified_customer.last_name || ""}</span></div>
                    <div><span className="text-slate-500">Email:</span> <span className="text-slate-800">{result.identified_customer.email || "—"}</span></div>
                    <div><span className="text-slate-500">Phone:</span> <span className="text-slate-800">{result.identified_customer.phone || "—"}</span></div>
                    <div><span className="text-slate-500">Orders:</span> <span className="text-slate-800">{result.identified_customer.orders_count || 0} · {formatCurrency(result.identified_customer.total_spent)} lifetime</span></div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">No customer matched (not enough info in message).</div>
                )}
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-2">
                  <ClipboardList className="w-3.5 h-3.5" /> Order
                </div>
                {result.identified_order ? (
                  <div className="space-y-1.5 text-sm">
                    <div><span className="text-slate-500">Name:</span> <span className="text-slate-800 font-medium">{result.identified_order.name || "—"}</span></div>
                    <div><span className="text-slate-500"># items:</span> <span className="text-slate-800">{result.identified_order.items_count || 0}</span></div>
                    <div><span className="text-slate-500">Status:</span> <Badge v={result.identified_order.status} /></div>
                    <div><span className="text-slate-500">Payment:</span> <span className="text-slate-800">{result.identified_order.financial_status || "—"}</span></div>
                    <div><span className="text-slate-500">Fulfillment:</span> <span className="text-slate-800">{result.identified_order.fulfillment_status || "—"}</span></div>
                    <div><span className="text-slate-500">Total:</span> <span className="text-slate-800 font-medium">{formatCurrency(result.identified_order.total_price)}</span></div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">No order matched.</div>
                )}
              </div>
            </div>
            {result.shopify_context && typeof result.shopify_context === "object" && Object.keys(result.shopify_context).length > 0 && (
              <details className="mt-4">
                <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">Show raw shopify context JSON</summary>
                <pre className="mt-2 text-xs bg-slate-50 border border-slate-200 p-3 rounded-lg overflow-x-auto scrollbar-thin max-h-60">
                  {JSON.stringify(result.shopify_context, null, 2)}
                </pre>
              </details>
            )}
          </Row>

          <Row openKey="knowledge" title={`Retrieved knowledge chunks (${result.knowledge_chunks?.length || 0})`}
            icon={Search} accent="emerald" defaultOpen open={open} toggle={toggle}>
            {!result.knowledge_chunks?.length ? (
              <p className="text-sm text-slate-500">No relevant knowledge found for this query. Consider adding policies / FAQs.</p>
            ) : (
              <div className="space-y-3">
                {result.knowledge_chunks.map((k: any, i: number) => (
                  <div key={i} className="rounded-lg border border-slate-200 bg-slate-50/40 p-3.5">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-white border border-slate-200 font-medium uppercase tracking-wide text-slate-600">
                          {String(k.doc_type || "doc").replaceAll("_", " ")}
                        </span>
                        <span className="text-slate-600 font-medium">{k.title || "Untitled"}</span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <ZoomIn className="w-3 h-3" /> Similarity {((Number(k.similarity) || 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="text-sm text-slate-800 leading-relaxed">{k.chunk_text}</div>
                  </div>
                ))}
              </div>
            )}
          </Row>

          <Row openKey="tools" title={`Tool calls (${result.tool_calls?.length || 0})`}
            icon={Wrench} accent="amber" defaultOpen open={open} toggle={toggle}>
            {!result.tool_calls?.length ? (
              <p className="text-sm text-slate-500">No tools were called for this query.</p>
            ) : (
              <div className="space-y-3">
                {result.tool_calls.map((t: any, i: number) => {
                  const ok = t.status === "completed" && t.validated;
                  return (
                    <div key={i} className="rounded-lg border border-slate-200 overflow-hidden">
                      <div className="flex items-center justify-between bg-slate-50 border-b border-slate-200 px-4 py-2.5">
                        <div className="flex items-center gap-2 text-sm font-mono">
                          {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : t.status === "denied" ? <XCircle className="w-4 h-4 text-red-600" /> : <Loader2 className="w-4 h-4 text-amber-600" />}
                          <span className="font-semibold text-slate-800">{t.tool_name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className={cn("px-2 py-0.5 rounded-full font-medium",
                            t.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                            t.status === "denied" ? "bg-red-100 text-red-700" :
                            "bg-amber-100 text-amber-700"
                          )}>{t.status}</span>
                        </div>
                      </div>
                      <div className="p-4 grid md:grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs font-medium text-slate-500 mb-1">Arguments</div>
                          <pre className="text-xs bg-white border border-slate-200 rounded-md p-2 overflow-x-auto scrollbar-thin max-h-40">
                            {JSON.stringify(t.arguments_json || {}, null, 2)}
                          </pre>
                          {t.validation_error && (
                            <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
                              Validation: {t.validation_error}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-medium text-slate-500 mb-1">Result</div>
                          <pre className="text-xs bg-white border border-slate-200 rounded-md p-2 overflow-x-auto scrollbar-thin max-h-56">
                            {t.error_message ? `ERROR: ${t.error_message}` : JSON.stringify(t.result_json || {}, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Row>

          <Row openKey="meta" title="Run metadata" icon={Activity} accent="slate" open={open} toggle={toggle}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Meta label="Run ID" value={result.ai_run_id} />
              <Meta label="Started" value={formatDate(result.started_at)} />
              <Meta label="Completed" value={formatDate(result.completed_at)} />
              <Meta label="Status" value={result.status} />
            </div>
            {result.raw_llm_response && (
              <details className="mt-3">
                <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">Show raw LLM response (debug)</summary>
                <pre className="mt-2 text-xs bg-slate-50 border border-slate-200 p-3 rounded-lg overflow-x-auto scrollbar-thin max-h-72">
                  {result.raw_llm_response}
                </pre>
              </details>
            )}
          </Row>
        </div>
      )}
    </div>
  );
}

function Row({ openKey, title, icon: Icon, accent = "slate", children, right, open, toggle, defaultOpen }: any) {
  const isOpen = open[openKey] ?? defaultOpen ?? false;
  const colors: Record<string, string> = {
    brand: "bg-brand-50 text-brand-700 border-brand-100",
    violet: "bg-violet-50 text-violet-700 border-violet-100",
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
  };
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <button onClick={() => toggle(openKey)} className="w-full px-5 py-4 flex items-center gap-3 hover:bg-slate-50/50 text-left">
        {Icon ? (
          <div className={cn("h-9 w-9 rounded-lg border flex items-center justify-center shrink-0", colors[accent] || colors.slate)}>
            <Icon className="w-4.5 h-4.5" />
          </div>
        ) : null}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-900">{title}</div>
        </div>
        <div className="flex items-center gap-3">{right}</div>
        {isOpen ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
      </button>
      {isOpen && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

function Badge({ v }: { v?: string }) {
  if (!v) return <span className="text-slate-500">—</span>;
  const str = String(v);
  const ok = ["paid", "fulfilled", "active", "success", "completed", "delivered"].some((x) => str.toLowerCase().includes(x));
  const bad = ["refunded", "cancelled", "voided", "failed"].some((x) => str.toLowerCase().includes(x));
  const cls = ok ? "bg-emerald-100 text-emerald-700" : bad ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700";
  return <span className={cn("inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize", cls)}>{str.replaceAll("_", " ")}</span>;
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">{label}</div>
      <div className="text-sm font-semibold text-slate-800">{value !== undefined && value !== null ? String(value) : "—"}</div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">{label}</div>
      <div className="text-sm text-slate-800 font-medium break-all">{value !== undefined && value !== null ? String(value) : "—"}</div>
    </div>
  );
}
