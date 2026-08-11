import Link from "next/link";
import { Zap, CheckCircle } from "lucide-react";

const BRAND_BULLETS = [
  "Search by ZIP, category, and radius",
  "Leads scored 0-100 automatically",
  "Export to CSV — integrate with any CRM",
  "Track outreach status per lead",
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* ── Left brand panel (desktop only) ── */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] shrink-0 flex-col justify-between bg-[#0F172A] px-10 py-10 xl:px-14">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group w-fit">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0369A1] shadow-sm transition-transform group-hover:scale-105">
            <Zap className="h-4.5 w-4.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-xl font-extrabold text-white">
            Lead<span className="text-[#0EA5E9]">Zip</span>
          </span>
        </Link>

        {/* Center content */}
        <div>
          <p className="mb-6 text-xs font-semibold uppercase tracking-widest text-[#0369A1]">
            Local Lead Intelligence
          </p>
          <h2 className="mb-5 text-3xl font-extrabold leading-snug text-white xl:text-4xl">
            Find local leads.
            <br />
            Close more clients.
          </h2>
          <p className="mb-8 text-base leading-relaxed text-[#94A3B8]">
            LeadZipp surfaces scored, ranked local businesses so your team can
            focus on outreach — not research.
          </p>

          <ul className="space-y-3">
            {BRAND_BULLETS.map((bullet) => (
              <li key={bullet} className="flex items-center gap-3">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0369A1]/20">
                  <CheckCircle className="h-3.5 w-3.5 text-[#0EA5E9]" />
                </div>
                <span className="text-sm text-[#CBD5E1]">{bullet}</span>
              </li>
            ))}
          </ul>

          {/* Fake stats */}
          <div className="mt-10 grid grid-cols-3 gap-4 border-t border-[#1E293B] pt-8">
            {[
              { label: "Businesses indexed", value: "500K+" },
              { label: "Leads exported", value: "12K+" },
              { label: "Avg lead score", value: "74 / 100" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-xl font-extrabold text-white">{stat.value}</p>
                <p className="mt-0.5 text-xs text-[#64748B]">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-[#334155]">
          &copy; {new Date().getFullYear()} LeadZipp &nbsp;·&nbsp;{" "}
          <Link href="/privacy" className="hover:text-[#64748B] transition-colors">
            Privacy
          </Link>
          &nbsp;·&nbsp;
          <Link href="/terms" className="hover:text-[#64748B] transition-colors">
            Terms
          </Link>
        </p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-4 py-12 sm:px-8">
        {/* Mobile logo */}
        <Link
          href="/"
          className="mb-8 flex items-center gap-2 lg:hidden"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0369A1]">
            <Zap className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-extrabold text-[#0F172A]">
            Lead<span className="text-[#0369A1]">Zip</span>
          </span>
        </Link>

        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
