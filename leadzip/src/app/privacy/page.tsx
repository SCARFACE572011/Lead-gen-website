import Link from "next/link";
import { MapPin, Zap } from "lucide-react";
import Navbar from "@/components/layout/Navbar";

export const metadata = {
  title: "Privacy Policy | LeadZip",
  description: "Learn how LeadZip collects, uses, and protects your personal information.",
  alternates: { canonical: "https://leadzip.vercel.app/privacy" },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-8 border-b border-slate-100 last:border-none">
      <h2 className="text-xl font-bold text-[#0F172A] mb-4">{title}</h2>
      <div className="space-y-3 text-[#475569] leading-relaxed text-[15px]">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Navbar />

      <main className="flex-1 pt-24 pb-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-10">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#0369A1] mb-2">
              Legal
            </p>
            <h1 className="text-4xl font-extrabold text-[#0F172A] mb-3">Privacy Policy</h1>
            <p className="text-[#64748B] text-sm">
              Effective date: <span className="font-medium text-[#0F172A]">May 12, 2025</span>
            </p>
            <p className="mt-4 text-[#475569] leading-relaxed">
              LeadZip (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is committed to protecting your
              privacy. This Privacy Policy explains what information we collect, how we use it, and
              the choices you have. By using LeadZip, you agree to the practices described in this policy.
            </p>
          </div>

          {/* Sections */}
          <Section title="1. Information We Collect">
            <p>We collect information you provide directly and information generated through your use of the service:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>
                <span className="font-medium text-[#0F172A]">Account information:</span> Your name and email
                address when you register for an account.
              </li>
              <li>
                <span className="font-medium text-[#0F172A]">Search queries:</span> ZIP codes, business
                categories, and radius settings you enter while using the search feature.
              </li>
              <li>
                <span className="font-medium text-[#0F172A]">Saved leads and notes:</span> Leads you bookmark,
                status updates, and private notes you add within the platform.
              </li>
              <li>
                <span className="font-medium text-[#0F172A]">Usage data:</span> Pages visited, features used,
                timestamps, browser type, device type, and IP address.
              </li>
              <li>
                <span className="font-medium text-[#0F172A]">Payment information:</span> When you upgrade to a
                paid plan, billing is handled by Stripe. We do not store your full card number; only a payment
                token and the last four digits of your card are retained.
              </li>
            </ul>
          </Section>

          <Section title="2. How We Use Your Information">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Create and manage your account and authenticate your sessions.</li>
              <li>Provide, maintain, and improve the LeadZip service.</li>
              <li>Process subscription payments and send billing receipts via Stripe.</li>
              <li>Send transactional emails (password resets, account notifications). We do not send marketing emails without your explicit consent.</li>
              <li>Analyze aggregate usage patterns to improve features and performance.</li>
              <li>Detect, investigate, and prevent fraud or abuse.</li>
              <li>Comply with legal obligations.</li>
            </ul>
          </Section>

          <Section title="3. Data Storage & Security">
            <p>
              Your data is stored in <span className="font-medium text-[#0F172A]">Supabase</span>, a secure
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
                <span className="font-medium text-[#0F172A]">Supabase</span> — Database hosting and
                authentication. Data is stored in Supabase-managed infrastructure.{" "}
                <a
                  href="https://supabase.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0369A1] underline underline-offset-2"
                >
                  Supabase Privacy Policy
                </a>
              </li>
              <li>
                <span className="font-medium text-[#0F172A]">Stripe</span> — Payment processing. Stripe
                is PCI-DSS compliant and handles all card data securely.{" "}
                <a
                  href="https://stripe.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0369A1] underline underline-offset-2"
                >
                  Stripe Privacy Policy
                </a>
              </li>
              <li>
                <span className="font-medium text-[#0F172A]">Google Analytics (GA4)</span> — Anonymous
                usage analytics to help us understand how the product is used. Data is anonymized
                and not linked to your account.{" "}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0369A1] underline underline-offset-2"
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
                <span className="font-medium text-[#0F172A]">Access or correction:</span> Log into your
                account settings or email us at{" "}
                <a href="mailto:hello@leadzip.com" className="text-[#0369A1] underline underline-offset-2">
                  hello@leadzip.com
                </a>
                .
              </li>
              <li>
                <span className="font-medium text-[#0F172A]">Account deletion:</span> Email us at{" "}
                <a href="mailto:hello@leadzip.com" className="text-[#0369A1] underline underline-offset-2">
                  hello@leadzip.com
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
            <p>LeadZip uses a minimal set of cookies:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>
                <span className="font-medium text-[#0F172A]">Session cookies:</span> Required for
                authentication. These are set by Supabase and expire when you close your browser or
                after a period of inactivity.
              </li>
              <li>
                <span className="font-medium text-[#0F172A]">Analytics cookies:</span> Set by Google
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
              LeadZip is not intended for children under the age of 13. We do not knowingly collect
              personal information from children under 13. If you believe a child has provided us with
              personal information, please contact us at{" "}
              <a href="mailto:hello@leadzip.com" className="text-[#0369A1] underline underline-offset-2">
                hello@leadzip.com
              </a>{" "}
              and we will promptly delete it.
            </p>
          </Section>

          <Section title="8. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. When we do, we will update the
              effective date at the top of this page and, for material changes, notify you by email or
              by displaying a notice within the app. Continued use of LeadZip after any changes
              constitutes your acceptance of the updated policy.
            </p>
          </Section>

          <Section title="9. Contact Us">
            <p>
              If you have questions or concerns about this Privacy Policy or our data practices,
              please contact us:
            </p>
            <div className="mt-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <p className="font-semibold text-[#0F172A]">LeadZip</p>
              <p className="mt-1">
                Email:{" "}
                <a href="mailto:hello@leadzip.com" className="text-[#0369A1] underline underline-offset-2">
                  hello@leadzip.com
                </a>
              </p>
              <p className="mt-0.5">Website: leadzip.vercel.app</p>
            </div>
          </Section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1E293B] bg-[#0F172A] py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0369A1]">
                <Zap className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-base font-extrabold text-white">
                Lead<span className="text-[#0EA5E9]">Zip</span>
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
                  className="text-sm text-[#64748B] hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="mt-6 border-t border-[#1E293B] pt-6">
            <p className="text-center text-xs leading-relaxed text-[#475569]">
              &copy; {new Date().getFullYear()} LeadZip. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
