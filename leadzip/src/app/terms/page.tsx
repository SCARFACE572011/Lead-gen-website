import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";
import Navbar from "@/components/layout/Navbar";

// The root layout's title template appends "| LeadZipp".
export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Read the terms and conditions governing your use of LeadZipp.",
  alternates: { canonical: "https://leadzipp.com/terms" },
  openGraph: {
    title: "Terms of Service | LeadZipp",
    description: "Read the terms and conditions governing your use of LeadZipp.",
    url: "https://leadzipp.com/terms",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Terms of Service | LeadZipp",
    description: "Read the terms and conditions governing your use of LeadZipp.",
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

export default function TermsPage() {
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
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink mb-3">Terms of Service</h1>
            <p className="text-stone text-sm">
              Effective date: <span className="font-medium text-ink">May 12, 2025</span>
            </p>
            <p className="mt-4 text-ink-soft leading-relaxed">
              Please read these Terms of Service (&ldquo;Terms&rdquo;) carefully before using LeadZipp.
              By creating an account or using the service, you agree to be bound by these Terms.
              If you do not agree, do not use LeadZipp.
            </p>
          </div>

          {/* Sections */}
          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using LeadZipp (&ldquo;the Service&rdquo;) operated by LeadZipp
              (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;), you confirm that you are at
              least 18 years old, have the legal authority to enter into this agreement, and agree to
              comply with these Terms and all applicable laws and regulations.
            </p>
          </Section>

          <Section title="2. Description of Service">
            <p>
              LeadZipp is a B2B lead generation platform that allows users to:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>Search for local businesses by ZIP code, category, and radius.</li>
              <li>View lead scores calculated based on publicly available business data signals.</li>
              <li>Save leads, add private notes, and track outreach status.</li>
              <li>Export saved leads to CSV format (paid plans).</li>
            </ul>
            <p className="mt-3">
              The Service uses publicly available business data. We do not guarantee the completeness,
              accuracy, or timeliness of the data returned in search results.
            </p>
          </Section>

          <Section title="3. User Accounts">
            <p>
              You must register for an account to access most features. You are responsible for:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>Providing accurate and complete registration information.</li>
              <li>Maintaining the confidentiality of your login credentials.</li>
              <li>
                All activity that occurs under your account, whether or not authorized by you.
              </li>
            </ul>
            <p className="mt-3">
              You must notify us immediately at{" "}
              <a href="mailto:hello@leadzipp.com" className="text-signal underline underline-offset-2 hover:text-signal-600">
                hello@leadzipp.com
              </a>{" "}
              if you suspect unauthorized access to your account. We reserve the right to suspend
              or terminate accounts that violate these Terms.
            </p>
          </Section>

          <Section title="4. Acceptable Use">
            <p>You agree not to use LeadZipp to:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>
                Send unsolicited bulk messages (spam) to businesses found through the Service.
              </li>
              <li>
                Scrape, copy, or republish data from the platform in violation of these Terms or
                applicable laws.
              </li>
              <li>
                Violate any applicable law, including CAN-SPAM, GDPR, CCPA, or other privacy and
                anti-spam regulations.
              </li>
              <li>
                Harass, threaten, or harm any individual or business found through the Service.
              </li>
              <li>
                Attempt to reverse engineer, modify, or create derivative works from the platform.
              </li>
              <li>
                Use automated bots, scrapers, or scripts to access the Service without our express
                written consent.
              </li>
              <li>
                Share your account credentials with others or allow multiple users to access
                the Service under a single account (unless you hold an Agency plan with multi-seat
                provisions).
              </li>
            </ul>
            <p className="mt-3">
              You are solely responsible for ensuring that your outreach to businesses complies with
              all applicable laws, including CAN-SPAM and GDPR. LeadZipp provides data access tools;
              your use of that data is your legal responsibility.
            </p>
          </Section>

          <Section title="5. Subscription Plans & Billing">
            <p>LeadZipp offers the following subscription tiers:</p>
            <div className="mt-3 overflow-hidden rounded-2xl border border-sand">
              <table className="w-full text-sm">
                <thead className="bg-paper-2">
                  <tr>
                    <th className="readout px-4 py-3 text-left text-stone">Plan</th>
                    <th className="readout px-4 py-3 text-left text-stone">Price</th>
                    <th className="readout px-4 py-3 text-left text-stone">Key Limits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand">
                  <tr>
                    <td className="px-4 py-3 font-medium text-ink">Free</td>
                    <td className="px-4 py-3 font-mono text-ink-soft">$0 / month</td>
                    <td className="px-4 py-3 text-ink-soft">25 searches/mo, 25 saved leads</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-ink">Pro</td>
                    <td className="px-4 py-3 font-mono text-ink-soft">$25 / month</td>
                    <td className="px-4 py-3 text-ink-soft">100 live searches, 100 email credits, full CSV export</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-ink">Agency</td>
                    <td className="px-4 py-3 font-mono text-ink-soft">$50 / month</td>
                    <td className="px-4 py-3 text-ink-soft">300 pooled live searches, 500 pooled email credits, 5 seats</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4">
              Billing is processed by <span className="font-medium text-ink">Stripe</span>.
              By providing payment information, you authorize us to charge your payment method on a
              recurring monthly basis until you cancel.
            </p>
            <p>
              <span className="font-medium text-ink">Cancellation:</span> You may cancel your
              subscription at any time from your account settings or by emailing us. Cancellation takes
              effect at the end of your current billing period; you retain access until then.
            </p>
            <p>
              <span className="font-medium text-ink">Refunds:</span> We do not offer refunds for
              partial billing periods. If you believe you were charged in error, contact us at{" "}
              <a href="mailto:hello@leadzipp.com" className="text-signal underline underline-offset-2 hover:text-signal-600">
                hello@leadzipp.com
              </a>{" "}
              within 7 days of the charge.
            </p>
            <p>
              We reserve the right to change pricing with 30 days&rsquo; advance notice to your
              registered email address. Continued use after the notice period constitutes acceptance
              of the new pricing.
            </p>
          </Section>

          <Section title="6. Data & Privacy">
            <p>
              Your use of the Service is also governed by our{" "}
              <Link href="/privacy" className="text-signal underline underline-offset-2 hover:text-signal-600">
                Privacy Policy
              </Link>
              , which is incorporated into these Terms by reference. By using LeadZipp, you consent
              to the data practices described in our Privacy Policy.
            </p>
          </Section>

          <Section title="7. Intellectual Property">
            <p>
              <span className="font-medium text-ink">LeadZipp platform:</span> All rights, title,
              and interest in the LeadZipp platform — including the software, design, branding, and
              underlying technology — are owned exclusively by LeadZipp. You may not copy, distribute,
              or create derivative works from our platform without express written permission.
            </p>
            <p>
              <span className="font-medium text-ink">Your exported data:</span> You retain full
              ownership of any lead lists you export via CSV. We claim no rights over data you export
              from your account.
            </p>
          </Section>

          <Section title="8. Disclaimers">
            <p>
              The Service is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis
              without warranties of any kind, express or implied, including but not limited to warranties
              of merchantability, fitness for a particular purpose, or non-infringement.
            </p>
            <p>
              <span className="font-medium text-ink">Data accuracy:</span> Business data returned
              in search results is sourced from public APIs and may be incomplete, outdated, or
              inaccurate. We make no guarantees about the accuracy of lead information.
            </p>
            <p>
              <span className="font-medium text-ink">Outreach compliance:</span> You are solely
              responsible for ensuring that your outreach to businesses complies with CAN-SPAM, GDPR,
              CCPA, and all other applicable laws. LeadZipp is not liable for any legal issues arising
              from your outreach activities.
            </p>
          </Section>

          <Section title="9. Limitation of Liability">
            <p>
              To the maximum extent permitted by applicable law, LeadZipp shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages, including but not
              limited to loss of profits, data, goodwill, or business opportunities, arising from or
              related to your use of the Service — even if we have been advised of the possibility of
              such damages.
            </p>
            <p>
              Our total aggregate liability to you for any claim arising from these Terms or your use
              of the Service shall not exceed the greater of (a) the amount you paid to LeadZipp in
              the three months preceding the claim, or (b) $100 USD.
            </p>
          </Section>

          <Section title="10. Governing Law">
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the
              applicable jurisdiction, without regard to its conflict of law provisions.
              Any disputes arising under these Terms shall be resolved through binding arbitration
              or in the courts of the applicable jurisdiction, and you consent to personal
              jurisdiction in such courts.
            </p>
          </Section>

          <Section title="11. Changes to Terms">
            <p>
              We reserve the right to update these Terms at any time. When we do, we will update the
              effective date and, for material changes, notify you via email or an in-app notice.
              Your continued use of the Service after notice of changes constitutes acceptance of the
              updated Terms. If you do not agree with updated Terms, you must stop using the Service
              and may cancel your subscription.
            </p>
          </Section>

          <Section title="12. Contact Us">
            <p>
              If you have questions about these Terms, please contact us:
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
