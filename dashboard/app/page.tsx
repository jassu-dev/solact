"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sparkles, ShieldCheck, Zap, ArrowRight } from "lucide-react";
import { getUser } from "@/lib/api";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    if (getUser()) {
      router.replace("/dashboard");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-blue-50/30 to-white">
      <header className="sticky top-0 z-30 backdrop-blur border-b border-slate-200 bg-white/70">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold">
              S
            </div>
            <span className="font-bold text-lg text-slate-900">Solact</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-md hover:bg-slate-100">
              Sign in
            </Link>
            <Link href="/register" className="text-sm bg-brand-600 text-white hover:bg-brand-700 px-4 py-2 rounded-md shadow-sm">
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-16 pb-24">
        <section className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 text-xs font-medium px-3 py-1 rounded-full border border-brand-100 mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            AI Employee · Built for Shopify merchants
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-slate-900 leading-[1.05]">
            Your 24/7 AI Customer Support{" "}
            <span className="bg-gradient-to-r from-brand-500 to-brand-700 bg-clip-text text-transparent">
              Employee
            </span>
          </h1>
          <p className="mt-6 text-lg text-slate-600 leading-relaxed">
            Connect Shopify. Add your policies. Solact answers customer questions using your
            real store data — orders, tracking, products — safely escalates when needed.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
            <Link href="/register" className="inline-flex items-center gap-2 bg-slate-900 text-white hover:bg-slate-800 px-6 py-3 rounded-lg font-medium shadow-sm">
              Start free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/login" className="inline-flex items-center gap-2 border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 px-6 py-3 rounded-lg font-medium">
              I already have an account
            </Link>
          </div>
        </section>

        <section id="features" className="mt-24 grid md:grid-cols-3 gap-6">
          {[
            { icon: Zap, title: "Instant answers", body: "Pulls live customer, order, product and tracking data from your Shopify store." },
            { icon: ShieldCheck, title: "Safe by design", body: "Backend validates every tool call. Refunds and sensitive actions always escalate to human." },
            { icon: Sparkles, title: "Policies + RAG", body: "Ingest website, shipping, return, warranty, FAQs. BGE embeddings + pgvector, no external paid APIs." },
          ].map((f, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <div className="h-11 w-11 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">{f.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-6 text-sm text-slate-500 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-gradient-to-br from-brand-500 to-brand-700" />
            <span className="font-semibold text-slate-700">Solact</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
          <span>Built for Shopify merchants who want happier customers and fewer tickets.</span>
        </div>
      </footer>
    </div>
  );
}
