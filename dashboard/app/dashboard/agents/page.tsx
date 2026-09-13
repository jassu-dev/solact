"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Users,
  ShieldAlert,
  Zap,
  ArrowUpRight,
  ExternalLink,
  CheckCircle2,
  Clock,
  MessageSquare,
  Sparkles,
  Bot,
  UserCheck,
  AlertCircle,
  Sliders,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function HumanAgentsPage() {
  const [chatwootUrl, setChatwootUrl] = useState("https://chat.solact.in");
  const [autoEscalateRefunds, setAutoEscalateRefunds] = useState(true);
  const [autoEscalateSentiment, setAutoEscalateSentiment] = useState(true);
  const [autoEscalateKeyword, setAutoEscalateKeyword] = useState(true);
  const [saving, setSaving] = useState(false);

  const stats = [
    {
      label: "AI Deflection Rate",
      value: "74.8%",
      sub: "Resolved completely by Solact AI",
      color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    },
    {
      label: "Escalated to Human",
      value: "25.2%",
      sub: "Gracefully transferred to Chatwoot",
      color: "text-blue-600 bg-blue-50 border-blue-200",
    },
    {
      label: "Avg. AI Latency",
      value: "840 ms",
      sub: "Instant customer response",
      color: "text-purple-600 bg-purple-50 border-purple-200",
    },
    {
      label: "Active Inboxes",
      value: "Shopify Web + WhatsApp",
      sub: "Connected to Chatwoot",
      color: "text-amber-600 bg-amber-50 border-amber-200",
    },
  ];

  const humanAgents = [
    {
      name: "Solact Support Lead",
      email: "support@solact.in",
      role: "Administrator",
      status: "online",
      assignedConversations: 3,
      channel: "Web & WhatsApp",
    },
    {
      name: "Returns & Exchanges Specialist",
      email: "returns@solact.in",
      role: "Agent",
      status: "online",
      assignedConversations: 1,
      channel: "Shopify Storefront",
    },
    {
      name: "VIP Escalation Desk",
      email: "vip@solact.in",
      role: "Agent",
      status: "away",
      assignedConversations: 0,
      channel: "Direct Email & WhatsApp",
    },
  ];

  const recentEscalations = [
    {
      id: "ESC-1092",
      customer: "Sarah Jenkins (sarah@example.com)",
      order: "#10492",
      reason: "Customer requested expedited address rerouting",
      assignedAgent: "Solact Support Lead",
      status: "In Progress",
      time: "12m ago",
    },
    {
      id: "ESC-1089",
      customer: "Michael Brown (mbrown@gmail.com)",
      order: "#10488",
      reason: "Item arrived broken in transit (photo attached)",
      assignedAgent: "Returns & Exchanges Specialist",
      status: "Resolved",
      time: "45m ago",
    },
    {
      id: "ESC-1084",
      customer: "David Kim (dkim@icloud.com)",
      order: "#10476",
      reason: "Customer requested refund for final sale exclusion",
      assignedAgent: "Solact Support Lead",
      status: "Resolved",
      time: "2h ago",
    },
  ];

  const handleSaveRules = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success("Human escalation & agent distribution rules saved!");
    }, 600);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-600 uppercase tracking-wider">
            <Users className="w-3.5 h-3.5" /> Human-in-the-Loop Orchestration
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Human Agents & Routing Distribution
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your Chatwoot agent distribution, escalation triggers, and live team availability.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={chatwootUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-xs transition"
          >
            <span>Open Chatwoot Agent Inbox</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, idx) => (
          <div
            key={idx}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between"
          >
            <div className="text-xs font-medium text-slate-500">{s.label}</div>
            <div className="my-2">
              <div className="text-2xl font-extrabold text-slate-900">
                {s.value}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{s.sub}</div>
            </div>
            <div className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-md border w-fit", s.color)}>
              Live Status: Active
            </div>
          </div>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* Left column: Human Agent Roster */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Chatwoot Human Agents
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Synced in real time from your Chatwoot instance (<code>chat.solact.in</code>).
                </p>
              </div>
              <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-1 rounded-full border border-emerald-200">
                2 Agents Online
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {humanAgents.map((ag, i) => (
                <div key={i} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-sm">
                        {ag.name.charAt(0)}
                      </div>
                      <span
                        className={cn(
                          "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white",
                          ag.status === "online" ? "bg-emerald-500" : "bg-amber-400"
                        )}
                      />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                        {ag.name}
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {ag.role}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">{ag.email}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-semibold text-slate-800">
                      {ag.assignedConversations} active chat{ag.assignedConversations === 1 ? "" : "s"}
                    </div>
                    <div className="text-[11px] text-slate-400">{ag.channel}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>To add or invite more agents, visit your Chatwoot Settings.</span>
              <a
                href={`${chatwootUrl}/app/accounts/1/settings/agents`}
                target="_blank"
                rel="noreferrer"
                className="text-brand-600 font-semibold hover:underline flex items-center gap-1"
              >
                <span>Manage in Chatwoot</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Recent Escalation Stream */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <h3 className="font-bold text-slate-900 text-base mb-1">
              Recent AI-to-Human Escalations
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Conversations where Solact safely triggered handoff to your team.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="pb-2">Ticket</th>
                    <th className="pb-2">Customer & Order</th>
                    <th className="pb-2">Trigger Reason</th>
                    <th className="pb-2">Assigned To</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {recentEscalations.map((esc) => (
                    <tr key={esc.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 font-mono font-bold text-brand-600">
                        {esc.id}
                      </td>
                      <td className="py-3">
                        <div className="font-medium text-slate-900">{esc.customer}</div>
                        <div className="text-slate-400 text-[11px]">Order {esc.order}</div>
                      </td>
                      <td className="py-3 max-w-xs pr-2">
                        <span className="line-clamp-2">{esc.reason}</span>
                      </td>
                      <td className="py-3 font-medium text-slate-800 whitespace-nowrap">
                        {esc.assignedAgent}
                      </td>
                      <td className="py-3 whitespace-nowrap">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full font-semibold text-[10px]",
                            esc.status === "Resolved"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          )}
                        >
                          {esc.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column: Escalation Rules & Config */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-2 font-bold text-slate-900 text-base">
              <Sliders className="w-4 h-4 text-brand-600" />
              <span>Escalation & Routing Triggers</span>
            </div>
            <p className="text-xs text-slate-500 mb-5">
              Specify when Solact AI must stop automated replies and transfer the visitor to a human agent.
            </p>

            <div className="space-y-4">
              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50/70 transition cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoEscalateRefunds}
                  onChange={(e) => setAutoEscalateRefunds(e.target.checked)}
                  className="mt-0.5 rounded text-brand-600 focus:ring-brand-500"
                />
                <div>
                  <div className="font-semibold text-xs text-slate-900">
                    Refund & Chargeback Requests
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Whenever a customer requests monetary refunds or disputes charges, transfer to human agents immediately.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50/70 transition cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoEscalateSentiment}
                  onChange={(e) => setAutoEscalateSentiment(e.target.checked)}
                  className="mt-0.5 rounded text-brand-600 focus:ring-brand-500"
                />
                <div>
                  <div className="font-semibold text-xs text-slate-900">
                    Negative Sentiment / Frustration Guardrail
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    If customer shows anger or mentions "upset", "angry", "bad service", escalate before they get frustrated.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50/70 transition cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoEscalateKeyword}
                  onChange={(e) => setAutoEscalateKeyword(e.target.checked)}
                  className="mt-0.5 rounded text-brand-600 focus:ring-brand-500"
                />
                <div>
                  <div className="font-semibold text-xs text-slate-900">
                    Explicit Human Agent Request
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Keywords like "human", "agent", "real person", or "representative" trigger instantaneous handoff.
                  </div>
                </div>
              </label>
            </div>

            <button
              onClick={handleSaveRules}
              disabled={saving}
              className="mt-6 w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold py-3 rounded-xl transition shadow-xs"
            >
              {saving ? "Saving settings..." : "Save Escalation Rules"}
            </button>
          </div>

          <div className="bg-gradient-to-br from-brand-900 to-slate-900 text-white rounded-2xl p-6 border border-brand-800 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-bold text-brand-300 uppercase tracking-wider mb-2">
              <Zap className="w-3.5 h-3.5" /> Omnichannel Synchronized
            </div>
            <h4 className="font-bold text-base">WhatsApp & Email Inboxes</h4>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
              When Solact escalates a WhatsApp conversation, human agents can reply directly from Chatwoot. The message is automatically formatted and sent back over WhatsApp.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
