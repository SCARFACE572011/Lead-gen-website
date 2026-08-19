"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Check,
  X,
  ArrowRight,
  Zap,
  Shield,
  Clock,
  CreditCard,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SiteHeader, SiteFooter } from "@/components/marketing/MarketingChrome";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";

/* ─── Types ─── */
type BillingCycle = "monthly" | "annual";

interface PlanFeature {
  label: string;
  included: boolean;
  note?: string;
}

interface Plan {
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  description: string;
  cta: string;
  ctaHref: string;
  popular: boolean;
  /** Same four rows on every card so plans can be diffed straight across. */
  readouts: { label: string; value: string }[];
  features: PlanFeature[];
  accentColor: string;
}

/* ─── Plan data ───
   Every number below is copied from PLAN_POLICY in src/lib/planPolicy.ts and
   EMAIL_CREDIT_TRIAL_ALLOWANCES in src/lib/emailCreditPolicy.ts, which are the
   same values the routes and the SQL enforce. Feature lists are derived from
   the shipped code, not from aspiration: the only limits marked "not included"
   are the ones a route actually enforces. Everything listed as included is
   live today. If a policy value changes, change it there first and mirror it
   here, in src/app/pricing/layout.tsx, and in src/app/api/chat/knowledge.ts. */
const PLANS: Plan[] = [
  {
    name: "Free",
    monthlyPrice: 0,
    annualPrice: 0,
    description: "Perfect for exploring LeadZipp before committing.",
    cta: "Get Started Free",
    ctaHref: "/signup",
    popular: false,
    accentColor: "#79705F",
    readouts: [
      { label: "Live searches", value: "25 / mo" },
      { label: "Email credits", value: "5 lifetime" },
      { label: "Saved leads", value: "25" },
      { label: "Seats", value: "1" },
    ],
    features: [
      { label: "25 new live territory searches per month", included: true },
      { label: "25 saved leads and 3 saved searches", included: true },
      { label: "5 welcome email credits", included: true },
      { label: "Lead scoring and Digital Health Scores", included: true },
      { label: "3 shareable audit reports per month", included: true },
      { label: "Every search filter and quick preset", included: true },
      { label: "CSV export", included: true, note: "First 25 rows" },
      { label: "Cached reruns and filter refinements stay free", included: true },
      { label: "Bulk ZIP search", included: false },
      { label: "New-business alert emails", included: false },
    ],
  },
  {
    name: "Pro",
    monthlyPrice: 25,
    annualPrice: 20,
    description: "For freelancers and one-person shops landing local clients.",
    cta: "Start 7-day free trial",
    ctaHref: "/signup?plan=pro",
    popular: true,
    accentColor: "#FF4D23",
    readouts: [
      { label: "Live searches", value: "100 / mo" },
      { label: "Email credits", value: "100 / mo" },
      { label: "Saved leads", value: "1,000" },
      { label: "Seats", value: "1" },
    ],
    features: [
      { label: "Everything in Free, plus:", included: true },
      {
        label: "100 new live territory searches per month; cached reruns stay free",
        included: true,
      },
      {
        label: "100 business email credits per calendar month",
        included: true,
      },
      {
        label:
          "Full CSV, white-label PDF, and CRM push to HubSpot, Pipedrive or GoHighLevel",
        included: true,
      },
      {
        // FEATURE_MONTHLY_LIMITS.audit_reports caps Pro at 25/mo — say so.
        label: "25 shareable audit reports per month",
        included: true,
      },
      {
        label:
          "Outreach in 5 formats: cold email, proposal, WhatsApp, LinkedIn, call script",
        included: true,
      },
      {
        label: "Map view, pipeline board, and Market Gap Finder",
        included: true,
      },
      {
        label: "Bulk search up to 10 ZIP codes at once",
        included: true,
      },
      {
        label: "1,000 saved leads, 25 saved searches, and 10 active alerts",
        included: true,
      },
    ],
  },
  {
    name: "Agency",
    monthlyPrice: 50,
    annualPrice: 40,
    description: "Built for teams working several territories at once.",
    cta: "Start 7-day free trial",
    ctaHref: "/signup?plan=agency",
    popular: false,
    accentColor: "#0C2B24",
    readouts: [
      { label: "Live searches", value: "300 / mo pooled" },
      { label: "Email credits", value: "500 / mo pooled" },
      { label: "Saved leads", value: "10,000" },
      { label: "Seats", value: "5" },
    ],
    features: [
      { label: "Everything in Pro", included: true },
      { label: "300 pooled live searches and 500 pooled email credits per month", included: true },
      { label: "10,000 saved leads", included: true },
      { label: "100 shared saved searches and 50 active alerts", included: true },
      {
        label: "Team workspace with 5 total seats and shared usage",
        included: true,
      },
      { label: "Bulk search up to 25 ZIP codes at once", included: true },
      { label: "Public API access with 500 requests per day", included: true },
      { label: "Up to 3 CRM connections", included: true },
      { label: "Priority support and onboarding", included: true },
    ],
  },
];

/* ─── Pricing FAQ ───
   Mirrored verbatim into the FAQPage JSON-LD in src/app/pricing/layout.tsx.
   If you edit this copy, edit that list too or the rich result drifts from
   the page. */
const PRICING_FAQS = [
  {
    q: "Can I switch plans later?",
    a: "Yes. You can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle.",
  },
  {
    q: "How does the 7-day free trial work?",
    a: "Both Pro and Agency start with a 7-day free trial. Pro trials include 25 live searches and 20 email credits; Agency trials include 75 pooled live searches and 50 pooled email credits. Cached reruns stay free. A card is required and checkout is handled securely by Stripe, but nothing is charged during the trial. Cancel before day 7 and you pay nothing. Full plan limits apply once paid access begins.",
  },
  {
    q: "What if I only decide it is not for me after I have been charged?",
    a: "That is what the money-back guarantee covers. The trial protects you before your first payment, and the guarantee protects you after it. If you are not satisfied within 14 days of that first charge, email us and we refund it in full, no questions asked.",
  },
  {
    q: "What payment methods do you accept?",
    a: "All major credit and debit cards, processed by Stripe. Checkout is card only.",
  },
];

/* ─── Plan card ─── */
function PlanCard({
  plan,
  billing,
  onUpgrade,
  upgradingPlan,
  checkoutError,
  highlighted,
}: {
  plan: Plan;
  billing: BillingCycle;
  onUpgrade: (plan: "pro" | "agency", billing: BillingCycle) => void;
  upgradingPlan: string | null;
  /** Checkout failure for THIS plan, rendered inline beside its CTA. */
  checkoutError: string | null;
  /** ?plan= named this card — ring it and let the mount effect scroll to it. */
  highlighted: boolean;
}) {
  const price =
    billing === "annual" ? plan.annualPrice : plan.monthlyPrice;
  const annualSavings =
    billing === "annual" && plan.monthlyPrice > 0
      ? (plan.monthlyPrice - plan.annualPrice) * 12
      : 0;

  const isFree = plan.monthlyPrice === 0;
  const planKey = plan.name.toLowerCase() as "pro" | "agency";
  const isLoading = upgradingPlan === planKey;

  /* Pro is the highlighted, dark map-green tier */
  const onDark = plan.popular;

  /* CTA rendering */
  let ctaButton: React.ReactNode;

  if (isFree) {
    ctaButton = (
      <Link href={plan.ctaHref} className="mb-6 block">
        <Button className="h-11 w-full rounded-full border border-ink/25 bg-white text-sm font-semibold text-ink transition-all hover:bg-paper-2">
          {plan.cta}
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </Link>
    );
  } else {
    /* Pro and Agency are both self-serve Stripe checkouts */
    ctaButton = (
      <div className="mb-6">
        <Button
          onClick={() => onUpgrade(planKey, billing)}
          disabled={isLoading}
          className={cn(
            "h-11 w-full rounded-full text-sm font-semibold transition-all disabled:opacity-70",
            onDark
              ? // Two Oranges Rule: the darker signal fill sinks into forest
                // (2.67:1; hover signal-600 drops to 1.88:1). The bright
                // beacon holds 4.57:1 against forest with forest-900 text on
                // it at 5.29:1, and hover goes LIGHTER (#FF6A45, 5.34:1 vs
                // forest), the direction a dark surface expects.
                "bg-signal-bright text-forest-900 hover:bg-[#FF6A45]"
              : "bg-ink text-paper hover:bg-ink-soft"
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Redirecting…
            </>
          ) : (
            <>
              {plan.cta}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </>
          )}
        </Button>
        {checkoutError && (
          <p
            role="alert"
            className="mt-2 rounded-xl bg-signal-50 px-3 py-2 text-center text-xs font-medium text-signal-600"
          >
            {checkoutError}
          </p>
        )}
        <p
          className={cn(
            "mt-2 text-center text-xs",
            onDark ? "text-white/60" : "text-stone"
          )}
        >
          Card required. Cancel anytime before day 7 and you will not be
          charged.
        </p>
      </div>
    );
  }

  return (
    <div
      id={`plan-${planKey}`}
      className={cn(
        "relative flex flex-col rounded-3xl border p-7 transition-all",
        onDark
          ? "border-signal-bright bg-forest text-white signal-glow"
          : "border-sand bg-white shadow-card card-lift",
        // A CTA elsewhere named this plan (?plan=): make the card unmistakable.
        // Ring reads 3.31:1 on the white card, 3.17:1 on paper.
        highlighted &&
          "ring-2 ring-signal-bright ring-offset-2 ring-offset-paper"
      )}
    >
      {plan.popular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <Badge className="rounded-full border-0 bg-signal px-3 py-1 text-xs font-bold text-white">
            Most Popular
          </Badge>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h3 className={cn("readout mb-2", onDark ? "text-lime" : "text-signal")}>
          {plan.name}
        </h3>
        <div className="mb-2 flex items-end gap-1">
          <span
            className={cn(
              "font-display text-5xl font-extrabold tracking-tight",
              onDark ? "text-white" : "text-ink"
            )}
          >
            ${price}
          </span>
          <span
            className={cn(
              "mb-1.5 text-sm",
              onDark ? "text-white/60" : "text-stone"
            )}
          >
            /mo
          </span>
        </div>
        {annualSavings > 0 && (
          <p
            className={cn(
              "mb-2 font-mono text-xs font-semibold",
              onDark ? "text-lime" : "text-signal-600"
            )}
          >
            Save ${annualSavings}/year with annual billing
          </p>
        )}
        {billing === "annual" && plan.monthlyPrice > 0 && (
          <p
            className={cn(
              "font-mono text-xs",
              onDark ? "text-white/50" : "text-stone"
            )}
          >
            Billed annually (${plan.annualPrice * 12}/yr)
          </p>
        )}
        <p
          className={cn(
            "mt-3 text-sm leading-relaxed",
            onDark ? "text-white/70" : "text-ink-soft"
          )}
        >
          {plan.description}
        </p>
      </div>

      {/* Cross-tier readout: the same four rows on every card, in the mono
          instrument voice, so the eye can diff plans straight across.
          Values mirror PLAN_POLICY (planPolicy.ts). Hairlines follow the
          card's surface: sand on light, translucent paper on forest
          (DESIGN.md border rule). */}
      <dl
        className={cn(
          "mb-6 divide-y border-y",
          onDark ? "divide-white/12 border-white/12" : "divide-sand border-sand"
        )}
      >
        {plan.readouts.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-3 py-2"
          >
            <dt
              className={cn("readout", onDark ? "text-white/70" : "text-stone")}
            >
              {row.label}
            </dt>
            <dd
              className={cn(
                "readout text-right",
                onDark ? "text-white" : "text-ink"
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      {/* CTA */}
      {ctaButton}
      {isFree && (
        <p className="mb-4 -mt-4 text-center text-xs text-stone">
          No credit card required
        </p>
      )}

      {/* Divider */}
      <div
        className={cn(
          "mb-5 border-t",
          onDark ? "border-white/12" : "border-sand"
        )}
      />

      {/* Features */}
      <ul className="flex-1 space-y-3">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2.5">
            {f.included ? (
              <Check
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  onDark ? "text-lime" : "text-signal"
                )}
              />
            ) : (
              <X
                className={cn(
                  // this glyph is the only VISUAL "not included" marker
                  // (screen readers get the sr-only prefix below), so it
                  // needs the 3:1 non-text minimum. sand measured 1.30:1 on
                  // the white card — invisible; stone is 5.59:1. white/60 on
                  // forest is 6.32:1.
                  "mt-0.5 h-4 w-4 shrink-0",
                  onDark ? "text-white/60" : "text-stone"
                )}
              />
            )}
            <span
              className={cn(
                "text-sm",
                f.included
                  ? onDark
                    ? "text-white/90"
                    : "text-ink-soft"
                  : onDark
                    ? // the label of a feature you do NOT get is still
                      // content: /70 measures 8.06:1 on forest, still clearly
                      // quieter than included rows' /90 (12.51:1)
                      "text-white/70"
                    : "text-stone"
              )}
            >
              {!f.included && <span className="sr-only">Not included: </span>}
              {f.label}
              {f.note && (
                <span
                  className={cn(
                    "ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
                    onDark
                      ? "bg-white/10 text-white/70"
                      : "bg-paper-2 text-stone"
                  )}
                >
                  {f.note}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Payment banner (uses useSearchParams — must be inside Suspense) ─── */
function PaymentBanner() {
  // Next captured the search params at navigation time, so this banner keeps
  // rendering even after the URL bar is cleaned. The cleanup itself lives in
  // PricingPage's mount effect, AFTER ?plan= and ?billing= have been read —
  // this component used to delete ?plan= unread.
  const searchParams = useSearchParams();
  const paymentStatus = searchParams.get("payment");

  if (paymentStatus === "success") {
    return (
      <div className="mb-8 rounded-2xl border border-forest/20 bg-lime/20 p-4 text-center font-medium text-forest">
        Payment successful! Welcome to LeadZipp — your plan is active.
      </div>
    );
  }
  if (paymentStatus === "cancelled") {
    return (
      <div className="mb-8 rounded-2xl border border-signal/25 bg-signal-50 p-4 text-center text-signal-600">
        Payment canceled. You can upgrade anytime from the pricing page.
      </div>
    );
  }
  return null;
}

/* ─── Main pricing page ─── */
export default function PricingPage() {
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null);
  const [highlightedPlan, setHighlightedPlan] = useState<"pro" | "agency" | null>(
    null
  );
  const [checkoutError, setCheckoutError] = useState<{
    plan: "pro" | "agency";
    message: string;
  } | null>(null);

  useEffect(() => {
    // Read ?plan= and ?billing= BEFORE cleaning the URL. Pricing links can
    // name a plan (marketing pages, the signup round trip): honor the choice
    // by lighting up that card and matching the billing toggle. Reading
    // window.location keeps the page body out of a Suspense boundary; a
    // checkout return (?payment=...) is not a preselection, so it only shows
    // the banner.
    const params = new URLSearchParams(window.location.search);
    const plan = params.get("plan");
    if (!params.has("payment") && (plan === "pro" || plan === "agency")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHighlightedPlan(plan);
      if (params.get("billing") === "annual") setBilling("annual");
      document.getElementById(`plan-${plan}`)?.scrollIntoView({
        block: "center",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    }
    // URL cleanup, moved from PaymentBanner (which deleted ?plan= unread).
    if (["payment", "plan", "billing"].some((key) => params.has(key))) {
      const url = new URL(window.location.href);
      url.searchParams.delete("payment");
      url.searchParams.delete("plan");
      url.searchParams.delete("billing");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  async function handleUpgrade(plan: "pro" | "agency", billingCycle: BillingCycle) {
    setUpgradingPlan(plan)
    setCheckoutError(null)
    try {
      // Visitors who claimed the 15%-off welcome offer carry a flag in
      // localStorage; pass it so checkout auto-applies the coupon.
      const promo =
        typeof window !== "undefined" &&
        window.localStorage.getItem("leadzipp_promo15") === "1"
      // Fired before the redirect so the push lands while the page is alive.
      track("checkout_started", { plan, billing: billingCycle, promo })
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billing: billingCycle, promo }),
      })
      if (res.status === 401) {
        // No account yet. /login?redirectTo=/pricing would drop the choice
        // they just made; the signup page already reads ?plan= and ?billing=,
        // preselects the trial, and hands straight off to Stripe checkout
        // once the account exists — so send the choice along.
        const qs = new URLSearchParams({ plan })
        if (billingCycle === "annual") qs.set("billing", "annual")
        window.location.href = `/signup?${qs.toString()}`
        return
      }
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else if (data.error) {
        setCheckoutError({
          plan,
          message:
            typeof data.error === "string"
              ? data.error
              : "Something went wrong. Please try again.",
        })
      }
    } catch {
      setCheckoutError({
        plan,
        message: "Something went wrong. Please try again.",
      })
    } finally {
      setUpgradingPlan(null)
    }
  }

  return (
    <div className="grain relative flex min-h-screen flex-col bg-paper text-ink">
      <SiteHeader />

      <main id="main-content">
      {/* ── Header ── */}
      <section className="map-grid relative border-b border-sand bg-paper-2 py-16 lg:pb-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <span className="readout mb-5 inline-flex items-center gap-2 rounded-full border border-sand bg-white px-3 py-1.5 text-signal">
            <Zap className="h-3 w-3" />
            Transparent pricing
          </span>
          <h1 className="mb-4 font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
            Simple plans that scale with you
          </h1>
          <p className="mb-8 text-lg text-ink-soft">
            Start free with no credit card. Upgrade only when you need more.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center rounded-full border border-sand bg-white p-1">
            <button
              onClick={() => setBilling("monthly")}
              aria-pressed={billing === "monthly"}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-semibold transition-all",
                billing === "monthly"
                  ? "bg-ink text-paper"
                  : "text-ink-soft hover:text-ink"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("annual")}
              aria-pressed={billing === "annual"}
              className={cn(
                "flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all",
                billing === "annual"
                  ? "bg-ink text-paper"
                  : "text-ink-soft hover:text-ink"
              )}
            >
              Annual
              <span className="rounded-full bg-lime px-2 py-0.5 font-mono text-xs font-bold text-forest">
                Save 20%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Plan cards ── */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="sr-only">Plans</h2>
          {/* Payment status banners */}
          <Suspense fallback={null}>
            <PaymentBanner />
          </Suspense>

          <div className="grid items-start gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <PlanCard
                key={plan.name}
                plan={plan}
                billing={billing}
                onUpgrade={handleUpgrade}
                upgradingPlan={upgradingPlan}
                checkoutError={
                  checkoutError &&
                  checkoutError.plan === plan.name.toLowerCase()
                    ? checkoutError.message
                    : null
                }
                highlighted={highlightedPlan === plan.name.toLowerCase()}
              />
            ))}
          </div>

          {/* Two safety nets, in the order you meet them. The trial is the
              before-you-pay one, the guarantee is the after-you-pay one, so
              they read as a sequence instead of two competing offers. */}
          <div className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-sand bg-white p-5 shadow-card">
              <p className="readout mb-2 flex items-center gap-1.5 text-signal">
                <Clock className="h-3 w-3" />
                Before you pay
              </p>
              <p className="text-sm font-semibold text-ink">7-day free trial</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                Pro and Agency open with 7 days on every feature, with a
                starter allowance: 25 live searches and 20 email credits on
                Pro, 75 pooled searches and 50 pooled credits on Agency. We
                take your card at signup and charge nothing until day 7.
                Cancel before then and you pay nothing at all.
              </p>
            </div>
            <div className="rounded-2xl border border-sand bg-white p-5 shadow-card">
              <p className="readout mb-2 flex items-center gap-1.5 text-signal">
                <Shield className="h-3 w-3" />
                After you pay
              </p>
              <p className="text-sm font-semibold text-ink">
                14-day money-back guarantee
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                Once the trial ends and the first charge lands, you still have
                14 days to change your mind. Email us and we refund it in full.
              </p>
            </div>
          </div>

          {/* Stripe powered note */}
          <div className="mx-auto mt-4 flex max-w-xl items-center justify-center gap-2 rounded-2xl border border-sand bg-white px-6 py-4 shadow-card">
            <CreditCard className="h-4 w-4 shrink-0 text-signal" />
            <p className="text-sm text-ink-soft">
              <span className="font-semibold text-ink">
                Payments powered by Stripe.
              </span>{" "}
              Secure checkout. Cancel anytime.
            </p>
          </div>
        </div>
      </section>

      {/* ── Trust bar ── */}
      <section className="border-y border-sand bg-paper-2 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-ink-soft">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-signal" />
              <span>Public data sources only</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-signal" />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-signal" />
              <span>14-day refund after your first charge</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-signal" />
              <span>No credit card for free plan</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-16">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <span className="readout text-signal">Questions</span>
            <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink">
              Pricing FAQ
            </h2>
          </div>
          <div className="space-y-4">
            {PRICING_FAQS.map((faq, i) => (
              <div
                key={i}
                className="rounded-2xl border border-sand bg-white p-5 shadow-card"
              >
                <h3 className="mb-2 flex items-baseline gap-2.5 text-sm font-semibold text-ink">
                  <span className="font-mono text-xs font-bold text-signal">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {faq.q}
                </h3>
                <p className="pl-7 text-sm leading-relaxed text-ink-soft">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="topo relative overflow-hidden py-16 text-white">
        <div className="grain absolute inset-0 opacity-40" />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-4 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Start finding leads today
          </h2>
          <p className="mb-7 text-white/70">
            Sign up free. No credit card, no commitment.
          </p>
          <Link href="/signup">
            {/* Same dark-surface CTA treatment as the Pro card (Two Oranges
                Rule): signal was 2.67:1 against the topo forest. */}
            <Button className="h-12 rounded-full bg-signal-bright px-8 text-base font-semibold text-forest-900 transition-all hover:bg-[#FF6A45]">
              Get Started Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
      </main>

      <SiteFooter />
    </div>
  );
}
