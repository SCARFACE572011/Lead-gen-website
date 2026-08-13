import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";
import Navbar from "@/components/layout/Navbar";

// The root layout's title template appends "| LeadZipp".
export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Learn how LeadZipp collects, uses, and protects your personal information.",
  alternates: { canonical: "https://leadzipp.com/privacy" },
  openGraph: {
    title: "Privacy Policy | LeadZipp",
    description: "Learn how LeadZipp collects, uses, and protects your personal information.",
    url: "https://leadzipp.com/privacy",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Privacy Policy | LeadZipp",
    description: "Learn how LeadZipp collects, uses, and protects your personal information.",
  },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const match = title.match(/^(\d+)\.\s*(.*)$/);
  const num = match ? match[1].padStart(2, "0") : null;
  const heading = match ? match[2] : title;
  return (
    <section className="py-8 border-b border-sand last:border-none">
      <h2 className="mb-4 flex items-baseline gap-3 font-display text-xl font-bold tracking-tight text-ink">
        {num && <span className="font-mono text-sm font-bold text-signal">{num}</span>}
        <span>{heading}</span>
      </h2>
      <div className="space-y-3 text-ink-soft leading-relaxed text-[15px]">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="grain relative flex flex-col min-h-screen bg-paper text-ink">
      <Navbar />

      <main className="flex-1 pt-28 pb-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-10">
            <p className="readout text-signal mb-2">
              Legal
            </p>
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink mb-3">Privacy Policy</h1>
            <p className="text-stone text-sm">
              Effective date: <span className="font-medium text-ink">May 12, 2025</span>
            </p>
            <p className="mt-4 text-ink-soft leading-relaxed">
              LeadZipp (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is committed to protecting your
              privacy. This Privacy Policy explains what information we collect, how we use it, and
              the choices you have. By using LeadZipp, you agree to the practices described in this policy.
            </p>
          </div>

          {/* Sections */}
          <Section title="1. Information We Collect">
            <p>We collect information you provide directly and information generated through your use of the service:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>
                <span className="font-medium text-ink">Account information:</span> Your name and email
                address when you register for an account.
              </li>
              <li>
                <span className="font-medium text-ink">Search queries:</span> ZIP codes, business
                categories, and radius settings you enter while using the search feature.
              </li>
              <li>
                <span className="font-medium text-ink">Saved leads and notes:</span> Leads you bookmark,
                status updates, and private notes you add within the platform.
              </li>
              <li>
                <span className="font-medium text-ink">Usage data:</span> Pages visited, features used,
                timestamps, browser type, device type, and IP address.
              </li>
              <li>
                <span className="font-medium text-ink">Payment information:</span> When you upgrade to a
                paid plan, billing is handled by Stripe. We do not store your full card number; only a payment
                token and the last four digits of your card are retained.
              </li>
            </ul>
          </Section>

          <Section title="2. How We Use Your Information">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Create and manage your account and authenticate your sessions.</li>
              <li>Provide, maintain, and improve the LeadZipp service.</li>
              <li>Process subscription payments and send billing receipts via Stripe.</li>
              <li>Send transactional emails (password resets, account notifications). We do not send marketing emails without your explicit consent.</li>
              <li>Analyze aggregate usage patterns to improve features and performance.</li>
              <li>Detect, investigate, and prevent fraud or abuse.</li>
              <li>Comply with legal obligations.</li>
            </ul>
          </Section>

          <Section title="3. Data Storage & Security">
            <p>
              Your data is stored in <span className="font-medium text-ink">Supabase</span>, a secure
              cloud database platform. All data is encrypted at rest and in transit using industry-standard TLS.
              We use Supabase Row Level Security (RLS) to ensure you can only access your own data.
            </p>
            <p>
              While we take reasonable precautions to protect your information, no security measure is
              100% foolproof. We encourage you to use a strong, unique password for your account.
            </p>
          </Section>

          <Section title="4. Third-Party Services">
            <p>We work with a limited set of trusted third-party services:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>
                <span className="font-medium text-ink">Supabase</span> — Database hosting and
                authentication. Data is stored in Supabase-managed infrastructure.{" "}
                <a
                  href="https://supabase.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-signal underline underline-offset-2 hover:text-signal-600"
                >
                  Supabase Privacy Policy
                </a>
              </li>
              <li>
                <span className="font-medium text-ink">Stripe</span> — Payment processing. Stripe
                is PCI-DSS compliant and handles all card data securely.{" "}
                <a
                  href="https://stripe.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-signal underline underline-offset-2 hover:text-signal-600"
                >
                  Stripe Privacy Policy
                </a>
              </li>
              <li>
                <span className="font-medium text-ink">Google Analytics (GA4)</span> — Anonymous
                usage analytics to help us understand how the product is used. Data is anonymized
                and not linked to your account.{" "}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-signal underline underline-offset-2 hover:text-signal-600"
                >
                  Google Privacy Policy
                </a>
              </li>
            </ul>
            <p className="mt-3">
              We do not sell your personal information to third parties and we never will.
            </p>
          </Section>

          <Section title="5. Your Rights">
            <p>
              You have the right to access, correct, or delete your personal information at any time.
              To exercise these rights:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>
                <span className="font-medium text-ink">Access or correction:</span> Log into your
                account settings or email us at{" "}
                <a href="mailto:hello@leadzipp.com" className="text-signal underline underline-offset-2 hover:text-signal-600">
                  hello@leadzipp.com
                </a>
                .
              </li>
              <li>
                <span className="font-medium text-ink">Account deletion:</span> Email us at{" "}
                <a href="mailto:hello@leadzipp.com" className="text-signal underline underline-offset-2 hover:text-signal-600">
                  hello@leadzipp.com
                </a>{" "}
                with the subject &ldquo;Delete My Account&rdquo; and we will permanently delete your data
                within 30 days.
              </li>
            </ul>
            <p className="mt-3">
              If you are located in the European Economic Area (EEA), you may have additional rights under
              the General Data Protection Regulation (GDPR), including the right to data portability
              and the right to lodge a complaint with your local supervisory authority.
            </p>
          </Section>

          <Section title="6. Cookies">
            <p>LeadZipp uses a minimal set of cookies:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>
                <span className="font-medium text-ink">Session cookies:</span> Required for
                authentication. These are set by Supabase and expire when you close your browser or
                after a period of inactivity.
              </li>
              <li>
                <span className="font-medium text-ink">Analytics cookies:</span> Set by Google
                Analytics (GA4) to track anonymous usage metrics. You can opt out using browser
                settings or a GA4 opt-out browser add-on.
              </li>
            </ul>
            <p className="mt-3">
              We do not use advertising cookies or sell cookie data to third parties.
            </p>
          </Section>

          <Section title="7. Children's Privacy">
            <p>
              LeadZipp is not intended for children under the age of 13. We do not knowingly collect
              personal information from children under 13. If you believe a child has provided us with
              personal information, please contact us at{" "}
              <a href="mailto:hello@leadzipp.com" className="text-signal underline underline-offset-2 hover:text-signal-600">
                hello@leadzipp.com
              </a>{" "}
              and we will promptly delete it.
            </p>
          </Section>

          <Section title="8. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. When we do, we will update the
              effective date at the top of this page and, for material changes, notify you by email or
              by displaying a notice within the app. Continued use of LeadZipp after any changes
              constitutes your acceptance of the updated policy.
            </p>
          </Section>

          <Section title="9. Contact Us">
            <p>
              If you have questions or concerns about this Privacy Policy or our data practices,
              please contact us:
            </p>
            <div className="mt-3 rounded-2xl border border-sand bg-paper-2 p-4">
              <p className="font-semibold text-ink">LeadZipp</p>
              <p className="mt-1">
                Email:{" "}
                <a href="mailto:hello@leadzipp.com" className="text-signal underline underline-offset-2 hover:text-signal-600">
                  hello@leadzipp.com
                </a>
              </p>
              <p className="mt-0.5">Website: leadzipp.com</p>
            </div>
          </Section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-forest-900 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-signal">
                <MapPin className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-display text-base font-extrabold text-white">
                LeadZipp
              </span>
            </Link>
            <nav className="flex flex-wrap items-center justify-center gap-5">
              {[
                { label: "Home", href: "/" },
                { label: "Pricing", href: "/pricing" },
                { label: "Login", href: "/login" },
                { label: "Privacy", href: "/privacy" },
                { label: "Terms", href: "/terms" },
              ].map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-sm text-white/60 hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="mt-6 border-t border-white/10 pt-6">
            <p className="text-center text-xs leading-relaxed text-white/50">
              &copy; {new Date().getFullYear()} LeadZipp. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
