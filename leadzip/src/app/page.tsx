import Link from "next/link";
import {
  MapPin,
  Search,
  Star,
  Download,
  CheckCircle,
  ArrowRight,
  Zap,
  Users,
  Building2,
  TrendingUp,
  Globe,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/layout/Navbar";
import FAQSection from "@/components/landing/FAQSection"
import { HeroSearchWidget } from "@/components/landing/HeroSearchWidget";

export const metadata = {
  title: "LeadZip — Find Local Business Leads by ZIP Code | Free Lead Generation Tool",
  description:
    "Search 35+ business categories by ZIP code and radius. Get lead scores, contact info, and export to CSV. Free plan available — no credit card required.",
  keywords: [
    "lead generation",
    "local business leads",
    "ZIP code leads",
    "B2B prospecting",
    "web design leads",
    "marketing agency leads",
    "find local businesses",
  ],
  alternates: { canonical: "https://leadzip.vercel.app" },
  openGraph: {
    title: "LeadZip — Find Local Business Leads by ZIP Code",
    description: "Search 35+ business categories by ZIP code and radius. Get lead scores, export to CSV.",
    images: [{ url: "https://leadzip.vercel.app/og", width: 1200, height: 630 }],
  },
};

/* ─── Fake lead card data for hero visual ─── */
const FAKE_LEADS = [
  {
    name: "Silverton Roofing Co.",
    category: "Roofing",
    rating: 4.7,
    reviews: 63,
    score: 87,
    distance: "1.2 mi",
    hasWeb: true,
    hasPhone: true,
  },
  {
    name: "Clearview Window Cleaning",
    category: "Cleaning Services",
    rating: 4.2,
    reviews: 31,
    score: 72,
    distance: "2.7 mi",
    hasWeb: false,
    hasPhone: true,
  },
  {
    name: "Peak HVAC Solutions",
    category: "HVAC Services",
    rating: 4.9,
    reviews: 118,
    score: 94,
    distance: "3.1 mi",
    hasWeb: true,
    hasPhone: true,
  },
];

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 85
      ? "bg-emerald-100 text-emerald-700"
      : score >= 65
      ? "bg-amber-100 text-amber-700"
      : "bg-red-100 text-red-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${color}`}
    >
      {score}
    </span>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
      <span className="text-xs font-semibold text-[#475569]">{rating}</span>
    </span>
  );
}

function HeroVisual() {
  return (
    <div className="relative w-full max-w-lg">
      {/* Search bar mockup */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-card-hover p-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3">
            <MapPin className="h-4 w-4 text-[#0369A1] shrink-0" />
            <span className="text-sm text-[#0F172A] font-medium">78701</span>
          </div>
          <div className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3">
            <Building2 className="h-4 w-4 text-[#94A3B8] shrink-0" />
            <span className="text-sm text-[#94A3B8]">Roofing</span>
          </div>
          <button className="flex h-9 items-center gap-1.5 rounded-lg bg-[#0369A1] px-3 text-xs font-semibold text-white shrink-0">
            <Search className="h-3.5 w-3.5" />
            Search
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-[#94A3B8]">Radius:</span>
          {["5 mi", "10 mi", "25 mi"].map((r, i) => (
            <span
              key={r}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium cursor-default ${
                i === 1
                  ? "bg-[#0369A1] text-white"
                  : "bg-[#F1F5F9] text-[#64748B]"
              }`}
            >
              {r}
            </span>
          ))}
        </div>
      </div>

      {/* Lead cards */}
      <div className="space-y-2.5">
        {FAKE_LEADS.map((lead, i) => (
          <div
            key={i}
            className="rounded-xl border border-[#E2E8F0] bg-white shadow-card p-3 flex items-center gap-3"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F0F9FF] text-[#0369A1]">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-semibold text-[#0F172A] truncate">
                  {lead.name}
                </span>
                <ScoreBadge score={lead.score} />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-[#94A3B8]">{lead.category}</span>
                <span className="text-[#E2E8F0]">·</span>
                <StarRating rating={lead.rating} />
                <span className="text-xs text-[#94A3B8]">({lead.reviews})</span>
                <span className="text-[#E2E8F0]">·</span>
                <span className="text-xs text-[#94A3B8]">{lead.distance}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                {lead.hasWeb && (
                  <span className="flex items-center gap-0.5 text-xs text-emerald-600">
                    <Globe className="h-3 w-3" /> Website
                  </span>
                )}
                {lead.hasPhone && (
                  <span className="flex items-center gap-0.5 text-xs text-emerald-600">
                    <Phone className="h-3 w-3" /> Phone
                  </span>
                )}
              </div>
            </div>
            <button className="shrink-0 rounded-lg border border-[#E2E8F0] p-1.5 hover:bg-[#F8FAFC] transition-colors">
              <Download className="h-3.5 w-3.5 text-[#94A3B8]" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between px-1">
        <span className="text-xs text-[#94A3B8]">Showing 3 of 47 results</span>
        <span className="text-xs font-medium text-[#0369A1]">View all →</span>
      </div>

      {/* Decorative glow elements */}
      <div className="absolute -right-6 -top-6 -z-10 h-48 w-48 rounded-full bg-[#0369A1]/5 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-8 -left-8 -z-10 h-56 w-56 rounded-full bg-sky-100/60 blur-3xl pointer-events-none" />
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-card transition-all hover:shadow-card-hover hover:-translate-y-0.5 group">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#F0F9FF] transition-colors group-hover:bg-[#0369A1]">
        <Icon className="h-5 w-5 text-[#0369A1] group-hover:text-white transition-colors" />
      </div>
      <h3 className="mb-2 text-base font-semibold text-[#0F172A]">{title}</h3>
      <p className="text-sm leading-relaxed text-[#64748B]">{description}</p>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
  isLast,
}: {
  number: number;
  title: string;
  description: string;
  isLast?: boolean;
}) {
  return (
    <div className="relative flex gap-4">
      <div className="flex flex-col items-center">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0369A1] text-sm font-bold text-white shadow-sm z-10">
          {number}
        </div>
        {!isLast && (
          <div className="mt-2 h-full w-px bg-gradient-to-b from-[#0369A1]/40 to-transparent min-h-12" />
        )}
      </div>
      <div className="pb-8">
        <h3 className="mb-1.5 text-base font-semibold text-[#0F172A]">{title}</h3>
        <p className="text-sm leading-relaxed text-[#64748B]">{description}</p>
      </div>
    </div>
  );
}

function UseCaseCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-card hover:border-[#0369A1]/30 hover:shadow-card-hover transition-all">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#F0F9FF]">
        <Icon className="h-5 w-5 text-[#0369A1]" />
      </div>
      <h3 className="mb-1.5 text-sm font-semibold text-[#0F172A]">{title}</h3>
      <p className="text-xs leading-relaxed text-[#64748B]">{description}</p>
    </div>
  );
}

function PricingPreviewCard({
  name,
  price,
  description,
  popular,
}: {
  name: string;
  price: string;
  description: string;
  popular?: boolean;
}) {
  return (
    <div
      className={`relative rounded-xl border p-5 shadow-card transition-shadow hover:shadow-card-hover ${
        popular
          ? "border-[#0369A1] bg-[#F0F9FF]"
          : "border-[#E2E8F0] bg-white"
      }`}
    >
      {popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#0369A1] px-3 py-0.5 text-xs font-bold text-white whitespace-nowrap">
          Most Popular
        </span>
      )}
      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#94A3B8]">
        {name}
      </p>
      <p className="mb-2 text-2xl font-extrabold text-[#0F172A]">{price}</p>
      <p className="text-xs text-[#64748B]">{description}</p>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "LeadZip",
              url: "https://leadzip.vercel.app",
              logo: "https://leadzip.vercel.app/og",
              description:
                "B2B lead generation platform for finding local businesses by ZIP code",
              contactPoint: {
                "@type": "ContactPoint",
                email: "hello@leadzip.com",
                contactType: "customer support",
              },
            },
            {
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "LeadZip",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              description:
                "Find local business leads by ZIP code, industry, and radius. Lead scoring, CSV export, and CRM features.",
              offers: [
                { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
                {
                  "@type": "Offer",
                  name: "Pro",
                  price: "49",
                  priceCurrency: "USD",
                  billingIncrement: "month",
                },
                {
                  "@type": "Offer",
                  name: "Agency",
                  price: "99",
                  priceCurrency: "USD",
                  billingIncrement: "month",
                },
              ],
              url: "https://leadzip.vercel.app",
            },
            {
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: [
                {
                  "@type": "Question",
                  name: "What data sources does LeadZip use?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "LeadZip uses compliant public business data sources including approved APIs. All data comes from publicly available business listings.",
                  },
                },
                {
                  "@type": "Question",
                  name: "How is the lead score calculated?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Lead scores (0-100) are calculated based on phone number availability, website presence, Google rating, review count, and distance from your target ZIP code.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Can I export leads to CSV?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Yes, Pro and Agency plan users can export saved leads to CSV format including all contact info, scores, status, and notes.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Is there a free plan?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Yes, the free plan includes 10 searches per month and up to 25 saved leads with no credit card required.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Is LeadZip compliant with privacy laws?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "LeadZip uses only approved public data sources. Users are responsible for ensuring their outreach complies with CAN-SPAM, GDPR, and applicable privacy regulations.",
                  },
                },
              ],
            },
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "LeadZip",
              url: "https://leadzip.vercel.app",
            },
          ]),
        }}
      />
      <Navbar />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-white pt-16 pb-20 lg:pt-24 lg:pb-28">
        <div className="absolute inset-0 bg-grid-pattern opacity-40 [mask-image:radial-gradient(ellipse_at_center,white_30%,transparent_80%)]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-64 w-[600px] bg-gradient-to-b from-[#0369A1]/8 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-14 lg:flex-row lg:items-center lg:gap-12">
            {/* Left: copy */}
            <div className="flex-1 text-center lg:text-left">
              <Badge
                variant="blue"
                className="mb-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
              >
                <Zap className="h-3 w-3" />
                Lead generation, simplified
              </Badge>

              <h1 className="mb-5 text-4xl font-extrabold leading-tight tracking-tight text-[#0F172A] sm:text-5xl lg:text-[3.25rem]">
                Find Local Business
                <br />
                <span className="text-[#0369A1]">Leads by ZIP Code</span>
              </h1>

              <p className="mb-8 max-w-xl text-lg leading-relaxed text-[#475569] mx-auto lg:mx-0">
                Search by location, industry, and radius. Find businesses that need your services.
                Export and outreach&nbsp;— all in one place.
              </p>

              {/* Mobile: inline search widget */}
              <div className="sm:hidden w-full max-w-sm">
                <HeroSearchWidget />
              </div>

              {/* Tablet+: original CTA buttons */}
              <div className="hidden sm:flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start">
                <Link href="/signup">
                  <Button className="h-12 rounded-xl bg-[#0369A1] px-7 text-base font-semibold text-white hover:bg-[#0284C7] shadow-sm transition-all hover:shadow-md hover:-translate-y-px">
                    Start Searching Free
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="#demo">
                  <Button
                    variant="outline"
                    className="h-12 rounded-xl border-[#E2E8F0] px-7 text-base font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
                  >
                    View Demo
                  </Button>
                </Link>
              </div>

              <div className="mt-8 flex items-center gap-4 justify-center lg:justify-start">
                <div className="flex -space-x-2">
                  {[
                    "bg-blue-400",
                    "bg-teal-400",
                    "bg-violet-400",
                    "bg-amber-400",
                  ].map((c, i) => (
                    <div
                      key={i}
                      className={`h-7 w-7 rounded-full border-2 border-white ${c}`}
                    />
                  ))}
                </div>
                <p className="text-sm text-[#64748B]">
                  <span className="font-semibold text-[#0F172A]">2,400+</span>{" "}
                  businesses found this week
                </p>
              </div>
            </div>

            {/* Right: visual */}
            <div id="demo" className="flex-1 flex justify-center lg:justify-end">
              <HeroVisual />
            </div>
          </div>
        </div>
      </section>

      {/* ── Social proof strip ── */}
      <section className="border-y border-[#E2E8F0] bg-[#F8FAFC] py-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm text-[#94A3B8]">
            {[
              "Web Design Agencies",
              "Marketing Firms",
              "Sales Teams",
              "Local Service Pros",
              "B2B Consultants",
            ].map((label) => (
              <span
                key={label}
                className="flex items-center gap-2 font-medium"
              >
                <CheckCircle className="h-3.5 w-3.5 text-[#0369A1]" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-20 bg-[#F8FAFC]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-[#0369A1]">
              Features
            </p>
            <h2 className="text-3xl font-extrabold text-[#0F172A] sm:text-4xl">
              Everything you need to find leads
            </h2>
            <p className="mt-3 text-base text-[#64748B] max-w-xl mx-auto">
              A complete toolkit for discovering, scoring, and reaching out to
              local businesses.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={MapPin}
              title="Search by ZIP & Radius"
              description="Enter any ZIP code, set your radius, and instantly find local businesses in your target area."
            />
            <FeatureCard
              icon={Star}
              title="Smart Lead Scoring"
              description="Every lead is scored 0-100 based on online presence, ratings, reviews, and distance from your target area."
            />
            <FeatureCard
              icon={Download}
              title="Export & Outreach"
              description="Save leads, add CRM notes, track status, and export to CSV for your outreach campaigns."
            />
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-16 items-start">
            <div className="lg:w-2/5 lg:sticky lg:top-24">
              <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-[#0369A1]">
                How It Works
              </p>
              <h2 className="text-3xl font-extrabold text-[#0F172A] sm:text-4xl mb-4">
                Three steps to your next client
              </h2>
              <p className="text-base text-[#64748B] leading-relaxed mb-6">
                LeadZip cuts through the noise. No complicated setup, no data
                wrangling — just targeted local leads in minutes.
              </p>
              <Link href="/signup">
                <Button className="h-10 rounded-xl bg-[#0369A1] px-5 text-sm font-semibold text-white hover:bg-[#0284C7]">
                  Try it free
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="lg:w-3/5">
              <StepCard
                number={1}
                title="Enter ZIP Code & Category"
                description="Type any U.S. ZIP code, choose your target business category (or enter a custom keyword), and pick your search radius from 5 to 50 miles."
              />
              <StepCard
                number={2}
                title="Review Scored Leads"
                description="Browse a ranked list of matching businesses. Each lead shows a 0-100 score, star rating, review count, website presence, and distance from your target."
              />
              <StepCard
                number={3}
                title="Save & Export"
                description="Bookmark leads, add private notes, update outreach status, and export your list to CSV for use in your CRM or email outreach tool."
                isLast
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Use Cases ── */}
      <section className="py-20 bg-[#F8FAFC]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-[#0369A1]">
              Use Cases
            </p>
            <h2 className="text-3xl font-extrabold text-[#0F172A] sm:text-4xl">
              Built for teams that sell locally
            </h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <UseCaseCard
              icon={Building2}
              title="Web Design Agencies"
              description="Find local businesses with outdated or no websites and pitch your services directly."
            />
            <UseCaseCard
              icon={TrendingUp}
              title="Marketing Agencies"
              description="Identify underserved local businesses that need digital marketing, SEO, or ad management."
            />
            <UseCaseCard
              icon={Users}
              title="Sales Teams"
              description="Give your reps pre-qualified, scored leads so they can focus on conversations, not research."
            />
            <UseCaseCard
              icon={MapPin}
              title="Local Service Providers"
              description="Find complementary businesses in your area to build referral partnerships and grow together."
            />
          </div>
        </div>
      </section>

      {/* ── Pricing Preview ── */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-[#0369A1]">
              Pricing
            </p>
            <h2 className="text-3xl font-extrabold text-[#0F172A] sm:text-4xl mb-3">
              Simple, transparent pricing
            </h2>
            <p className="text-base text-[#64748B]">
              Start free. Upgrade when you&apos;re ready to grow.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-3 max-w-3xl mx-auto mb-8">
            <PricingPreviewCard
              name="Free"
              price="$0/mo"
              description="10 searches, 25 saved leads, basic scoring."
            />
            <PricingPreviewCard
              name="Pro"
              price="$49/mo"
              description="Unlimited searches, CSV export, notes & status."
              popular
            />
            <PricingPreviewCard
              name="Agency"
              price="$99/mo"
              description="Unlimited everything, advanced filters, priority support."
            />
          </div>

          <div className="text-center">
            <Link href="/pricing">
              <Button
                variant="outline"
                className="h-10 rounded-xl border-[#E2E8F0] px-6 text-sm font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
              >
                View Full Pricing
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 bg-[#F8FAFC]">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-[#0369A1]">
              FAQ
            </p>
            <h2 className="text-3xl font-extrabold text-[#0F172A] sm:text-4xl">
              Questions answered
            </h2>
          </div>
          <FAQSection />
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="bg-[#0F172A] py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="mb-4 text-3xl font-extrabold text-white sm:text-4xl">
            Ready to find your next client?
          </h2>
          <p className="mb-8 text-lg text-[#94A3B8] max-w-xl mx-auto">
            Join thousands of agencies and sales teams who use LeadZip to fill
            their pipeline with warm local leads every week.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/signup">
              <Button className="h-12 rounded-xl bg-[#0369A1] px-8 text-base font-semibold text-white hover:bg-[#0284C7] shadow-lg hover:shadow-xl transition-all hover:-translate-y-px">
                Start Searching Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button
                variant="outline"
                className="h-12 rounded-xl border-white/20 px-8 text-base font-semibold text-white hover:bg-white/10 bg-transparent"
              >
                View Pricing
              </Button>
            </Link>
          </div>
          <p className="mt-5 text-sm text-[#475569]">
            No credit card required. Free plan available.
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
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
                { label: "Features", href: "#features" },
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
              LeadZip uses approved public data sources. Users are responsible
              for outreach compliance with CAN-SPAM, GDPR, and applicable
              privacy laws. &copy; {new Date().getFullYear()} LeadZip. All
              rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
