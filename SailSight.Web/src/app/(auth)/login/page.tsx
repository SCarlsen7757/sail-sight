"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PointCloudBackground } from "@/components/ui/point-cloud-background";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const { providers, refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const next = search?.get("next") ?? "/";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await api.POST("/api/v1/auth/login", {
        body: { email, password },
      });
      if (err) {
        setError("Invalid email or password.");
        return;
      }
      await refresh();
      router.push(next);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-lg p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Sign in
        </h1>
        <p className="text-sm text-white/40">Access your Vakaros telemetry dashboard</p>
      </div>
      {providers?.local && (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-white/50">Email Address</label>
            <input 
              className="w-full rounded-lg border border-white/10 bg-white/[0.02] p-3 text-white placeholder-white/20 focus:border-action-primary focus:outline-none focus:ring-1 focus:ring-action-primary transition-all" 
              type="email" 
              placeholder="email@example.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              autoComplete="email" 
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-white/50">Password</label>
            <input 
              className="w-full rounded-lg border border-white/10 bg-white/[0.02] p-3 text-white placeholder-white/20 focus:border-action-primary focus:outline-none focus:ring-1 focus:ring-action-primary transition-all" 
              type="password" 
              placeholder="••••••••" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              autoComplete="current-password" 
            />
          </div>
          {error && <div className="text-sm text-red-400 font-medium bg-red-950/20 border border-red-500/10 p-2.5 rounded-md">{error}</div>}
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full rounded-lg bg-action-primary hover:bg-action-hover text-white font-bold p-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,69,0,0.35)]"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <p className="pt-2 text-center text-xs text-white/40 leading-relaxed">
            Need an account? Ask your administrator to invite you.
          </p>
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#030712] overflow-hidden px-4 select-none">
      <PointCloudBackground />
      <div className="relative z-10 w-full max-w-sm">
        <Suspense fallback={
          <div className="w-full max-w-md rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-lg p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] text-center text-sm text-white/40">
            Loading…
          </div>
        }>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
