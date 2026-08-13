import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Check } from "lucide-react";

// Auth pages (login, signup, forgot/reset password) must never rank in
// search. They stay crawlable in robots.txt so Google can see this tag.
export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

const BRAND_BULLETS = [
  "Search any ZIP by category and radius",
  "Every lead scored 0–100 automatically",
  "Real phones, websites & owner emails",
  "Export to CSV or straight into your CRM",
];

// Live-data readouts (honest capability tiles, not invented vanity numbers)
const READOUTS = [
  { value: "Live", label: "Google + Yelp data" },
  { value: "0–100", label: "Opportunity scoring" },
  { value: "CSV", label: "+ CRM export" },
];

// The LeadZipp mark: orange pin tile + lime "live" dot. Ringed in forest so the
// dot reads cleanly on the dark brand panel.
function BrandMark() {
  return (
    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-signal">
      <MapPin className="h-4.5 w-4.5 text-white" aria-hidden="true" />
      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-lime ring-2 ring-forest" />
    </span>
  );
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-paper">
      {/* ── Left brand panel (desktop only) ── */}
      <aside
        aria-label="About LeadZipp"
        className="relative hidden shrink-0 flex-col justify-between overflow-hidden bg-forest px-10 py-10 lg:flex lg:w-[480px] xl:w-[540px] xl:px-14"
      >
        {/* Map-grid texture */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(203,242,63,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(203,242,63,0.05) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        {/* Warm signal glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-signal/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 right-0 h-64 w-64 rounded-full bg-lime/10 blur-3xl"
        />

        {/* Logo */}
        <Link href="/" className="relative z-10 flex w-fit items-center gap-2.5">
          <BrandMark />
          <span className="font-display text-xl font-extrabold tracking-tight text-white">
            LeadZipp
          </span>
        </Link>

        {/* Center content */}
        <div className="relative z-10">
          <p className="mb-5 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-lime">
            Local lead intelligence
          </p>
          <h2 className="mb-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-white xl:text-[2.75rem]">
            Drop a pin.
            <br />
            Fill your <span className="text-lime">pipeline.</span>
          </h2>
          <p className="mb-8 max-w-sm text-base leading-relaxed text-white/70">
            LeadZipp turns any ZIP code into a scored list of real local
            businesses, built from live Google and Yelp data. Spend your time
            on outreach, not research.
          </p>

          <ul className="space-y-3">
            {BRAND_BULLETS.map((bullet) => (
              <li key={bullet} className="flex items-center gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime/15">
                  <Check className="h-3.5 w-3.5 text-lime" strokeWidth={3} />
                </span>
                <span className="text-sm text-white/85">{bullet}</span>
              </li>
            ))}
          </ul>

          {/* Live-data readouts */}
          <div className="mt-10 grid grid-cols-3 gap-4 border-t border-white/10 pt-8">
            {READOUTS.map((r) => (
              <div key={r.label}>
                <p className="font-mono text-xl font-bold tracking-tight text-white">
                  {r.value}
                </p>
                <p className="mt-1 text-xs leading-snug text-white/45">
                  {r.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-xs text-white/40">
          &copy; {new Date().getFullYear()} LeadZipp &nbsp;·&nbsp;{" "}
          <Link href="/privacy" className="transition-colors hover:text-white/70">
            Privacy
          </Link>
          &nbsp;·&nbsp;
          <Link href="/terms" className="transition-colors hover:text-white/70">
            Terms
          </Link>
        </p>
      </aside>

      {/* ── Right form panel ── */}
      <main className="flex flex-1 flex-col items-center justify-center bg-paper px-4 py-12 sm:px-8">
        {/* Mobile logo */}
        <Link href="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-signal">
            <MapPin className="h-4 w-4 text-white" aria-hidden="true" />
            <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-lime ring-2 ring-paper" />
          </span>
          <span className="font-display text-lg font-extrabold tracking-tight text-ink">
            LeadZipp
          </span>
        </Link>

        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
