import Link from "next/link";
import { Zap } from "lucide-react";
import Navbar from "@/components/layout/Navbar";

export const metadata = {
  title: "Terms of Service | LeadZip",
  description: "Read the terms and conditions governing your use of LeadZip.",
  alternates: { canonical: "https://leadzip.vercel.app/terms" },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-8 border-b border-slate-100 last:border-none">
      <h2 className="text-xl font-bold text-[#0F172A] mb-4">{title}</h2>
      <div className="space-y-3 text-[#475569] leading-relaxed text-[15px]">{children}</div>
    </section>
  );
}

export default function TermsPage() {
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
            <h1 className="text-4xl font-extrabold text-[#0F172A] mb-3">Terms of Service</h1>
            <p className="text-[#64748B] text-sm">
              Effective date: <span className="font-medium text-[#0F172A]">May 12, 2025</span>
            </p>
            <p className="mt-4 text-[#475569] leading-relaxed">
              Please read these Terms of Service (&ldquo;Terms&rdquo;) carefully before using LeadZip.
              By creating an account or using the service, you agree to be bound by these Terms.
              If you do not agree, do not use LeadZip.
            </p>
          </div>

          {/* Sections */}
          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using LeadZip (&ldquo;the Service&rdquo;) operated by LeadZip
              (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;), you confirm that you are at
              least 18 years old, have the legal authority to enter into this agreement, and agree to
              comply with these Terms and all applicable laws and regulations.
            </p>
          </Section>

          <Section title="2. Description of Service">
            <p>
              LeadZip is a B2B lead generation platform that allows users to:
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
              <a href="mailto:hello@leadzip.com" className="text-[#0369A1] underline underline-offset-2">
                hello@leadzip.com
              </a>{" "}
              if you suspect unauthorized access to your account. We reserve the right to suspend
              or terminate accounts that violate these Terms.
            </p>
          </Section>

          <Section title="4. Acceptable Use">
            <p>You agree not to use LeadZip to:</p>
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
              all applicable laws, including CAN-SPAM and GDPR. LeadZip provides data access tools;
              your use of that data is your legal responsibility.
            </p>
          </Section>

          <Section title="5. Subscription Plans & Billing">
            <p>LeadZip offers the following subscription tiers:</p>
            <div className="mt-3 rounded-xl border border-[#E2E8F0] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#F8FAFC]">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-[#0F172A]">Plan</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#0F172A]">Price</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#0F172A]">Key Limits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  <tr>
                    <td className="px-4 py-3 font-medium text-[#0F172A]">Free</td>
                    <td className="px-4 py-3 text-[#475569]">$0 / month</td>
                    <td className="px-4 py-3 text-[#475569]">10 searches/mo, 25 saved leads</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-[#0F172A]">Pro</td>
                    <td className="px-4 py-3 text-[#475569]">$49 / month</td>
                    <td className="px-4 py-3 text-[#475569]">Unlimited searches, CSV export, notes</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-[#0F172A]">Agency</td>
                    <td className="px-4 py-3 text-[#475569]">$99 / month</td>
                    <td className="px-4 py-3 text-[#475569]">Unlimited everything, advanced filters</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4">
              Billing is processed by <span className="font-medium text-[#0F172A]">Stripe</span>.
              By providing payment information, you authorize us to charge your payment method on a
              recurring monthly basis until you cancel.
            </p>
            <p>
              <span className="font-medium text-[#0F172A]">Cancellation:</span> You may cancel your
              subscription at any time from your account settings or by emailing us. Cancellation takes
              effect at the end of your current billing period; you retain access until then.
            </p>
            <p>
              <span className="font-medium text-[#0F172A]">Refunds:</span> We do not offer refunds for
              partial billing periods. If you believe you were charged in error, contact us at{" "}
              <a href="mailto:hello@leadzip.com" className="text-[#0369A1] underline underline-offset-2">
                hello@leadzip.com
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
              <Link href="/privacy" className="text-[#0369A1] underline underline-offset-2">
                Privacy Policy
              </Link>
              , which is incorporated into these Terms by reference. By using LeadZip, you consent
              to the data practices described in our Privacy Policy.
            </p>
          </Section>

          <Section title="7. Intellectual Property">
            <p>
              <span className="font-medium text-[#0F172A]">LeadZip platform:</span> All rights, title,
              and interest in the LeadZip platform — including the software, design, branding, and
              underlying technology — are owned exclusively by LeadZip. You may not copy, distribute,
              or create derivative works from our platform without express written permission.
            </p>
            <p>
              <span className="font-medium text-[#0F172A]">Your exported data:</span> You retain full
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
              <span className="font-medium text-[#0F172A]">Data accuracy:</span> Business data returned
              in search results is sourced from public APIs and may be incomplete, outdated, or
              inaccurate. We make no guarantees about the accuracy of lead information.
            </p>
            <p>
              <span className="font-medium text-[#0F172A]">Outreach compliance:</span> You are solely
              responsible for ensuring that your outreach to businesses complies with CAN-SPAM, GDPR,
              CCPA, and all other applicable laws. LeadZip is not liable for any legal issues arising
              from your outreach activities.
            </p>
          </Section>

          <Section title="9. Limitation of Liability">
            <p>
              To the maximum extent permitted by applicable law, LeadZip shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages, including but not
              limited to loss of profits, data, goodwill, or business opportunities, arising from or
              related to your use of the Service — even if we have been advised of the possibility of
              such damages.
            </p>
            <p>
              Our total aggregate liability to you for any claim arising from these Terms or your use
              of the Service shall not exceed the greater of (a) the amount you paid to LeadZip in
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
