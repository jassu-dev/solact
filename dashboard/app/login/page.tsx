"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, ShieldCheck, Key } from "lucide-react";
import { login, setAuth } from "@/lib/api";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@solact.in");
  const [password, setPassword] = useState("Password123!");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login(email, password);
      setAuth(data.access_token, {
        id: data.user_id,
        email: data.email,
        name: data.name,
        organization_id: data.organization_id,
      });
      toast.success("Welcome back!");
      router.push("/dashboard");
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Login failed. Please verify credentials.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function fillDemo() {
    setEmail("admin@solact.in");
    setPassword("Password123!");
    toast.info("Filled founder credentials");
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex flex-col bg-gradient-to-br from-brand-600 via-brand-700 to-slate-900 p-12 text-white justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur p-1 flex items-center justify-center">
            <img src="/icon.svg" alt="Solact" className="w-full h-full object-contain" />
          </div>
          <span className="font-bold text-2xl tracking-tight">Solact</span>
        </div>
        <div>
          <h2 className="text-3xl font-bold leading-tight">
            “Solact automated 70% of our customer inquiries within 24 hours of launch.”
          </h2>
          <p className="mt-4 text-white/75">— D2C Shopify Brand, 4.5k orders/month</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/60">
          <ShieldCheck className="w-4 h-4 text-brand-300" />
          <span>Grounded in store data · Zero hallucinations</span>
        </div>
      </div>

      <div className="flex items-center justify-center p-8 bg-slate-50 md:bg-white">
        <div className="w-full max-w-md bg-white p-8 rounded-2xl md:p-0 shadow-sm md:shadow-none border md:border-none border-slate-200">
          <div className="flex items-center gap-2 md:hidden mb-6">
            <div className="w-8 h-8 rounded-lg bg-white shadow-xs p-1 border border-slate-200">
              <img src="/icon.svg" alt="Solact" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-xl text-slate-900">Solact</span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900">Sign in to Solact</h1>
          <p className="text-sm text-slate-600 mt-1">
            Access your store AI assistant and live analytics.
          </p>

          {/* Quick Demo Credentials Pill */}
          <div className="mt-5 p-3 rounded-xl bg-brand-50 border border-brand-200/80 text-xs text-brand-900 flex items-center justify-between">
            <div>
              <span className="font-bold">Default admin:</span> admin@solact.in
            </div>
            <button
              type="button"
              onClick={fillDemo}
              className="text-brand-700 hover:text-brand-900 font-bold underline ml-2"
            >
              Fill
            </button>
          </div>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@solact.in"
                className="w-full h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-semibold text-sm transition flex items-center justify-center gap-2 shadow-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500">
            Don't have an account yet?{" "}
            <Link href="/register" className="font-bold text-brand-600 hover:underline">
              Create one here →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
