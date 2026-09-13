"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { MessageSquare, User, Bot, Users, AlertTriangle, Send, ArrowLeft, X } from "lucide-react";
import { cn, formatRelative } from "@/lib/utils";

export default function ConversationsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading conversations...</div>}>
      <ConversationsPageContent />
    </Suspense>
  );
}

function ConversationsPageContent() {
  const sp = useSearchParams();
  const activeId = sp.get("id");
  const [conversations, setConversations] = useState<any[]>([]);
  const [active, setActive] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const reloadList = async () => {
    try {
      const r = await api.get("/conversations");
      setConversations(r.data.conversations || []);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: string | number) => {
    try {
      const r = await api.get(`/conversations/${id}`);
      setActive(r.data);
      setMessages(r.data.messages || []);
    } catch {
      setActive(null); setMessages([]);
    }
  };

  useEffect(() => {
    reloadList();
  }, []);

  useEffect(() => {
    if (activeId) loadDetail(activeId);
    else { setActive(null); setMessages([]); }
  }, [activeId]);

  const escalate = async () => {
    if (!active) return;
    const reason = prompt("Why are you escalating this conversation?") || "Manual escalation by agent";
    try {
      await api.post(`/conversations/${active.id}/escalate`, { reason });
      await reloadList();
      await loadDetail(active.id);
    } catch {}
  };

  const filtered = conversations.filter((c) => {
    if (filter === "all") return true;
    if (filter === "escalated") return c.escalated;
    if (filter === "ai") return !c.escalated;
    return c.status === filter;
  });

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Conversations</h1>
          <p className="text-sm text-slate-600 mt-1">
            All customer conversations handled by Solact or escalated to humans.
          </p>
        </div>
      </header>

      <div className="grid lg:grid-cols-[360px,1fr] gap-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col">
          <div className="p-3 border-b border-slate-200 flex gap-2 overflow-x-auto">
            {[
              { v: "all", label: "All" },
              { v: "ai", label: "AI-handled" },
              { v: "escalated", label: "Escalated" },
              { v: "open", label: "Open" },
              { v: "awaiting_human", label: "Awaiting human" },
              { v: "closed", label: "Closed" },
            ].map((b) => (
              <button key={b.v} onClick={() => setFilter(b.v)}
                className={cn("px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border",
                  filter === b.v ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                )}>
                {b.label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto max-h-[calc(100vh-240px)] scrollbar-thin">
            {loading ? (
              <div className="p-8 text-center text-sm text-slate-500">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No conversations match this filter.</p>
                <p className="text-xs text-slate-400 mt-1">Connect Chatwoot or send a test message in the Test Lab.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filtered.map((c) => {
                  const isActive = String(active?.id) === String(c.id);
                  return (
                    <a key={c.id} href={`/dashboard/conversations?id=${c.id}`}
                      className={cn("block px-4 py-3 hover:bg-slate-50 transition", isActive && "bg-brand-50/60")}>
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-semibold text-sm shrink-0">
                          {(c.customer_name || c.customer_email || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium text-slate-900 text-sm truncate">
                              {c.customer_name || c.customer_email || c.customer_phone || "Anonymous"}
                            </div>
                            <div className="text-xs text-slate-500 shrink-0">
                              {formatRelative(c.last_message_at || c.created_at)}
                            </div>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-slate-500 truncate">
                              {c.customer_email || c.customer_phone || "No contact"}
                            </span>
                            {c.escalated && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                                <AlertTriangle className="w-3 h-3" /> Escalated
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <Badge status={c.status} />
                            <span className="text-[11px] text-slate-500">
                              AI {c.ai_reply_count || 0} · Human {c.human_reply_count || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col min-h-[calc(100vh-240px)]">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="font-medium text-slate-900">No conversation selected</h3>
                <p className="text-sm text-slate-500 mt-1">Choose one from the left to view the message thread.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-semibold">
                    {(active.customer_name || active.customer_email || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">
                      {active.customer_name || "Anonymous customer"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {active.customer_email || active.customer_phone || "No contact info"}
                      {active.chatwoot_conversation_id && ` · Chatwoot #${active.chatwoot_conversation_id}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge status={active.status} />
                  {active.escalated ? (
                    <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-red-100 text-red-700 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" /> Escalated
                    </span>
                  ) : (
                    <button onClick={escalate}
                      className="h-8 px-3 rounded-md border border-red-200 bg-white hover:bg-red-50 text-red-700 text-xs font-medium flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Escalate to human
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">
                {messages.length === 0 && (
                  <div className="text-center text-sm text-slate-500 py-10">No messages yet.</div>
                )}
                {messages.map((m) => (
                  <MessageBubble key={m.id} m={m} />
                ))}
              </div>
              <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/50 flex items-center gap-2">
                <input disabled
                  placeholder="Agent reply box — reply in Chatwoot for real customers"
                  className="flex-1 h-9 rounded-md border border-slate-200 bg-white px-3 text-sm disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                <button disabled
                  className="h-9 w-9 rounded-md bg-brand-600 disabled:opacity-50 text-white flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Badge({ status }: { status?: string }) {
  const map: Record<string, string> = {
    open: "bg-slate-100 text-slate-700",
    ai_handling: "bg-brand-50 text-brand-700",
    awaiting_human: "bg-amber-100 text-amber-700",
    human_handling: "bg-violet-100 text-violet-700",
    resolved: "bg-emerald-100 text-emerald-700",
    closed: "bg-slate-200 text-slate-700",
  };
  const cls = map[status || "open"] || map.open;
  return <span className={cn("inline-block text-[11px] px-2 py-0.5 rounded-full font-medium capitalize", cls)}>
    {(status || "open").replaceAll("_", " ")}
  </span>;
}

function MessageBubble({ m }: { m: any }) {
  const role = m.role || "customer";
  const isCust = role === "customer";
  const isAI = role === "ai";
  const isHuman = role === "human";
  const Icon = isAI ? Bot : isHuman ? Users : User;
  const cls = isCust
    ? "bg-slate-100 text-slate-900"
    : isAI
    ? "bg-gradient-to-br from-brand-500 to-brand-700 text-white"
    : "bg-slate-900 text-white";
  const align = isCust ? "justify-start" : "justify-end";
  return (
    <div className={cn("flex gap-2", align)}>
      {isCust && <div className="h-8 w-8 shrink-0 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center"><User className="w-4 h-4" /></div>}
      <div className="max-w-[75%]">
        <div className={cn("px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap", cls)}>
          {m.content}
        </div>
        <div className={cn("mt-1 text-[11px] text-slate-500 flex items-center gap-2", align)}>
          <span className="inline-flex items-center gap-1 font-medium">
            <Icon className="w-3 h-3" />
            {isAI ? "AI" : isHuman ? "Human agent" : "Customer"}
          </span>
          <span>·</span>
          <span>{formatRelative(m.created_at)}</span>
          {m.ai_run_id && <span>· <a className="underline hover:text-brand-600" href={`/dashboard/test-lab?run_id=${m.ai_run_id}`}>View AI trace</a></span>}
        </div>
      </div>
    </div>
  );
}
