"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowRight, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { friendlyAuthError } from "../authErrors";
import { track, readGclid } from "@/lib/analytics";

/**
 * Attach the stored Google click id to the freshly created profile row so the
 * Stripe webhook can emit it on the paid invoice later.
 *
 * Feature detecting on purpose: the gclid column arrives with
 * supabase/migrations/20260812_gclid.sql, and a database that has not run it yet
 * must still be able to sign people up. Any failure here is swallowed.
 *
 * Raced against a short timeout so a slow or hanging write can never hold up
 * the redirect to Stripe Checkout.
 */
async function persistGclidToProfile(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<void> {
  const gclid = readGclid();
  if (!gclid) return;

  try {
    await Promise.race([
      supabase.from("users_profile").update({ gclid }).eq("id", userId),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch {
    // Column missing, RLS, or offline. Attribution is best effort and must
    // never block account creation.
  }
}

interface FormErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

/** Visual order of the form fields, used to focus the first invalid one. */
const FIELD_ORDER: (keyof FormErrors)[] = [
  "fullName",
  "email",
  "password",
  "confirmPassword",
];

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
              i < strength ? colors[strength - 1] : "bg-sand"
            }`}
          />
        ))}
      </div>
      {/* emerald-700 (#047857): 5.25:1 on paper — emerald-600 failed AA at 3.61:1 */}
      <p className={`mt-1 text-xs font-medium ${strength >= 3 ? "text-emerald-700" : "text-stone"}`}>
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
  // Plan carried in from a "Start 7-day free trial" CTA. Read from
  // window.location rather than useSearchParams so this page keeps its static
  // prerender and needs no Suspense boundary.
  const [trialPlan, setTrialPlan] = useState<"pro" | "agency" | null>(null);
  const [trialBilling, setTrialBilling] = useState<"monthly" | "annual">("monthly");
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    // Reading window is only possible after mount, since this client component
    // still prerenders on the server. useSearchParams would avoid the effect but
    // forces a Suspense boundary and drops the page's static prerender, which is
    // a worse trade for a value that only preselects a plan.
    const params = new URLSearchParams(window.location.search);
    const plan = params.get("plan");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (plan === "pro" || plan === "agency") setTrialPlan(plan);
    if (params.get("billing") === "annual") setTrialBilling("annual");
  }, []);

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
    // Screen-reader and keyboard users land directly on the first problem
    // instead of hunting for it after the silent submit failure.
    const firstInvalid = FIELD_ORDER.find((field) => newErrors[field]);
    if (firstInvalid) document.getElementById(firstInvalid)?.focus();
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError("");

    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      toast.error("Supabase not configured yet. Add real credentials to .env.local");
      setLoading(false);
      return;
    }

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(
        friendlyAuthError(authError, "We could not create your account. Please try again in a moment.")
      );
      setLoading(false);
      return;
    }

    // The account exists at this point, on both the live-session path and the
    // confirm-your-email path, so this is where a signup has "succeeded".
    // No email and no name are ever sent, only which plan the CTA preselected.
    track("signup_completed", {
      trial_selected: !!trialPlan,
      plan: trialPlan,
      billing: trialBilling,
    });

    // Carry the ad click id onto the profile row. Best effort, never fatal.
    if (data.user) {
      await persistGclidToProfile(supabase, data.user.id);
    }

    // Email confirmation is disabled, so signUp returns a live session and the
    // user is already logged in. The check-your-email screen only shows if
    // confirmation is ever re-enabled (no session returned).
    if (data.session) {
      // Arrived from a trial CTA: hand off to Stripe so the card is collected
      // and the 7-day trial actually starts. Without this the visitor lands on
      // the dashboard with a free account, having been promised a trial.
      if (trialPlan) {
        try {
          let promo = false;
          try {
            promo = window.localStorage.getItem("leadzipp_promo15") === "1";
          } catch {
            // private mode, treat as unclaimed
          }
          const res = await fetch("/api/stripe/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: trialPlan, billing: trialBilling, promo }),
          });
          const payload = await res.json().catch(() => ({}));
          if (res.ok && payload?.url) {
            window.location.href = payload.url;
            return;
          }
          toast.error(
            payload?.error ||
              "Your account is ready, but checkout did not open. You can start the trial from the pricing page."
          );
        } catch {
          toast.error(
            "Your account is ready, but checkout did not open. You can start the trial from the pricing page."
          );
        }
      }
      router.push("/dashboard");
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  function clearError(field: keyof FormErrors) {
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  const inputClass = (hasError: boolean) =>
    `w-full rounded-xl border px-3.5 py-2.5 text-sm text-ink placeholder:text-stone outline-none transition-colors focus:border-signal focus:ring-2 focus:ring-signal/15 ${
      hasError
        ? "border-red-400 bg-red-50"
        : "border-sand bg-paper hover:border-stone/40"
    }`;

  if (success) {
    return (
      <div>
        <div className="mb-8">
          <span className="readout text-signal">Create account</span>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink">Check your email</h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            One more step and your account is live.
          </p>
        </div>
        <div className="rounded-2xl bg-signal-50 border border-signal/20 p-6 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-signal/10">
            <CheckCircle className="h-7 w-7 text-signal" />
          </span>
          <h2 className="font-display font-bold text-ink mb-1">Confirmation link sent</h2>
          <p className="text-sm text-ink-soft">
            We sent a confirmation link to <strong className="text-ink">{email}</strong>.{" "}
            Click it to activate your account.
          </p>
        </div>
        <p className="mt-5 text-center text-sm text-ink-soft">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-signal hover:text-signal-600 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <span className="readout text-signal">Create account</span>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink">Create your account</h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          Start finding local business leads in minutes.
        </p>
      </div>

      {/* Say plainly that a card comes next, before the visitor fills the form.
          They clicked a trial CTA, so the handoff to Stripe should not surprise
          them. */}
      {trialPlan && (
        <div className="mb-6 rounded-xl border border-sand bg-paper-2 p-4">
          <p className="text-sm font-semibold text-ink">
            Starting your 7-day {trialPlan === "pro" ? "Pro" : "Agency"} trial
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            After this step we will take you to Stripe to add a card. You are not charged
            today. Cancel any time before day 7 and you pay nothing.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Full name */}
        <div>
          <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-ink-soft">
            Full name
          </label>
          <input
            id="fullName"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => { setFullName(e.target.value); clearError("fullName"); }}
            placeholder="Jane Smith"
            aria-invalid={errors.fullName ? true : undefined}
            aria-describedby={errors.fullName ? "fullName-error" : undefined}
            className={inputClass(!!errors.fullName)}
          />
          {errors.fullName && (
            <p id="fullName-error" className="mt-1 text-xs text-red-600">{errors.fullName}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink-soft">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); clearError("email"); }}
            placeholder="you@company.com"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "email-error" : undefined}
            className={inputClass(!!errors.email)}
          />
          {errors.email && (
            <p id="email-error" className="mt-1 text-xs text-red-600">{errors.email}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink-soft">
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
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? "password-error" : undefined}
              className={inputClass(!!errors.password)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute -right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-stone hover:text-ink transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p id="password-error" className="mt-1 text-xs text-red-600">{errors.password}</p>
          )}
          <PasswordStrength password={password} />
        </div>

        {/* Confirm password */}
        <div>
          <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-ink-soft">
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
              aria-invalid={errors.confirmPassword ? true : undefined}
              aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
              className={inputClass(!!errors.confirmPassword)}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute -right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-stone hover:text-ink transition-colors"
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p id="confirmPassword-error" className="mt-1 text-xs text-red-600">
              {errors.confirmPassword}
            </p>
          )}
          {confirmPassword && password === confirmPassword && !errors.confirmPassword && (
            <p className="mt-1 flex items-center gap-1 text-xs text-emerald-700">
              <CheckCircle className="h-3 w-3" /> Passwords match
            </p>
          )}
        </div>

        {/* Terms */}
        <p className="text-xs leading-relaxed text-ink-soft">
          By signing up, you agree to our{" "}
          <Link href="/terms" className="font-medium text-signal hover:text-signal-600">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="font-medium text-signal hover:text-signal-600">
            Privacy Policy
          </Link>
          .
        </p>

        {/* Submit */}
        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-full bg-signal text-sm font-semibold text-white hover:bg-signal-600 disabled:opacity-70"
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
          <div
            role="alert"
            className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}
      </form>

      {/* Sign in link */}
      <p className="mt-5 text-center text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-signal hover:text-signal-600 transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}
