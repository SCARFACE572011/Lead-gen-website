"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, ArrowRight, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

interface FormErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const strength = checks.filter(Boolean).length;
  const labels = ["Weak", "Fair", "Good", "Strong"];
  const colors = ["bg-red-400", "bg-amber-400", "bg-yellow-400", "bg-emerald-500"];

  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < strength ? colors[strength - 1] : "bg-[#E2E8F0]"
            }`}
          />
        ))}
      </div>
      <p className={`mt-1 text-xs font-medium ${strength >= 3 ? "text-emerald-600" : "text-[#94A3B8]"}`}>
        {labels[strength - 1] ?? "Too short"}
      </p>
    </div>
  );
}

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  function validate(): boolean {
    const newErrors: FormErrors = {};
    if (!fullName.trim()) newErrors.fullName = "Full name is required.";
    if (!email.trim()) newErrors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      newErrors.email = "Enter a valid email address.";
    if (!password) newErrors.password = "Password is required.";
    else if (password.length < 8)
      newErrors.password = "Password must be at least 8 characters.";
    if (!confirmPassword) newErrors.confirmPassword = "Please confirm your password.";
    else if (password !== confirmPassword)
      newErrors.confirmPassword = "Passwords do not match.";
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

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  function clearError(field: keyof FormErrors) {
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  const inputClass = (hasError: boolean) =>
    `w-full rounded-xl border px-3.5 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] outline-none transition-colors focus:border-[#0369A1] focus:ring-2 focus:ring-[#0369A1]/10 ${
      hasError
        ? "border-red-400 bg-red-50"
        : "border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#CBD5E1]"
    }`;

  if (success) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-[#0F172A]">Create your account</h1>
          <p className="mt-1.5 text-sm text-[#64748B]">
            Start finding local business leads in minutes.
          </p>
        </div>
        <div className="rounded-xl bg-green-50 border border-green-200 p-6 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-3" />
          <h3 className="font-semibold text-slate-900 mb-1">Check your email</h3>
          <p className="text-sm text-slate-600">
            We sent a confirmation link to <strong>{email}</strong>.{" "}
            Click it to activate your account.
          </p>
        </div>
        <p className="mt-5 text-center text-sm text-[#64748B]">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[#0369A1] hover:text-[#0284C7] transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-[#0F172A]">Create your account</h1>
        <p className="mt-1.5 text-sm text-[#64748B]">
          Start finding local business leads in minutes.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Full name */}
        <div>
          <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-[#374151]">
            Full name
          </label>
          <input
            id="fullName"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => { setFullName(e.target.value); clearError("fullName"); }}
            placeholder="Jane Smith"
            className={inputClass(!!errors.fullName)}
          />
          {errors.fullName && <p className="mt-1 text-xs text-red-600">{errors.fullName}</p>}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[#374151]">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); clearError("email"); }}
            placeholder="you@company.com"
            className={inputClass(!!errors.email)}
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[#374151]">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearError("password"); }}
              placeholder="Min. 8 characters"
              className={inputClass(!!errors.password)}
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
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
          <PasswordStrength password={password} />
        </div>

        {/* Confirm password */}
        <div>
          <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-[#374151]">
            Confirm password
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); clearError("confirmPassword"); }}
              placeholder="Re-enter your password"
              className={inputClass(!!errors.confirmPassword)}
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
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>
          )}
          {confirmPassword && password === confirmPassword && !errors.confirmPassword && (
            <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle className="h-3 w-3" /> Passwords match
            </p>
          )}
        </div>

        {/* Terms */}
        <p className="text-xs leading-relaxed text-[#64748B]">
          By signing up, you agree to our{" "}
          <Link href="/terms" className="font-medium text-[#0369A1] hover:text-[#0284C7]">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="font-medium text-[#0369A1] hover:text-[#0284C7]">
            Privacy Policy
          </Link>
          .
        </p>

        {/* Submit */}
        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-xl bg-[#0369A1] text-sm font-semibold text-white hover:bg-[#0284C7] disabled:opacity-70"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating account...
            </>
          ) : (
            <>
              Create account
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

      {/* Sign in link */}
      <p className="mt-5 text-center text-sm text-[#64748B]">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-[#0369A1] hover:text-[#0284C7] transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}
