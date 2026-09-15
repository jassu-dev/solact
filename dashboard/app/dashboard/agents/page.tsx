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
  Globe,
  Mail,
  Calendar,
  Save,
  Loader2,
  Inbox,
  Split,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function HumanAgentsPage() {
  const [loading, setLoading] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [chatwootUrl, setChatwootUrl] = useState("https://chat.solact.in");
  const [agents, setAgents] = useState<any[]>([]);
  const [escalations, setEscalations] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>({
    deflection_rate: "0.0%",
    escalated_rate: "0.0%",
    total_conversations: 0,
    escalated_conversations: 0,
    avg_latency: "—",
    active_inboxes: "Shopify Web + Email",
  });

  // Schedule state
  const [schedule, setSchedule] = useState({
    enabled: true,
    start: "09:00",
    end: "18:00",
    timezone: "UTC",
    days: [1, 2, 3, 4, 5],
    offline_message: "Our human support team is currently offline. Operating hours: Monday – Friday, 9:00 AM – 6:00 PM. We have logged your ticket and an agent will reply as soon as we reopen!",
  });

  const loadData = async () => {
    try {
      const res = await api.get("/integrations/chatwoot/agents-overview");
      if (res?.data) {
        if (res.data.chatwoot_url) setChatwootUrl(res.data.chatwoot_url);
        if (res.data.agents) setAgents(res.data.agents);
        if (res.data.escalations) setEscalations(res.data.escalations);
        if (res.data.metrics) setMetrics(res.data.metrics);
        if (res.data.schedule) setSchedule((prev) => ({ ...prev, ...res.data.schedule }));
      }
    } catch (err) {
      console.error("Failed to load agents overview:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    try {
      await api.put("/integrations/chatwoot/support-schedule", {
        support_hours_enabled: schedule.enabled,
        support_hours_start: schedule.start,
        support_hours_end: schedule.end,
        support_timezone: schedule.timezone,
        support_days: schedule.days,
        offline_escalation_message: schedule.offline_message,
      });
      toast.success("Support schedule updated successfully!");
    } catch {
      toast.error("Failed to update support schedule");
    } finally {
      setSavingSchedule(false);
    }
  };

  const statCards = [
    {
      label: "AI Deflection Rate",
      value: metrics.deflection_rate,
      sub: metrics.total_conversations > 0
        ? `${metrics.total_conversations - metrics.escalated_conversations} resolved autonomously by Solact AI`
        : "No conversations recorded yet",
      color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    },
    {
      label: "Escalated to Human",
      value: metrics.escalated_rate,
      sub: metrics.total_conversations > 0
        ? `${metrics.escalated_conversations} transferred to Chatwoot`
        : "0 escalations required",
      color: "text-blue-600 bg-blue-50 border-blue-200",
    },
    {
      label: "Avg. AI Latency",
      value: metrics.avg_latency || "—",
      sub: metrics.total_conversations > 0 ? "Sub-second customer response" : "Ready for incoming chats",
      color: "text-purple-600 bg-purple-50 border-purple-200",
    },
    {
      label: "Active Inboxes",
      value: "Shopify Web + Email",
      sub: "Connected to Chatwoot",
      color: "text-amber-600 bg-amber-50 border-amber-200",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-xs font-semibold mb-2">
            <Bot className="w-3.5 h-3.5" /> Human-in-the-Loop Orchestration
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Human Agents & Routing Distribution</h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage your Chatwoot agent distribution, operating schedule, and live escalation routing.
          </p>
        </div>

        <a
          href={chatwootUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs transition shadow-xs"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Open Chatwoot Agent Inbox</span>
          <ExternalLink className="w-3.5 h-3.5 ml-0.5 opacity-80" />
        </a>
      </header>

      {/* Live Real Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-slate-200 bg-white p-4.5 shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {s.label}
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">{s.value}</div>
              <div className="text-[11px] text-slate-500 mt-1">{s.sub}</div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Live Status:</span>
              <span className="font-semibold text-emerald-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Human Agents & Distribution Strategy Card */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4.5 h-4.5 text-brand-600" /> Chatwoot Human Agents
              </h2>
              {agents.length <= 1 ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  <UserCheck className="w-3 h-3" /> Single Dedicated Agent
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                  <Split className="w-3 h-3" /> Round-Robin Split ({agents.length} Agents)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {agents.length <= 1
                ? "All escalated tickets are automatically assigned directly to your dedicated support specialist."
                : `Incoming escalations are evenly load-balanced across your ${agents.length} active Chatwoot agents.`}
            </p>
          </div>

          <a
            href={`${chatwootUrl}/app/accounts/1/settings/agents`}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 inline-flex items-center gap-1"
          >
            Manage in Chatwoot <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Real Live Agents List */}
        <div className="grid md:grid-cols-3 gap-4">
          {agents.length > 0 ? (
            agents.map((ag) => (
              <div
                key={ag.id || ag.email}
                className="rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition bg-slate-50/50 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-xs">
                        {(ag.name || ag.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 leading-tight">
                          {ag.name || ag.email}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[140px]">
                          {ag.email}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                      {ag.role || "agent"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        ag.status === "online" ? "bg-emerald-500" : "bg-slate-400"
                      )}
                    />
                    <span className="capitalize">{ag.status || "online"}</span>
                  </span>
                  <span className="font-mono text-slate-600">{ag.channel}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-3 text-center py-6 text-xs text-slate-400">
              No human agents detected. Check your Chatwoot integration.
            </div>
          )}
        </div>
      </section>

      {/* Support Working Hours & Schedule Manager */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Clock className="w-4.5 h-4.5 text-brand-600" /> Support Team Working Hours & Availability
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Specify when your human team is available. Outside these hours, Solact notifies customers and queues requests for the next shift.
            </p>
          </div>
          <button
            onClick={handleSaveSchedule}
            disabled={savingSchedule}
            className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
          >
            {savingSchedule ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Schedule
          </button>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <div className="md:col-span-1">
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Enforce Working Hours
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="sched_enabled"
                checked={schedule.enabled}
                onChange={(e) => setSchedule({ ...schedule, enabled: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <label htmlFor="sched_enabled" className="text-xs text-slate-700 cursor-pointer font-medium">
                {schedule.enabled ? "Active Schedule" : "24/7 Unrestricted"}
              </label>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Start Time (24h)
            </label>
            <input
              type="time"
              value={schedule.start}
              onChange={(e) => setSchedule({ ...schedule, start: e.target.value })}
              className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              End Time (24h)
            </label>
            <input
              type="time"
              value={schedule.end}
              onChange={(e) => setSchedule({ ...schedule, end: e.target.value })}
              className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Timezone
            </label>
            <select
              value={schedule.timezone}
              onChange={(e) => setSchedule({ ...schedule, timezone: e.target.value })}
              className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">America / New York (EST)</option>
              <option value="America/Los_Angeles">America / Los Angeles (PST)</option>
              <option value="America/Chicago">America / Chicago (CST)</option>
              <option value="Europe/London">Europe / London (GMT)</option>
              <option value="Europe/Paris">Europe / Paris (CET)</option>
              <option value="Asia/Kolkata">Asia / Kolkata (IST)</option>
              <option value="Asia/Singapore">Asia / Singapore (SGT)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1.5">
            Active Support Days
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { id: 1, label: "Mon" },
              { id: 2, label: "Tue" },
              { id: 3, label: "Wed" },
              { id: 4, label: "Thu" },
              { id: 5, label: "Fri" },
              { id: 6, label: "Sat" },
              { id: 7, label: "Sun" },
            ].map((d) => {
              const active = schedule.days.includes(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    const newDays = active
                      ? schedule.days.filter((x) => x !== d.id)
                      : [...schedule.days, d.id];
                    setSchedule({ ...schedule, days: newDays });
                  }}
                  className={cn(
                    "w-10 h-8 text-xs font-bold rounded-lg border transition",
                    active
                      ? "bg-brand-600 text-white border-brand-600 shadow-xs"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  )}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Offline Escalation Message (Displayed when customer requests human outside hours)
          </label>
          <input
            type="text"
            value={schedule.offline_message}
            onChange={(e) => setSchedule({ ...schedule, offline_message: e.target.value })}
            className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </section>

      {/* Real AI-to-Human Escalations Table */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <Inbox className="w-4.5 h-4.5 text-brand-600" /> Recent AI-to-Human Escalations
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real conversations where Solact safely handed over support to your team.
          </p>
        </div>

        {escalations.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="px-3 py-2.5">Ticket</th>
                  <th className="px-3 py-2.5">Customer & Order</th>
                  <th className="px-3 py-2.5">Trigger Reason</th>
                  <th className="px-3 py-2.5">Assigned To</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {escalations.map((esc) => (
                  <tr key={esc.id} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2.5 font-bold text-slate-900">{esc.id}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-900">{esc.customer}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{esc.order}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 max-w-xs">{esc.reason}</td>
                    <td className="px-3 py-2.5 text-slate-800 font-medium">{esc.assigned_agent}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full font-medium text-[10px]",
                          esc.status.includes("Awaiting")
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        )}
                      >
                        {esc.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{esc.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center bg-slate-50/50">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <div className="text-xs font-semibold text-slate-800">No Active Escalations</div>
            <div className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto">
              All incoming inquiries have been resolved autonomously by Solact AI with 0 human handoffs.
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
