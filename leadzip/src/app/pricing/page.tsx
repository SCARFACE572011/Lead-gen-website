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
  CreditCard,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/layout/Navbar";
import { cn } from "@/lib/utils";

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
  features: PlanFeature[];
  accentColor: string;
}

/* ─── Plan data ─── */
const PLANS: Plan[] = [
  {
    name: "Free",
    monthlyPrice: 0,
    annualPrice: 0,
    description: "Perfect for exploring LeadZip before committing.",
    cta: "Get Started Free",
    ctaHref: "/signup",
    popular: false,
    accentColor: "#64748B",
    features: [
      { label: "10 searches per month", included: true },
      { label: "25 saved leads", included: true },
      { label: "Basic lead scoring (0-100)", included: true },
      { label: "Lead details & contact info", included: true },
      { label: "CSV export", included: false },
      { label: "Search history", included: false },
      { label: "Lead notes & status tracking", included: false },
      { label: "Priority email support", included: false },
      { label: "Advanced filters", included: false },
      { label: "Team workspace", included: false, note: "Coming soon" },
    ],
  },
  {
    name: "Pro",
    monthlyPrice: 49,
    annualPrice: 39,
    description: "For agencies and sales teams ready to grow their pipeline.",
    cta: "Start Pro Trial",
    ctaHref: "/signup?plan=pro",
    popular: true,
    accentColor: "#0369A1",
    features: [
      { label: "Unlimited searches", included: true },
      { label: "1,000 saved leads", included: true },
      { label: "Advanced lead scoring", included: true },
      { label: "Lead details & contact info", included: true },
      { label: "CSV export", included: true },
      { label: "Search history", included: true },
      { label: "Lead notes & status tracking", included: true },
      { label: "Priority email support", included: true },
      { label: "Advanced filters", included: false },
      { label: "Team workspace", included: false, note: "Coming soon" },
    ],
  },
  {
    name: "Agency",
    monthlyPrice: 99,
    annualPrice: 79,
    description: "Built for scaling agencies with high-volume lead needs.",
    cta: "Contact Sales",
    ctaHref: "mailto:hello@leadzip.com",
    popular: false,
    accentColor: "#0F172A",
    features: [
      { label: "Unlimited searches", included: true },
      { label: "Unlimited saved leads", included: true },
      { label: "Advanced lead scoring", included: true },
      { label: "Lead details & contact info", included: true },
      { label: "CSV export", included: true },
      { label: "Search history", included: true },
      { label: "Lead notes & status tracking", included: true },
      { label: "Priority support + onboarding", included: true },
      { label: "Advanced filters", included: true },
      {
        label: "Team workspace",
        included: true,
        note: "Coming soon",
      },
    ],
  },
];

/* ─── Pricing FAQ ─── */
const PRICING_FAQS = [
  {
    q: "Can I switch plans later?",
    a: "Yes. You can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle.",
  },
  {
    q: "Is there a free trial for paid plans?",
    a: "The Pro plan comes with a 14-day free trial. No credit card required to start — you'll be prompted to add payment details at the end of the trial.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major credit and debit cards via Stripe. ACH transfers are available for Agency annual plans.",
  },
  {
    q: "Do you offer refunds?",
    a: "If you're not satisfied within the first 14 days of a paid plan, contact us and we'll issue a full refund, no questions asked.",
  },
];

/* ─── Plan card ─── */
function PlanCard({
  plan,
  billing,
  onUpgrade,
  upgradingPlan,
}: {
  plan: Plan;
  billing: BillingCycle;
  onUpgrade: (plan: "pro" | "agency", billing: BillingCycle) => void;
  upgradingPlan: string | null;
}) {
  const price =
    billing === "annual" ? plan.annualPrice : plan.monthlyPrice;
  const annualSavings =
    billing === "annual" && plan.monthlyPrice > 0
      ? (plan.monthlyPrice - plan.annualPrice) * 12
      : 0;

  const isFree = plan.monthlyPrice === 0;
  const isAgency = plan.name === "Agency";
  const isPro = plan.name === "Pro";
  const planKey = plan.name.toLowerCase() as "pro" | "agency";
  const isLoading = upgradingPlan === planKey;

  /* CTA rendering */
  let ctaButton: React.ReactNode

  if (isFree) {
    ctaButton = (
      <Link href="/signup" className="mb-6 block">
        <Button
          className="w-full h-10 rounded-xl text-sm font-semibold transition-all border border-[#E2E8F0] bg-white text-[#0F172A] hover:bg-[#F8FAFC]"
        >
          {plan.cta}
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </Link>
    )
  } else if (isAgency) {
    ctaButton = (
      <a href="mailto:hello@leadzip.com" className="mb-6 block">
        <Button
          className="w-full h-10 rounded-xl text-sm font-semibold transition-all border border-[#E2E8F0] bg-white text-[#0F172A] hover:bg-[#F8FAFC]"
        >
          {plan.cta}
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </a>
    )
  } else if (isPro) {
    ctaButton = (
      <div className="mb-6">
        <Button
          onClick={() => onUpgrade(planKey, billing)}
          disabled={isLoading}
          className="w-full h-10 rounded-xl text-sm font-semibold transition-all bg-[#0369A1] text-white hover:bg-[#0284C7] disabled:opacity-70"
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
      </div>
    )
  } else {
    ctaButton = null
  }

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border p-7 transition-shadow hover:shadow-card-hover",
        plan.popular
          ? "border-[#0369A1] bg-[#F0F9FF] shadow-card"
          : "border-[#E2E8F0] bg-white shadow-card"
      )}
    >
      {plan.popular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <Badge className="rounded-full bg-[#0369A1] px-3 py-1 text-xs font-bold text-white border-0">
            Most Popular
          </Badge>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#94A3B8]">
          {plan.name}
        </p>
        <div className="flex items-end gap-1 mb-2">
          <span className="text-4xl font-extrabold text-[#0F172A]">
            ${price}
          </span>
          <span className="mb-1.5 text-sm text-[#94A3B8]">/mo</span>
        </div>
        {annualSavings > 0 && (
          <p className="mb-2 text-xs font-semibold text-emerald-600">
            Save ${annualSavings}/year with annual billing
          </p>
        )}
        {billing === "annual" && plan.monthlyPrice > 0 && (
          <p className="text-xs text-[#94A3B8]">
            Billed annually (${plan.annualPrice * 12}/yr)
          </p>
        )}
        <p className="mt-3 text-sm text-[#64748B] leading-relaxed">
          {plan.description}
        </p>
      </div>

      {/* CTA */}
      {ctaButton}
      {isFree && (
        <p className="mb-4 -mt-4 text-center text-xs text-[#94A3B8]">
          No credit card required
        </p>
      )}

      {/* Divider */}
      <div className="mb-5 border-t border-[#E2E8F0]" />

      {/* Features */}
      <ul className="space-y-3 flex-1">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2.5">
            {f.included ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            ) : (
              <X className="mt-0.5 h-4 w-4 shrink-0 text-[#CBD5E1]" />
            )}
            <span
              className={cn(
                "text-sm",
                f.included ? "text-[#374151]" : "text-[#94A3B8]"
              )}
            >
              {f.label}
              {f.note && (
                <span className="ml-1.5 rounded-full bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-semibold text-[#64748B]">
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
  const searchParams = useSearchParams();
  const paymentStatus = searchParams.get("payment");

  useEffect(() => {
    if (paymentStatus) {
      const url = new URL(window.location.href);
      url.searchParams.delete("payment");
      url.searchParams.delete("plan");
      window.history.replaceState({}, "", url.toString());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (paymentStatus === "success") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center text-green-700 font-medium mb-8">
        Payment successful! Your plan has been upgraded. Welcome to LeadZip Pro.
      </div>
    );
  }
  if (paymentStatus === "cancelled") {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center text-yellow-700 mb-8">
        Payment cancelled. You can upgrade anytime from the pricing page.
      </div>
    );
  }
  return null;
}

/* ─── Main pricing page ─── */
export default function PricingPage() {
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null);


  async function handleUpgrade(plan: "pro" | "agency", billingCycle: BillingCycle) {
    setUpgradingPlan(plan)
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billing: billingCycle }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else if (data.error) {
        alert(data.error)
      }
    } catch {
      alert("Something went wrong. Please try again.")
    } finally {
      setUpgradingPlan(null)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      <Navbar />

      {/* ── Header ── */}
      <section className="bg-white border-b border-[#E2E8F0] py-16 lg:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <Badge
            variant="blue"
            className="mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
          >
            <Zap className="h-3 w-3" />
            Transparent pricing
          </Badge>
          <h1 className="mb-4 text-4xl font-extrabold text-[#0F172A] sm:text-5xl">
            Simple plans that scale with you
          </h1>
          <p className="mb-8 text-lg text-[#64748B]">
            Start free with no credit card. Upgrade only when you need more.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-1">
            <button
              onClick={() => setBilling("monthly")}
              className={cn(
                "rounded-lg px-5 py-2 text-sm font-semibold transition-all",
                billing === "monthly"
                  ? "bg-white text-[#0F172A] shadow-sm"
                  : "text-[#64748B] hover:text-[#0F172A]"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("annual")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition-all",
                billing === "annual"
                  ? "bg-white text-[#0F172A] shadow-sm"
                  : "text-[#64748B] hover:text-[#0F172A]"
              )}
            >
              Annual
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                Save 20%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Plan cards ── */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Payment status banners */}
          <Suspense fallback={null}>
            <PaymentBanner />
          </Suspense>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 items-start">
            {PLANS.map((plan) => (
              <PlanCard
                key={plan.name}
                plan={plan}
                billing={billing}
                onUpgrade={handleUpgrade}
                upgradingPlan={upgradingPlan}
              />
            ))}
          </div>

          {/* Stripe powered note */}
          <div className="mt-8 flex items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-6 py-4 shadow-card max-w-xl mx-auto">
            <CreditCard className="h-4 w-4 text-[#0369A1] shrink-0" />
            <p className="text-sm text-[#64748B]">
              <span className="font-semibold text-[#0F172A]">
                Payments powered by Stripe.
              </span>{" "}
              Secure checkout. Cancel anytime.
            </p>
          </div>
        </div>
      </section>

      {/* ── Trust bar ── */}
      <section className="border-y border-[#E2E8F0] bg-white py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-[#64748B]">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#0369A1]" />
              <span>Public data sources only</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-500" />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-500" />
              <span>14-day money-back guarantee</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-500" />
              <span>No credit card for free plan</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-16 bg-[#F8FAFC]">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-center text-2xl font-extrabold text-[#0F172A]">
            Pricing FAQ
          </h2>
          <div className="space-y-4">
            {PRICING_FAQS.map((faq, i) => (
              <div
                key={i}
                className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-card"
              >
                <p className="mb-2 text-sm font-semibold text-[#0F172A]">
                  {faq.q}
                </p>
                <p className="text-sm leading-relaxed text-[#64748B]">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-[#0F172A] py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="mb-4 text-3xl font-extrabold text-white">
            Start finding leads today
          </h2>
          <p className="mb-7 text-[#94A3B8]">
            Sign up free — no credit card, no commitment.
          </p>
          <Link href="/signup">
            <Button className="h-12 rounded-xl bg-[#0369A1] px-8 text-base font-semibold text-white hover:bg-[#0284C7]">
              Get Started Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer mini */}
      <footer className="border-t border-[#1E293B] bg-[#0F172A] py-6">
        <p className="text-center text-xs text-[#475569]">
          &copy; {new Date().getFullYear()} LeadZip. All rights reserved.
          &nbsp;·&nbsp;
          <Link href="/privacy" className="hover:text-[#94A3B8] transition-colors">
            Privacy
          </Link>
          &nbsp;·&nbsp;
          <Link href="/terms" className="hover:text-[#94A3B8] transition-colors">
            Terms
          </Link>
        </p>
      </footer>
    </div>
  );
}
