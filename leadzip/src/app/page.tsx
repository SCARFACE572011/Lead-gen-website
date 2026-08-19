import Link from 'next/link'
import Image from 'next/image'
import {
  MapPin, ArrowRight, Search, Star, Check, Sparkles, Mail, FileText,
} from 'lucide-react'
import { HeroSearchWidget } from '@/components/landing/HeroSearchWidget'
import { HeroMap } from '@/components/landing/HeroMap'
import { Reveal } from '@/components/landing/Reveal'
import FaqSchema from '@/components/seo/FaqSchema'
import SoftwareApplicationSchema from '@/components/seo/SoftwareApplicationSchema'
import { SiteHeader, SiteFooter } from '@/components/marketing/MarketingChrome'

/* Impeccable direction contract — emitted into the built HTML via the hidden
   node below so the finish review can audit the render against it. */
const DIRECTION_CONTRACT = `<!--
IMPECCABLE CONTRACT (seed c01765b9 · surface: landing page · mode: persuade)
THESIS: The homepage is one working morning in a territory, told as a
surveyor's log. The visitor watches the day where the product earns its $25
instead of reading a feature grid. Refuses: hero + icon-card-grid + generic
pricing-row scaffold.
OWN-WORLD: The Field Map - warm paper and ink, deep forest topo bands, signal
orange on light / beacon bright on dark, rare lime, Bricolage display, Hanken
body, mono readout instrument voice, dot-grid armature, dashed route line with
beacon pins.
STORY: An agency owner follows the route: drop a pin 07:02, scored block
07:04, decision-maker email 07:09, pitch with audit attached 07:15, the block
mapped 07:31, day-7 verdict, what the route costs, field notes, your turn.
FIRST VIEWPORT: unchanged radar hero - H1 and search widget left, live-scan
panel right; the log route begins immediately below the trades marquee.
FORM: Expedition Log, candidate 3 of 7, seed key c01765b9.
FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance.
-->`

const TRADES = [
  'Plumbers', 'Dentists', 'Roofers', 'Salons', 'HVAC', 'Law Firms', 'Restaurants',
  'Contractors', 'Auto Shops', 'Realtors', 'Gyms', 'Electricians', 'Landscapers', 'Chiropractors',
]

/* Sample-scan rows: synthetic businesses, labeled as a sample wherever shown. */
const SCAN_ROWS = [
  { img: '/img/tradesman.jpg', name: 'Ironwood Electric', cat: 'Electrician', score: 97, tag: 'No website' },
  { img: '/img/storefront.jpg', name: 'Marlowe Home Goods', cat: 'Retail', score: 92, tag: 'No website' },
  { img: '/img/cafe.jpg', name: 'Poppy & Rye Café', cat: 'Restaurant', score: 89, tag: 'Thin reviews' },
  { img: '/img/dentist.jpg', name: 'Bright Ave Dental', cat: 'Dentist', score: 84, tag: 'Weak rating' },
]

const STATS = [
  { v: '42', l: 'industries covered' },
  { v: '41k+', l: 'US ZIP codes' },
  { v: 'Live', l: 'Google & Yelp data' },
  { v: '<10s', l: 'to a full lead list' },
]

// Feature lines mirror the shipped code and the full pricing page. Anything
// listed here is live today, not planned.
const PLANS = [
  { name: 'Starter', price: '$0', per: 'forever', blurb: 'Kick the tires.', feats: ['25 searches / month', 'Real business data', 'Lead scoring + health scores', 'Every search filter'], cta: 'Start free', href: '/signup', highlight: false },
  { name: 'Pro', price: '$25', per: '/mo', blurb: 'For freelancers and one-person shops.', feats: ['100 new live searches each month', '100 business email credits', 'Bulk search up to 10 ZIPs', 'CSV, white-label PDF & CRM push', 'Shareable audits + outreach tools', '1,000 saved leads'], cta: 'Start 7-day free trial', href: '/signup?plan=pro', highlight: true },
  { name: 'Agency', price: '$50', per: '/mo', blurb: 'For teams working territories.', feats: ['Everything in Pro', '300 pooled live searches', '500 pooled email credits', '10,000 saved leads', '5-seat team workspace', 'Bulk search 25 ZIPs + API access'], cta: 'Start 7-day free trial', href: '/signup?plan=agency', highlight: false },
]

const FAQS = [
  { q: 'Where does the lead data come from?', a: 'LeadZipp pulls live business listings from Google Places and Yelp: real names, addresses, phone numbers, ratings, and websites. It is not a static scraped database. Every search runs against current data.' },
  { q: 'What makes a lead “high-scoring”?', a: 'We rank each business by how likely it is to need your services. Signals like having no website, few reviews, or a low rating push a business up your list, because those are the owners most open to help.' },
  { q: 'Can I find email addresses?', a: 'Yes. For any business with a website, one tap runs the email finder and returns the best contact address with a confidence badge (verified, likely, or pattern-based).' },
  { q: 'How do exports work?', a: 'Export any result set to CSV or a branded PDF, or push leads directly into HubSpot, Pipedrive, or GoHighLevel. Email, phone, score, and every field come along.' },
  { q: 'Do I need a credit card to start?', a: 'No. Free includes 25 new live territory searches and 5 welcome email credits. Upgrade to Pro for more live data, bulk ZIP search, full exports, and email alerts when new businesses open in your patch. Pro and Agency start with a 7-day free trial, which does need a card and charges nothing if you cancel before day 7.' },
]

/* One log entry: timestamp pin on the route + narrative + product artifact.
   Artifacts are deliberately non-uniform - each beat shows the actual surface
   the product presents at that moment, not an icon card. */
function LogEntry({
  stamp, first, children,
}: { stamp: string; first?: boolean; children: React.ReactNode }) {
  return (
    <li className="relative pl-10 sm:pl-14">
      {/* Beacon pin on the route */}
      <span className="absolute left-0 top-1 flex h-7 w-7 items-center justify-center sm:left-2" aria-hidden>
        {first && <span className="pin-pulse absolute h-3 w-3 rounded-full bg-signal/40" />}
        <span className="h-3 w-3 rounded-full border-2 border-paper bg-signal shadow-[0_0_0_1px_var(--color-sand)]" />
      </span>
      <p className="readout text-signal">{stamp}</p>
      <div className="mt-2">{children}</div>
    </li>
  )
}

export default function Home() {
  return (
    <div className="grain relative min-h-screen bg-paper text-ink">
      <div hidden dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }} />
      {/* SEO: JSON-LD scoped to the landing page. FAQ items come from the
          same FAQS constant the visible section renders, so the markup
          always matches on-page content. */}
      <SoftwareApplicationSchema />
      <FaqSchema items={FAQS.map((f) => ({ question: f.q, answer: f.a }))} />

      {/* ================= NAV ================= */}
      <SiteHeader />

      {/* ================= MAIN ================= */}
      <main id="main-content">
      {/* ================= HERO ================= */}
      <section className="topo relative overflow-hidden text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-16 sm:py-24 lg:grid-cols-2">
          <div>
            <span className="readout inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-lime ring-1 ring-white/15">
              <span className="h-1.5 w-1.5 rounded-full bg-lime" /> Local lead intelligence
            </span>
            <h1 className="mt-6 font-display text-[2.7rem] font-extrabold leading-[0.98] tracking-tight sm:text-6xl">
              Find local business leads.<br />
              Fill your <span className="relative whitespace-nowrap text-signal-bright">pipeline.
                <svg className="absolute -bottom-2 left-0 w-full" height="10" viewBox="0 0 200 10" fill="none" aria-hidden>
                  <path d="M2 7C40 3 160 3 198 7" stroke="#CBF23F" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-white/75">
              LeadZipp finds and scores every local business in any US ZIP code,
              with real phones, websites, and decision-maker emails. Live Google
              &amp; Yelp data at search time. The businesses that need you most, first.
            </p>
            <div className="mt-8">
              <HeroSearchWidget />
            </div>
            {/* Reassurance under the form, where the offer actually gets read.
                Lime stays on the single strongest phrase so it keeps its job as
                the rare accent rather than becoming a second badge. */}
            <p className="mt-5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-white/70">
              <Sparkles className="h-4 w-4 shrink-0 text-lime" aria-hidden />
              <span className="font-semibold text-lime">7 days of Pro, free.</span>
              <span>Cancel before day 7 and pay nothing.</span>
              {/* Purely a visual separator between the two clauses: aria-hidden,
                  carries no information, and is dropped entirely below sm. Left
                  at /40 deliberately so it reads as punctuation, not as text. */}
              <span className="hidden text-white/40 sm:inline" aria-hidden>·</span>
              <span>Or stay on the free plan, 25 searches a month, no card.</span>
            </p>
            <p className="mt-5 text-sm text-white/65">
              Not sure where to begin?{' '}
              <Link href="/first-territory" className="font-semibold text-white underline decoration-lime/70 underline-offset-4 hover:text-lime">
                Ask us to build your first territory with you.
              </Link>
            </p>
          </div>
          <div className="lg:pl-6">
            <HeroMap />
          </div>
        </div>
      </section>

      {/* ================= TRUST MARQUEE ================= */}
      <section className="border-y border-sand bg-paper-2 py-5">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-5">
          <span className="readout hidden flex-shrink-0 text-stone sm:block">Prospecting for →</span>
          <div className="relative flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
            <div className="marquee-track gap-3">
              {TRADES.map((t) => (
                <span key={t} className="flex-shrink-0 rounded-full border border-sand bg-paper px-4 py-1.5 font-mono text-sm text-ink-soft">
                  {t}
                </span>
              ))}
              {/* Seamless-loop duplicate — visual only, hidden from screen readers */}
              {TRADES.map((t) => (
                <span key={`dup-${t}`} aria-hidden="true" className="flex-shrink-0 rounded-full border border-sand bg-paper px-4 py-1.5 font-mono text-sm text-ink-soft">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= THE EXPEDITION LOG =================
          One working morning in a territory, told on a surveyor's route.
          Replaces the how-it-works grid, features grid, showcase, and stats
          band with a single time-stamped narrative of the product in use. */}
      <section id="how" className="map-grid relative border-b border-sand py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <span className="readout text-signal">One morning in a territory</span>
            <h2 className="mt-3 max-w-2xl font-display text-3xl font-extrabold leading-tight sm:text-[2.6rem]">
              From a ZIP code to a booked call, one working morning.
            </h2>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-soft">
              This is the whole job, timed. Sample data below, marked where it
              appears — your searches run live.
            </p>
          </Reveal>

          <ol className="route-line relative mt-16 max-w-3xl space-y-16 bg-left-top pl-0 [background-position-x:13px] sm:[background-position-x:21px]">
            {/* ---- 07:02 — the search ---- */}
            <LogEntry stamp="07:02 · Drop a pin" first>
              <Reveal>
                <h3 className="font-display text-xl font-bold sm:text-2xl">Type a ZIP. Pick a trade.</h3>
                <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-ink-soft">
                  Plumbers, dentists, roofers — anything local. Set the radius
                  and go. No list-buying, no map-scrolling by hand.
                </p>
                <div className="mt-5 flex max-w-md items-center gap-2 rounded-full border border-sand bg-white p-2 pl-4 shadow-card" aria-hidden>
                  <MapPin className="h-4 w-4 flex-shrink-0 text-signal" />
                  <span className="flex-1 truncate font-mono text-sm text-ink">HVAC contractors · 75023 · 10 mi</span>
                  <span className="flex-shrink-0 rounded-full bg-signal px-4 py-2 text-sm font-semibold text-white">Scan</span>
                </div>
              </Reveal>
            </LogEntry>

            {/* ---- 07:04 — the scored block ---- */}
            <LogEntry stamp="07:04 · The block comes back scored">
              <Reveal>
                <h3 className="font-display text-xl font-bold sm:text-2xl">Every business, ranked by how much they need you.</h3>
                <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-ink-soft">
                  Live from Google &amp; Yelp, then scored: no website, thin
                  reviews, weak rating float to the top — those owners are the
                  easiest yes you&rsquo;ll have all week.
                </p>
                <div className="mt-5 max-w-md overflow-hidden rounded-2xl border border-sand bg-white shadow-card">
                  <p className="readout border-b border-sand bg-paper-2 px-4 py-2 text-stone">Sample scan · 75023</p>
                  <ul className="divide-y divide-sand">
                    {SCAN_ROWS.map((b) => (
                      <li key={b.name} className="flex items-center gap-3 px-4 py-2.5">
                        <Image src={b.img} alt="" width={36} height={36} className="h-9 w-9 flex-shrink-0 rounded-lg object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-display text-[15px] font-bold leading-tight">{b.name}</p>
                          <p className="readout !normal-case tracking-normal text-stone">{b.cat} · <span className="text-signal">{b.tag}</span></p>
                        </div>
                        <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-md bg-forest px-1.5 py-0.5">
                          <Star className="h-2.5 w-2.5 fill-lime text-lime" aria-hidden />
                          <span className="font-mono text-xs font-bold text-white">{b.score}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </LogEntry>

            {/* ---- 07:09 — the email ---- */}
            <LogEntry stamp="07:09 · Pull the decision-maker's email">
              <Reveal>
                <h3 className="font-display text-xl font-bold sm:text-2xl">One tap, one verified contact.</h3>
                <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-ink-soft">
                  For any business with a domain, the email finder returns the
                  best address with a confidence badge, so you know what
                  you&rsquo;re working with before you write a word.
                </p>
                <div className="mt-5 flex max-w-md flex-wrap items-center gap-3 rounded-2xl border border-sand bg-white px-4 py-3.5 shadow-card">
                  <Mail className="h-4 w-4 flex-shrink-0 text-signal" aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-mono text-sm text-ink">t•••@ironwoodelectric.com</span>
                  <span className="rounded-full bg-forest px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wide text-lime">Verified</span>
                  <span className="readout w-full !normal-case tracking-normal text-stone">Sample result · 1 email credit</span>
                </div>
              </Reveal>
            </LogEntry>

            {/* ---- 07:15 — the pitch ---- */}
            <LogEntry stamp="07:15 · First pitch out the door">
              <Reveal>
                <h3 className="font-display text-xl font-bold sm:text-2xl">Send proof, not promises.</h3>
                <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-ink-soft">
                  Every lead carries a Digital Health Score you can turn into a
                  shareable audit report — the owner sees exactly what&rsquo;s
                  broken and who can fix it. Then export anywhere: CSV, branded
                  PDF, or straight into your CRM.
                </p>
                <div className="mt-5 max-w-md rounded-2xl border border-sand bg-white p-4 shadow-card">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-signal-50">
                      <FileText className="h-5 w-5 text-signal" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-[15px] font-bold leading-tight">Ironwood Electric — Digital Health Report</p>
                      <p className="readout !normal-case tracking-normal text-stone">Score 38/100 · No website · 11 reviews</p>
                    </div>
                    <span className="font-mono text-2xl font-bold text-signal" aria-hidden>38</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-sand pt-3">
                    {['CSV', 'Branded PDF', 'HubSpot', 'Pipedrive', 'GoHighLevel'].map((x) => (
                      <span key={x} className="rounded-full border border-sand bg-paper px-2.5 py-1 font-mono text-[11px] text-ink-soft">{x}</span>
                    ))}
                  </div>
                </div>
              </Reveal>
            </LogEntry>

            {/* ---- 07:31 — the territory ---- */}
            <LogEntry stamp="07:31 · The rest of the block, on the map">
              <Reveal>
                <h3 className="font-display text-xl font-bold sm:text-2xl">Work the territory, not one lead.</h3>
                <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-ink-soft">
                  Flip to map view and see the whole neighborhood scored. Filter
                  by radius, rating, reviews, has-website. Follow a ZIP and get
                  emailed when new businesses open, so you reach out while
                  they&rsquo;re brand new.
                </p>
                <dl className="mt-5 grid max-w-md grid-cols-2 gap-px overflow-hidden rounded-2xl border border-sand bg-sand shadow-card sm:grid-cols-4">
                  {STATS.map((s) => (
                    <div key={s.l} className="flex flex-col bg-white px-3 py-3.5 text-center">
                      <dt className="readout order-2 mt-1 text-stone">{s.l}</dt>
                      <dd className="order-1 font-display text-2xl font-extrabold text-ink [font-variant-numeric:tabular-nums]">{s.v}</dd>
                    </div>
                  ))}
                </dl>
              </Reveal>
            </LogEntry>

            {/* ---- Day 7 — the verdict ---- */}
            <LogEntry stamp="Day 7 · The verdict">
              <Reveal>
                <h3 className="font-display text-xl font-bold sm:text-2xl">By day 7 you know if the territory pays.</h3>
                <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-ink-soft">
                  That&rsquo;s why the trial is 7 days. Apollo sells you a
                  database; LeadZipp tells you who to pitch first, from live
                  data, for $25 a month.{' '}
                  <Link href="/compare" className="font-semibold text-signal underline-offset-2 hover:underline">See the comparison</Link>.
                </p>
              </Reveal>
            </LogEntry>
          </ol>
        </div>
      </section>

      {/* ================= PRICING PREVIEW ================= */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="readout text-signal">What the route costs</span>
          <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight sm:text-[2.6rem]">
            Start free. Upgrade when the deals roll in.
          </h2>
          <p className="mt-4 text-base text-stone">
            Pro and Agency trials take a card; the free plan never does. You get everything
            unlocked for 7 days, and you can cancel any time before day 7 without being
            charged.
          </p>
        </Reveal>
        <div className="mt-14 grid items-stretch gap-6 md:grid-cols-3">
          {PLANS.map((p, i) => (
            <Reveal key={p.name} delay={i * 0.08}>
              <div className={`relative flex h-full flex-col rounded-3xl border p-7 ${p.highlight ? 'border-signal-bright bg-forest text-white signal-glow' : 'border-sand bg-white'}`}>
                {p.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-signal px-3 py-1 text-xs font-bold text-white">
                    Best value
                  </span>
                )}
                <h3 className={`font-display text-lg font-bold ${p.highlight ? 'text-lime' : ''}`}>{p.name}</h3>
                <p className={`mt-1 text-sm ${p.highlight ? 'text-white/70' : 'text-stone'}`}>{p.blurb}</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-extrabold">{p.price}</span>
                  <span className={`text-sm ${p.highlight ? 'text-white/60' : 'text-stone'}`}>{p.per}</span>
                </div>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {p.feats.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className={`mt-0.5 h-4 w-4 flex-shrink-0 ${p.highlight ? 'text-lime' : 'text-signal'}`} />
                      <span className={p.highlight ? 'text-white/90' : 'text-ink-soft'}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href={p.href} className={`mt-7 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 font-semibold transition-all active:scale-95 ${p.highlight ? 'bg-signal-bright text-ink hover:bg-[#FF6240]' : 'bg-ink text-paper hover:bg-ink-soft'}`}>
                  {p.cta} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-stone">
          Compare every feature on the <Link href="/pricing" className="font-semibold text-signal underline-offset-2 hover:underline">full pricing page</Link>.
        </p>
      </section>

      {/* ================= FIELD NOTES (FAQ) ================= */}
      <section id="faq" className="border-t border-sand bg-paper-2 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-5">
          <Reveal>
            <span className="readout text-signal">Field notes</span>
            <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight sm:text-[2.6rem]">
              The stuff people ask before their first search.
            </h2>
          </Reveal>
          <div className="mt-12 divide-y divide-sand rounded-3xl border border-sand bg-white">
            {FAQS.map((f, i) => (
              <details key={f.q} className="group px-6 py-5 [&_svg]:open:rotate-45">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <span className="flex min-w-0 items-baseline gap-3">
                    <span className="readout flex-shrink-0 text-stone" aria-hidden>N{String(i + 1).padStart(2, '0')}</span>
                    <span className="font-display text-lg font-semibold">{f.q}</span>
                  </span>
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-signal-50 text-signal transition-transform">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                  </span>
                </summary>
                <p className="mt-3 pl-9 text-[15px] leading-relaxed text-ink-soft">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="relative overflow-hidden bg-signal py-20 text-white sm:py-28">
        <div className="grain absolute inset-0 opacity-40" />
        <div className="relative mx-auto max-w-3xl px-5 text-center">
          <p className="readout text-white/90">Tomorrow · 07:02 · your territory</p>
          <h2 className="mt-4 font-display text-4xl font-extrabold leading-[1.02] sm:text-5xl">
            Your next 50 clients are<br className="hidden sm:block" /> already on the map.
          </h2>
          {/* The accessible orange (#C22F0A) is only 5.67:1 against solid white,
              so this band has almost no headroom for dimming: /85 measured
              4.46:1. Body copy here sits at /90 (4.83:1) and takes its secondary
              rank from type size rather than from opacity. */}
          <p className="mx-auto mt-5 max-w-lg text-lg text-white/90">
            Run your first search free — no card, no account. Type a US ZIP and
            watch your territory light up.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 font-semibold text-signal transition-transform hover:scale-[1.03] active:scale-95">
              <Search className="h-4 w-4" /> Start finding leads
            </Link>
            <Link href="/pricing" className="inline-flex items-center gap-2 rounded-full border border-white/40 px-7 py-3.5 font-semibold text-white transition-colors hover:bg-white/10">
              See pricing
            </Link>
          </div>
          <p className="mt-6 text-sm text-white/90">
            Ready for more territory coverage? Pro and Agency include a 7-day free trial. Cancel before day 7 and pay nothing.
          </p>
        </div>
      </section>
      </main>

      {/* ================= FOOTER ================= */}
      <SiteFooter />
    </div>
  )
}
