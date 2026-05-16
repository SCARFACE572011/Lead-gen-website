"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Email is required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setLoading(true);
    setError(null);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <h1 className="mb-2 text-2xl font-extrabold text-[#0F172A]">Check your email</h1>
        <p className="mb-6 text-sm text-[#64748B]">
          If an account exists for{" "}
          <span className="font-semibold text-[#0F172A]">{email}</span>, we sent a
          password reset link. Check your inbox and spam folder.
        </p>
        <p className="mb-6 text-xs text-[#94A3B8]">
          The link expires in 60 minutes.
        </p>
        <Link href="/login">
          <Button
            variant="outline"
            className="h-10 rounded-xl border-[#E2E8F0] text-sm font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to sign in
          </Button>
        </Link>
        <p className="mt-6 text-xs text-[#94A3B8]">
          Didn&apos;t receive it?{" "}
          <button
            onClick={() => { setSubmitted(false); setEmail(""); }}
            className="font-medium text-[#0369A1] hover:text-[#0284C7] transition-colors"
          >
            Try again
          </button>
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#F0F9FF]">
          <Mail className="h-6 w-6 text-[#0369A1]" />
        </div>
        <h1 className="text-2xl font-extrabold text-[#0F172A]">Reset your password</h1>
        <p className="mt-1.5 text-sm text-[#64748B]">
          Enter your email address and we&apos;ll send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[#374151]">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }}
            placeholder="you@company.com"
            className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] outline-none transition-colors focus:border-[#0369A1] focus:ring-2 focus:ring-[#0369A1]/10 ${
              error
                ? "border-red-400 bg-red-50"
                : "border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#CBD5E1]"
            }`}
          />
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-xl bg-[#0369A1] text-sm font-semibold text-white hover:bg-[#0284C7] disabled:opacity-70"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending reset link...
            </>
          ) : (
            <>
              Send reset link
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      <div className="mt-5 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm font-medium text-[#64748B] hover:text-[#0F172A] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
