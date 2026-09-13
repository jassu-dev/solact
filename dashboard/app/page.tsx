"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/api";
import Link from "next/link";
import {
  Sparkles,
  ShieldCheck,
  Zap,
  ArrowRight,
  CheckCircle2,
  Package,
  MessageSquare,
  Mail,
  Smartphone,
  Users,
  ChevronRight,
  TrendingUp,
  Cpu,
  Check,
  Send,
  RefreshCw,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";

interface DemoMessage {
  sender: "customer" | "ai";
  text: string;
  tool?: {
    name: string;
    status: string;
    details?: string;
  };
  timestamp: string;
}

const DEMO_SCENARIOS = [
  {
    id: "order_tracking",
    title: "Track Order #10492",
    tag: "Shopify API",
    prompt: "Where is my order #10492? I placed it 3 days ago.",
    response:
      "Hello Sarah! Your order #10492 (2x Solact Merino Wool Tees) was fulfilled and is on its way via USPS Priority Mail (Tracking #9400111899564291823901). It is currently out for delivery and expected on your doorstep today by 4:30 PM.",
    tool: {
      name: "shopify_get_order_status",
      status: "Fulfilled · In Transit",
      details: "USPS #9400111899564291823901",
    },
  },
  {
    id: "return_policy",
    title: "Return Policy Query",
    tag: "Vector RAG",
    prompt: "Can I return a discounted sweater I purchased last week?",
    response:
      "According to our 30-day Return Policy, unworn items in original packaging can be returned for store credit or refund. However, items marked 'Final Sale' (discounted 40% or more) cannot be returned. Would you like me to generate a prepaid return label for your sweater?",
    tool: {
      name: "policy_rag_search",
      status: "pgvector similarity: 0.94",
      details: "Matched 'Returns & Exchanges 2026.pdf' (Section 3.2)",
    },
  },
  {
    id: "damaged_item",
    title: "Damaged Item & Handoff",
    tag: "Chatwoot Escalation",
    prompt: "My package arrived damaged and the glass bottle is completely broken!",
    response:
      "I am so sorry to hear that! I've immediately opened an expedited replacement ticket (#REP-842) and escalated this conversation directly to our Senior Support Team in Chatwoot with priority status. A human agent is reviewing this right now and will message you back shortly.",
    tool: {
      name: "chatwoot_human_escalate",
      status: "Escalated to Human Agent",
      details: "Priority: HIGH · Inbox: Customer Support",
    },
  },
  {
    id: "whatsapp_notify",
    title: "WhatsApp & Email Sync",
    tag: "Omnichannel",
    prompt: "Can you send the delivery tracking updates to my WhatsApp number?",
    response:
      "Done! I've linked +1 (555) 382-9912 to order #10492. You will receive automated real-time delivery notifications and out-for-delivery alerts via WhatsApp and email.",
    tool: {
      name: "omnichannel_whatsapp_notify",
      status: "Subscribed · WhatsApp & Email",
      details: "Template: shipping_update_v1",
    },
  },
];

export default function HomePage() {
  const router = useRouter();
  const [isAppSubdomain, setIsAppSubdomain] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      // If user visits app.solact.in, they MUST NOT see the landing page!
      if (host.startsWith("app.") || host.includes("app.solact")) {
        setIsAppSubdomain(true);
        const user = getUser();
        if (user) {
          router.replace("/dashboard");
        } else {
          router.replace("/login");
        }
      }
    }
  }, [router]);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [activeScenario, setActiveScenario] = useState(0);
  const [customInput, setCustomInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [demoChat, setDemoChat] = useState<DemoMessage[]>([
    {
      sender: "customer",
      text: DEMO_SCENARIOS[0].prompt,
      timestamp: "Just now",
    },
    {
      sender: "ai",
      text: DEMO_SCENARIOS[0].response,
      tool: DEMO_SCENARIOS[0].tool,
      timestamp: "Just now",
    },
  ]);

  // Waitlist form state
  const [waitlistForm, setWaitlistForm] = useState({
    name: "",
    email: "",
    storeUrl: "",
    monthlyOrders: "500-2500",
    channels: ["web", "whatsapp"],
    notes: "",
  });
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);
  const [submittingWaitlist, setSubmittingWaitlist] = useState(false);

  const handleScenarioClick = (index: number) => {
    setActiveScenario(index);
    const scenario = DEMO_SCENARIOS[index];
    setIsTyping(true);
    setDemoChat([
      {
        sender: "customer",
        text: scenario.prompt,
        timestamp: "Just now",
      },
    ]);

    setTimeout(() => {
      setDemoChat((prev) => [
        ...prev,
        {
          sender: "ai",
          text: scenario.response,
          tool: scenario.tool,
          timestamp: "Just now",
        },
      ]);
      setIsTyping(false);
    }, 700);
  };

  const handleCustomSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;

    const userText = customInput.trim();
    setCustomInput("");
    setIsTyping(true);

    setDemoChat((prev) => [
      ...prev,
      {
        sender: "customer",
        text: userText,
        timestamp: "Just now",
      },
    ]);

    setTimeout(() => {
      let reply = "";
      let toolInfo: any = undefined;

      const lower = userText.toLowerCase();
      if (lower.includes("order") || lower.includes("track") || lower.includes("#")) {
        reply =
          "I looked up your Shopify orders. Order #10492 is currently in transit with USPS, estimated to arrive today. Would you like the live tracking link or delivery alerts?";
        toolInfo = {
          name: "shopify_order_lookup",
          status: "Order Found · In Transit",
          details: "Carrier: USPS · ETA: Today",
        };
      } else if (lower.includes("return") || lower.includes("refund") || lower.includes("exchange")) {
        reply =
          "Our store offers 30-day hassle-free returns on all standard items. I've pulled up your eligibility—would you like me to email you a pre-paid return shipping label?";
        toolInfo = {
          name: "policy_rag_search",
          status: "Found in Returns Policy (pgvector)",
          details: "Window: 30 days · Free returns",
        };
      } else if (lower.includes("human") || lower.includes("agent") || lower.includes("person") || lower.includes("talk")) {
        reply =
          "I'm connecting you with one of our human support specialists right away. Your conversation and order history have been transferred to our Chatwoot support desk.";
        toolInfo = {
          name: "chatwoot_escalate",
          status: "Transferred to Human Team",
          details: "Agent status: Online",
        };
      } else {
        reply =
          "Thank you for contacting us! I'm Solact, your AI support employee. I can help you check orders, process returns, answer product questions, and notify you on WhatsApp or Email.";
        toolInfo = {
          name: "solact_ai_assistant",
          status: "Grounded in Store Data",
          details: "Shopify Store Connected",
        };
      }

      setDemoChat((prev) => [
        ...prev,
        {
          sender: "ai",
          text: reply,
          tool: toolInfo,
          timestamp: "Just now",
        },
      ]);
      setIsTyping(false);
    }, 900);
  };

  const handleWaitlistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistForm.email || !waitlistForm.storeUrl) {
      toast.error("Please provide your email and Shopify store URL");
      return;
    }

    setSubmittingWaitlist(true);
    setTimeout(() => {
      setSubmittingWaitlist(false);
      setWaitlistSubmitted(true);
      toast.success("You're on the list! We'll reach out to schedule your setup.");
    }, 800);
  };

  if (isAppSubdomain) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl overflow-hidden shadow-xs bg-white p-1 flex items-center justify-center">
            <img src="/icon.svg" alt="Solact" className="w-full h-full object-contain" />
          </div>
          <div className="text-sm font-medium text-slate-600">Redirecting to Solact portal...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-brand-500 selection:text-white font-sans">
      {/* 1. TOP ANNOUNCEMENT BANNER */}
      <div className="bg-slate-950 text-slate-200 text-xs py-2.5 px-4 text-center border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 flex-wrap">
          <span className="bg-brand-600 text-white font-semibold px-2 py-0.5 rounded text-[11px] uppercase tracking-wider">
            Solact V1 Live
          </span>
          <span>
            Now accepting Shopify merchants for white-glove manual onboarding with WhatsApp & Email notifications.
          </span>
          <a
            href="#waitlist"
            className="text-brand-400 hover:text-brand-300 font-semibold underline underline-offset-2 ml-1"
          >
            Claim 1-on-1 Setup →
          </a>
        </div>
      </div>

      {/* 2. NAVIGATION BAR */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/85 border-b border-slate-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-xl overflow-hidden shadow-sm border border-slate-100 flex items-center justify-center bg-white">
              <img
                src="/icon.svg"
                alt="Solact Logo"
                className="w-full h-full object-contain p-0.5"
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xl tracking-tight text-slate-950">
                  Solact
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200/60">
                  V1
                </span>
              </div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#demo" className="hover:text-slate-950 transition">
              Live Demo
            </a>
            <a href="#features" className="hover:text-slate-950 transition">
              Features
            </a>
            <a href="#how" className="hover:text-slate-950 transition">
              How It Works
            </a>
            <a href="#pricing" className="hover:text-slate-950 transition">
              Pricing
            </a>
            <a href="#onboarding" className="hover:text-slate-950 transition">
              Manual Onboarding
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-semibold text-slate-700 hover:text-slate-950 px-3.5 py-2 rounded-lg hover:bg-slate-100 transition"
            >
              Sign In
            </Link>
            <a
              href="#waitlist"
              className="inline-flex items-center gap-1.5 text-sm font-semibold bg-slate-950 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg shadow-sm hover:shadow transition"
            >
              <span>Book Setup</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </header>

      {/* 3. HERO SECTION */}
      <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-28 bg-gradient-to-b from-slate-50/80 via-white to-white">
        <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-200/80 text-brand-700 text-xs font-semibold px-3.5 py-1.5 rounded-full shadow-xs mb-8">
            <Sparkles className="w-3.5 h-3.5 text-brand-600" />
            <span>Built Exclusively for Shopify Stores</span>
            <span className="w-1 h-1 rounded-full bg-brand-400" />
            <span className="text-slate-500 font-medium">WhatsApp · Email · Chatwoot</span>
          </div>

          {/* Headline requested by user */}
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-950 leading-[1.08]">
            Your AI Support Employee for{" "}
            <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-brand-600 bg-clip-text text-transparent">
              Shopify
            </span>
          </h1>

          {/* Subtitle requested by user */}
          <p className="mt-8 text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto font-normal leading-relaxed">
            Automatically answer customer questions, track orders, handle support requests and notify customers through email and WhatsApp.
          </p>

          {/* Action CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#waitlist"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-base px-7 py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all"
            >
              <span>Book White-Glove Onboarding</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="#demo"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-base px-6 py-3.5 rounded-xl border border-slate-300 shadow-xs transition"
            >
              <span>Try Interactive Demo</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </a>
          </div>

          {/* Social Proof / Key Highlights */}
          <div className="mt-14 pt-10 border-t border-slate-200/70 grid grid-cols-2 md:grid-cols-4 gap-6 text-left max-w-4xl mx-auto">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">Real-Time Sync</div>
                <div className="text-xs text-slate-500 mt-0.5">Direct Shopify orders, tracking & products</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">Zero Hallucinations</div>
                <div className="text-xs text-slate-500 mt-0.5">Grounded in your exact policies via pgvector</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">Chatwoot Handoff</div>
                <div className="text-xs text-slate-500 mt-0.5">Smart escalation to human team with context</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">WhatsApp & Email</div>
                <div className="text-xs text-slate-500 mt-0.5">Multi-channel customer alerts & replies</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. INTERACTIVE LIVE DEMO */}
      <section id="demo" className="py-20 bg-slate-900 text-white relative">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-400 bg-brand-950/80 px-3 py-1 rounded-full border border-brand-800/60 mb-3">
              <Zap className="w-3.5 h-3.5" /> Interactive Sandbox
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Test Solact Live in Action
            </h2>
            <p className="mt-3 text-slate-400 text-base">
              See how Solact reads Shopify order tracking in real time, looks up refund policies via pgvector RAG, and escalates to Chatwoot human agents.
            </p>
          </div>

          {/* Interactive Container */}
          <div className="grid lg:grid-cols-12 gap-8 items-start">
            {/* Scenario Selector */}
            <div className="lg:col-span-4 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1 mb-1">
                Choose a Customer Scenario:
              </div>
              {DEMO_SCENARIOS.map((sc, i) => (
                <button
                  key={sc.id}
                  onClick={() => handleScenarioClick(i)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    activeScenario === i
                      ? "bg-slate-800 border-brand-500 shadow-md shadow-brand-500/10"
                      : "bg-slate-850/60 border-slate-800 hover:bg-slate-800/60 text-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-white">
                      {sc.title}
                    </span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                      {sc.tag}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 line-clamp-1 italic">
                    "{sc.prompt}"
                  </p>
                </button>
              ))}

              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 text-xs text-slate-400 space-y-2 mt-4">
                <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-brand-400" />
                  Live Guardrail Engine
                </div>
                <p>
                  Solact never guesses tracking numbers or inventory. Every answer is backed by live Shopify queries or pgvector store policy documents.
                </p>
              </div>
            </div>

            {/* Chat Simulator Window */}
            <div className="lg:col-span-8 bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col h-[560px]">
              {/* Simulator Header */}
              <div className="bg-slate-900/90 border-b border-slate-800 px-5 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-white p-0.5">
                      <img src="/icon.svg" alt="Solact" className="w-full h-full object-contain" />
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-900" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white flex items-center gap-2">
                      Solact Support Employee
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Online · Shopify Connected
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Responding to storefront customer inquiries
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleScenarioClick(activeScenario)}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded transition"
                  title="Re-run scenario"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>

              {/* Chat Message Stream */}
              <div className="flex-1 p-5 overflow-y-auto space-y-4">
                {demoChat.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${
                      m.sender === "customer" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        m.sender === "customer"
                          ? "bg-brand-600 text-white rounded-br-xs"
                          : "bg-slate-850 text-slate-100 border border-slate-800 rounded-bl-xs"
                      }`}
                    >
                      {m.text}
                    </div>

                    {/* Tool Badge Indicator */}
                    {m.tool && (
                      <div className="mt-2 flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300">
                        <Cpu className="w-3.5 h-3.5 text-brand-400" />
                        <span className="font-mono text-brand-300 font-medium">
                          {m.tool.name}
                        </span>
                        <span className="text-slate-600">|</span>
                        <span className="text-emerald-400">{m.tool.status}</span>
                        {m.tool.details && (
                          <span className="text-slate-400 hidden sm:inline">
                            ({m.tool.details})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {isTyping && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 w-fit">
                    <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
                    <span>Solact AI is checking Shopify order database...</span>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <form
                onSubmit={handleCustomSend}
                className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="Type a custom customer question (e.g. 'Can I change my address?')..."
                  className="flex-1 bg-slate-950 text-sm text-white placeholder-slate-500 rounded-xl px-4 py-2.5 border border-slate-800 focus:outline-none focus:border-brand-500"
                />
                <button
                  type="submit"
                  disabled={!customInput.trim() || isTyping}
                  className="bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-1.5 transition"
                >
                  <span>Send</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* 5. CORE FEATURES GRID */}
      <section id="features" className="py-24 max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 text-brand-700 bg-brand-50 px-3 py-1 rounded-full text-xs font-semibold border border-brand-200/60 mb-3">
            <Zap className="w-3.5 h-3.5" /> Complete Support Automation
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold text-slate-950 tracking-tight">
            Engineered to Solve Tickets, Not Just Chat
          </h2>
          <p className="mt-4 text-slate-600 text-lg">
            Unlike generic chatbots that hallucinate or repeat canned scripts, Solact is deeply wired into your Shopify backend.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-5">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              Live Shopify Order Tracking
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Customers ask "Where is my order?". Solact instantly looks up fulfillment statuses, carrier tracking numbers (USPS, FedEx, DHL, Delhivery, Bluedart), and delivery ETAs without human intervention.
            </p>
            <div className="mt-5 pt-5 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-blue-600">
              <Check className="w-4 h-4" /> 70% of "WISMO" tickets deflected
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-5">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              Policy & FAQ Vector RAG
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Upload your refund policies, shipping terms, size charts, and FAQs. Using pgvector embeddings, Solact provides exact, accurate answers with zero hallucination.
            </p>
            <div className="mt-5 pt-5 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-emerald-600">
              <Check className="w-4 h-4" /> FastEmbed BGE pgvector embeddings
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-5">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              Chatwoot Human Escalation
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              When a refund requires manager approval or a customer asks for a human, Solact smoothly transfers the chat to your Chatwoot inbox with the full transcript and customer history.
            </p>
            <div className="mt-5 pt-5 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-amber-600">
              <Check className="w-4 h-4" /> 1-click human takeover in Chatwoot
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-5">
              <Smartphone className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              WhatsApp & Email Notifications
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Don't keep customers waiting on your storefront. Solact automatically dispatches delivery milestones, order confirmation summaries, and answers via WhatsApp and email.
            </p>
            <div className="mt-5 pt-5 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-purple-600">
              <Check className="w-4 h-4" /> Automated transactional alerts
            </div>
          </div>

          {/* Card 5 */}
          <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-5">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              Interactive AI Test Lab
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Test queries before they reach live customers. Inspect token costs, latency, tool calls, and pgvector knowledge chunks to guarantee total control over your AI employee.
            </p>
            <div className="mt-5 pt-5 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-rose-600">
              <Check className="w-4 h-4" /> Full inspection of tool executions
            </div>
          </div>

          {/* Card 6 */}
          <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-5">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              Executive Analytics & Metrics
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Monitor total conversations processed, AI deflection rate, human escalation percentage, and cost per ticket with live visual charts.
            </p>
            <div className="mt-5 pt-5 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-teal-600">
              <Check className="w-4 h-4" /> Comprehensive ROI tracking
            </div>
          </div>
        </div>
      </section>

      {/* 6. HOW IT WORKS & MANUAL ONBOARDING */}
      <section id="how" className="py-20 bg-slate-50 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 text-brand-700 bg-brand-50 px-3 py-1 rounded-full text-xs font-semibold border border-brand-200 mb-3">
              <CheckCircle className="w-3.5 h-3.5" /> Simple 3-Step Setup
            </div>
            <h2 className="text-3xl md:text-5xl font-extrabold text-slate-950 tracking-tight">
              From Signup to Live AI in 24 Hours
            </h2>
            <p className="mt-4 text-slate-600 text-lg">
              We provide complete manual onboarding so you never have to wrestle with complicated API configurations or webhook setups.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 relative">
              <div className="text-5xl font-black text-slate-150 text-slate-200 mb-4">
                01
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                1-Click Shopify Connection
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Authorize the Solact app on your Shopify store. Solact securely syncs your product catalog, orders, and customer data in minutes.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-slate-200 relative">
              <div className="text-5xl font-black text-slate-150 text-slate-200 mb-4">
                02
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                Policy Ingestion & Brand Tone
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Provide your website URL or upload store policy PDFs. Our team indexes them into pgvector and configures your brand's unique conversational voice.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-slate-200 relative">
              <div className="text-5xl font-black text-slate-150 text-slate-200 mb-4">
                03
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                Go Live & Human Routing
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Connect your Chatwoot inbox and WhatsApp channel. Solact starts handling inquiries 24/7, routing complex cases to your agents automatically.
              </p>
            </div>
          </div>

          <div id="onboarding" className="mt-14 bg-gradient-to-r from-slate-900 to-slate-950 text-white rounded-2xl p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-8 border border-slate-800">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-400 uppercase tracking-wider bg-brand-950 px-3 py-1 rounded-full border border-brand-800 mb-2">
                White-Glove Service
              </div>
              <h3 className="text-2xl md:text-3xl font-bold">
                Prefer Us to Set Everything Up for You?
              </h3>
              <p className="text-sm text-slate-300 mt-2 max-w-xl">
                Our engineering team will jump on a 1-on-1 call, configure your Shopify store, verify your policies in our AI Test Lab, and test WhatsApp notifications before launch.
              </p>
            </div>
            <a
              href="#waitlist"
              className="bg-brand-600 hover:bg-brand-500 text-white font-semibold px-6 py-3.5 rounded-xl shadow-md transition whitespace-nowrap"
            >
              Book 1-on-1 Setup Call
            </a>
          </div>
        </div>
      </section>

      {/* 7. DETAILED PRICING SECTION */}
      <section id="pricing" className="py-24 max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 text-brand-700 bg-brand-50 px-3 py-1 rounded-full text-xs font-semibold border border-brand-200 mb-3">
            <Zap className="w-3.5 h-3.5" /> Transparent Pricing
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold text-slate-950 tracking-tight">
            Predictable Plans for Every Shopify Merchant
          </h2>
          <p className="mt-4 text-slate-600 text-lg">
            No surprise per-resolution fees. Choose a plan based on your conversation volume.
          </p>

          {/* Monthly / Annual Toggle */}
          <div className="mt-8 inline-flex items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                billingCycle === "monthly"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Monthly billing
            </button>
            <button
              onClick={() => setBillingCycle("annual")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition ${
                billingCycle === "annual"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>Annual billing</span>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid lg:grid-cols-3 gap-8 items-stretch">
          {/* Tier 1: Starter */}
          <div className="bg-white border border-slate-200 rounded-3xl p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Starter
              </div>
              <h3 className="text-2xl font-bold text-slate-900">
                For Growing Brands
              </h3>
              <p className="text-sm text-slate-500 mt-2">
                Essential automated support for emerging Shopify stores.
              </p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-slate-950">
                  {billingCycle === "monthly" ? "$49" : "$39"}
                </span>
                <span className="text-sm text-slate-500 font-medium">/month</span>
              </div>

              <div className="mt-8 space-y-3.5 text-sm text-slate-700">
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Up to <strong>500</strong> AI conversations / month</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>1 Shopify Store connected</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Real-time order & tracking lookups</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Policy RAG (Up to 5 documents)</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Chatwoot human handoff integration</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Storefront Web Chat Widget</span>
                </div>
              </div>
            </div>

            <a
              href="#waitlist"
              className="mt-8 block w-full text-center bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold py-3 rounded-xl transition"
            >
              Get Started with Starter
            </a>
          </div>

          {/* Tier 2: Growth (Highlighted) */}
          <div className="bg-slate-900 text-white border-2 border-brand-500 rounded-3xl p-8 flex flex-col justify-between shadow-xl relative scale-105 z-10">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand-500 text-white text-[11px] uppercase font-bold tracking-wider px-3.5 py-1 rounded-full shadow-md">
              Most Popular
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-brand-400 mb-1">
                Growth
              </div>
              <h3 className="text-2xl font-bold text-white">
                For High-Velocity Stores
              </h3>
              <p className="text-sm text-slate-300 mt-2">
                Automate order tracking, WhatsApp notifications, and human escalations.
              </p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-white">
                  {billingCycle === "monthly" ? "$129" : "$99"}
                </span>
                <span className="text-sm text-slate-400 font-medium">/month</span>
              </div>

              <div className="mt-8 space-y-3.5 text-sm text-slate-200">
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-brand-400 shrink-0" />
                  <span>Up to <strong>2,500</strong> AI conversations / month</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-brand-400 shrink-0" />
                  <span>2 Shopify Stores connected</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-brand-400 shrink-0" />
                  <span><strong>WhatsApp & Email</strong> automated notifications</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-brand-400 shrink-0" />
                  <span>Unlimited Policy RAG documents & FAQs</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-brand-400 shrink-0" />
                  <span>AI Test Lab with tool-call inspection</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-brand-400 shrink-0" />
                  <span>Priority human agent distribution & queues</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-brand-400 shrink-0" />
                  <span>Free 1-on-1 manual onboarding call</span>
                </div>
              </div>
            </div>

            <a
              href="#waitlist"
              className="mt-8 block w-full text-center bg-brand-600 hover:bg-brand-500 text-white font-semibold py-3.5 rounded-xl shadow-md transition"
            >
              Start 14-Day Free Trial
            </a>
          </div>

          {/* Tier 3: Enterprise */}
          <div className="bg-white border border-slate-200 rounded-3xl p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Scale & Enterprise
              </div>
              <h3 className="text-2xl font-bold text-slate-900">
                For Enterprise Brands
              </h3>
              <p className="text-sm text-slate-500 mt-2">
                Custom routing, high-volume SLA, and dedicated engineering support.
              </p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-slate-950">
                  {billingCycle === "monthly" ? "$299" : "$249"}
                </span>
                <span className="text-sm text-slate-500 font-medium">/month</span>
              </div>

              <div className="mt-8 space-y-3.5 text-sm text-slate-700">
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>10,000+</strong> AI conversations / month</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Unlimited Shopify Stores</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Custom ERP / WMS / 3PL API integrations</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Dedicated Chatwoot instance & custom domain</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Custom fine-tuned brand tone models</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>99.9% Uptime SLA & 24/7 dedicated engineer</span>
                </div>
              </div>
            </div>

            <a
              href="#waitlist"
              className="mt-8 block w-full text-center bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-xl transition"
            >
              Contact Enterprise Sales
            </a>
          </div>
        </div>
      </section>

      {/* 8. WAITLIST & MANUAL ONBOARDING FORM */}
      <section id="waitlist" className="py-20 bg-gradient-to-b from-slate-50 via-white to-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 text-brand-700 bg-brand-50 px-3 py-1 rounded-full text-xs font-semibold border border-brand-200 mb-3">
              <Sparkles className="w-3.5 h-3.5" /> Early Access & White-Glove Setup
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-950 tracking-tight">
              Get Your Store Onboarded in 24 Hours
            </h2>
            <p className="mt-3 text-slate-600 text-base">
              Submit your store details below. Our engineering team will review your requirements, prepare your custom AI prompt, and guide your launch.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-8 md:p-10 shadow-lg">
            {waitlistSubmitted ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">
                  You're on the Priority Setup List!
                </h3>
                <p className="text-slate-600 text-sm max-w-md mx-auto">
                  We've received your store request for <strong>{waitlistForm.storeUrl}</strong>. Our lead onboarding specialist will email you at <strong>{waitlistForm.email}</strong> within 2 business hours to schedule your onboarding session.
                </p>
                <div className="pt-4">
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-medium text-sm transition"
                  >
                    <span>Go to Merchant Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleWaitlistSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                      Your Name / Brand Contact *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alex Miller"
                      value={waitlistForm.name}
                      onChange={(e) => setWaitlistForm({ ...waitlistForm, name: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                      Work Email *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="alex@yourbrand.com"
                      value={waitlistForm.email}
                      onChange={(e) => setWaitlistForm({ ...waitlistForm, email: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                      Shopify Store Domain / URL *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="yourbrand.myshopify.com or brand.com"
                      value={waitlistForm.storeUrl}
                      onChange={(e) => setWaitlistForm({ ...waitlistForm, storeUrl: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                      Monthly Order Volume
                    </label>
                    <select
                      value={waitlistForm.monthlyOrders}
                      onChange={(e) => setWaitlistForm({ ...waitlistForm, monthlyOrders: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm bg-white"
                    >
                      <option value="under-500">Under 500 orders / month</option>
                      <option value="500-2500">500 – 2,500 orders / month</option>
                      <option value="2500-10000">2,500 – 10,000 orders / month</option>
                      <option value="10000-plus">10,000+ orders / month</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Channels You Want Solact to Automate:
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: "web", label: "Web Chat Widget", icon: MessageSquare },
                      { id: "whatsapp", label: "WhatsApp Alerts", icon: Smartphone },
                      { id: "email", label: "Email Auto-Reply", icon: Mail },
                    ].map((ch) => (
                      <label
                        key={ch.id}
                        className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs font-semibold text-slate-700"
                      >
                        <input
                          type="checkbox"
                          defaultChecked={waitlistForm.channels.includes(ch.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setWaitlistForm({
                                ...waitlistForm,
                                channels: [...waitlistForm.channels, ch.id],
                              });
                            } else {
                              setWaitlistForm({
                                ...waitlistForm,
                                channels: waitlistForm.channels.filter((c) => c !== ch.id),
                              });
                            }
                          }}
                          className="rounded text-brand-600 focus:ring-brand-500"
                        />
                        <ch.icon className="w-4 h-4 text-slate-500" />
                        <span>{ch.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Any Specific Requirements or Policies? (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. We have custom return windows for international customers..."
                    value={waitlistForm.notes}
                    onChange={(e) => setWaitlistForm({ ...waitlistForm, notes: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingWaitlist}
                  className="w-full bg-slate-950 hover:bg-slate-800 text-white font-semibold text-base py-4 rounded-xl shadow-md transition flex items-center justify-center gap-2"
                >
                  {submittingWaitlist ? (
                    <span>Submitting store details...</span>
                  ) : (
                    <>
                      <span>Submit & Book Manual Onboarding</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <p className="text-center text-xs text-slate-500">
                  No credit card required. Includes 14-day full-feature trial and personal setup call.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* 9. FOOTER */}
      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-100 bg-white p-0.5 shadow-xs">
                <img src="/icon.svg" alt="Solact Logo" className="w-full h-full object-contain" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-slate-900">Solact</span>
                <span className="text-xs text-slate-500">
                  © {new Date().getFullYear()} Solact Inc. All rights reserved.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm text-slate-600">
              <Link href="/dashboard" className="hover:text-slate-950 transition">
                Merchant App
              </Link>
              <Link href="/login" className="hover:text-slate-950 transition">
                Sign In
              </Link>
              <a href="#demo" className="hover:text-slate-950 transition">
                Live Demo
              </a>
              <a href="#pricing" className="hover:text-slate-950 transition">
                Pricing
              </a>
              <a href="mailto:support@solact.in" className="hover:text-slate-950 transition">
                Contact Support
              </a>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <p>
              Solact is an independent software provider. "Shopify" is a trademark of Shopify Inc.
            </p>
            <div className="flex gap-4">
              <span>Privacy Policy</span>
              <span>•</span>
              <span>Terms of Service</span>
              <span>•</span>
              <span>Security</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
