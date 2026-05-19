"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

function DeactivatedNotice() {
  const searchParams = useSearchParams()
  if (searchParams.get('deactivated') !== 'true') return null
  return (
    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950">
      <p className="text-sm font-semibold text-red-700 dark:text-red-400">Account Deactivated</p>
      <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">
        Your account has been deactivated. Contact support if you believe this is an error.
      </p>
    </div>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  function validate(): boolean {
    const newErrors: typeof errors = {};
    if (!email.trim()) newErrors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      newErrors.email = "Enter a valid email address.";
    if (!password) newErrors.password = "Password is required.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError("");

    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      toast.error("Supabase not configured yet — add real credentials to .env.local");
      setLoading(false);
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const redirectTo = params.get("redirectTo") || "/dashboard";
    router.push(redirectTo);
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-[#0F172A]">Welcome back</h1>
        <p className="mt-1.5 text-sm text-[#64748B]">
          Sign in to your LeadZip account to continue.
        </p>
      </div>

      <Suspense fallback={null}><DeactivatedNotice /></Suspense>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Email */}
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-[#374151]"
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            placeholder="you@company.com"
            className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] outline-none transition-colors focus:border-[#0369A1] focus:ring-2 focus:ring-[#0369A1]/10 ${
              errors.email
                ? "border-red-400 bg-red-50"
                : "border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#CBD5E1]"
            }`}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-600">{errors.email}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-sm font-medium text-[#374151]"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-[#0369A1] hover:text-[#0284C7] transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password)
                  setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              placeholder="••••••••"
              className={`w-full rounded-xl border px-3.5 py-2.5 pr-10 text-sm text-[#0F172A] placeholder:text-[#94A3B8] outline-none transition-colors focus:border-[#0369A1] focus:ring-2 focus:ring-[#0369A1]/10 ${
                errors.password
                  ? "border-red-400 bg-red-50"
                  : "border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#CBD5E1]"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B] transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-red-600">{errors.password}</p>
          )}
        </div>

        {/* Submit */}
        <Button
          type="submit"
          disabled={loading}
          className="mt-2 h-11 w-full rounded-xl bg-[#0369A1] text-sm font-semibold text-white hover:bg-[#0284C7] disabled:opacity-70"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </>
          )}
        </Button>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </form>

      {/* Divider */}
      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-[#E2E8F0]" />
        <span className="text-xs text-[#94A3B8]">or</span>
        <div className="h-px flex-1 bg-[#E2E8F0]" />
      </div>

      {/* Sign up link */}
      <p className="text-center text-sm text-[#64748B]">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-semibold text-[#0369A1] hover:text-[#0284C7] transition-colors"
        >
          Create an account
        </Link>
      </p>

      {/* Compliance */}
      <p className="mt-8 text-center text-xs leading-relaxed text-[#94A3B8]">
        By signing in you agree to our{" "}
        <Link href="/terms" className="underline hover:text-[#64748B]">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline hover:text-[#64748B]">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
