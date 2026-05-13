"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowRight, Loader2, CheckCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    const { error: authError } = await supabase.auth.updateUser({ password });

    if (authError) {
      setError(authError.message);
      setIsLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/dashboard"), 2000);
  }

  const inputClass = (hasError: boolean) =>
    `w-full rounded-xl border px-3.5 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] outline-none transition-colors focus:border-[#0369A1] focus:ring-2 focus:ring-[#0369A1]/10 ${
      hasError
        ? "border-red-400 bg-red-50"
        : "border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#CBD5E1]"
    }`;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-[#0F172A]">Set new password</h1>
        <p className="mt-1.5 text-sm text-[#64748B]">
          Choose a strong password for your LeadZip account.
        </p>
      </div>

      {success ? (
        <div className="rounded-xl bg-green-50 border border-green-200 p-6 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-3" />
          <h3 className="font-semibold text-slate-900 mb-1">Password updated</h3>
          <p className="text-sm text-slate-600">
            Your password has been changed. Redirecting to dashboard...
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* New password */}
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[#374151]">
              New password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="Min. 8 characters"
                className={inputClass(!!error && password.length > 0 && password.length < 8)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B] transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div>
            <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-[#374151]">
              Confirm new password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                placeholder="Re-enter your password"
                className={inputClass(!!error && confirmPassword !== password)}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B] transition-colors"
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword && password === confirmPassword && (
              <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle className="h-3 w-3" /> Passwords match
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="h-11 w-full rounded-xl bg-[#0369A1] text-sm font-semibold text-white hover:bg-[#0284C7] disabled:opacity-70"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating password...
              </>
            ) : (
              <>
                Set new password
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      )}

      <div className="mt-5 text-center">
        <Link
          href="/login"
          className="text-sm font-medium text-[#64748B] hover:text-[#0F172A] transition-colors"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
