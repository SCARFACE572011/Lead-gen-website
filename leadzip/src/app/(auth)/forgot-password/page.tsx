"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Email is required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetch('/api/auth/send-reset-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      setError(
        res.status === 429
          ? "Too many attempts. Wait a minute and try again."
          : "Something went wrong on our end. Please try again."
      );
      setLoading(false);
      return;
    }

    setLoading(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-signal-50">
          <CheckCircle2 className="h-7 w-7 text-signal" />
        </div>
        <h1 className="mb-2 font-display text-2xl font-extrabold tracking-tight text-ink">Check your email</h1>
        <p className="mb-6 text-sm text-ink-soft">
          If an account exists for{" "}
          <span className="font-semibold text-ink">{email}</span>, we sent a
          password reset link. Check your inbox and spam folder.
        </p>
        <p className="mb-6 text-xs text-stone">
          The link expires in 60 minutes.
        </p>
        <Link href="/login">
          <Button
            variant="outline"
            className="h-10 rounded-full border-sand text-sm font-semibold text-ink hover:bg-paper-2"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to sign in
          </Button>
        </Link>
        <p className="mt-6 text-xs text-stone">
          Didn&apos;t receive it?{" "}
          <button
            onClick={() => { setSubmitted(false); setEmail(""); }}
            className="font-medium text-signal hover:text-signal-600 transition-colors"
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
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-signal-50">
          <Mail className="h-6 w-6 text-signal" />
        </div>
        <span className="readout text-signal">Password reset</span>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink">Reset your password</h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          Enter your email address and we&apos;ll send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink-soft">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }}
            placeholder="you@company.com"
            className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-ink placeholder:text-stone outline-none transition-colors focus:border-signal focus:ring-2 focus:ring-signal/15 ${
              error
                ? "border-red-400 bg-red-50"
                : "border-sand bg-paper hover:border-stone/40"
            }`}
          />
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-full bg-signal text-sm font-semibold text-white hover:bg-signal-600 disabled:opacity-70"
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
          className="inline-flex items-center gap-1 text-sm font-medium text-ink-soft hover:text-ink transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
