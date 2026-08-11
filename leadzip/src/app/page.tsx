import Link from 'next/link'
import Image from 'next/image'
import {
  MapPin, ArrowRight, Search, Target, Send, Database, Gauge, Mail,
  Download, Map as MapIcon, SlidersHorizontal, Star, Check, Menu,
} from 'lucide-react'
import { HeroSearchWidget } from '@/components/landing/HeroSearchWidget'
import { HeroMap } from '@/components/landing/HeroMap'
import { Reveal } from '@/components/landing/Reveal'

const TRADES = [
  'Plumbers', 'Dentists', 'Roofers', 'Salons', 'HVAC', 'Law Firms', 'Restaurants',
  'Contractors', 'Auto Shops', 'Realtors', 'Gyms', 'Electricians', 'Landscapers', 'Chiropractors',
]

const STEPS = [
  {
    n: '01', icon: MapPin, title: 'Drop a pin',
    body: 'Type a ZIP code and pick a trade — plumbers, dentists, roofers, anything. Set your radius and go.',
  },
  {
    n: '02', icon: Target, title: 'We map the block',
    body: 'Every real business in that area, pulled live from Google & Yelp, then scored by how badly they need what you sell.',
  },
  {
    n: '03', icon: Send, title: 'Reach out first',
    body: 'Find the owner’s email, tap to call, and export straight to your CRM. You’re talking to them before competitors even know they exist.',
  },
]

const FEATURES = [
  { icon: Database, title: 'Real businesses, not scraped junk', body: 'Live data from Google Places & Yelp — verified names, addresses, phones, and websites. Every lead is a business you can actually call today.' },
  { icon: Gauge, title: 'Lead scoring that finds the gaps', body: 'We rank every result by opportunity. No website? Low reviews? Those float to the top — the businesses most likely to say yes to you.' },
  { icon: Mail, title: 'Decision-maker email finder', body: 'One tap surfaces the best contact email for any business with a domain, with a confidence badge so you know what you’re working with.' },
  { icon: Download, title: 'Export anywhere in one click', body: 'CSV, branded PDF, or straight into HubSpot, Salesforce, and Pipedrive. Your pipeline, your format — no copy-paste.' },
  { icon: MapIcon, title: 'See the whole territory', body: 'Flip to map view and watch your leads light up across the neighborhood. Work a block, own a zip, plan your route.' },
  { icon: SlidersHorizontal, title: 'Filter down to your buyer', body: 'Radius, rating, review count, has-website, category — dial in exactly the businesses that fit before you spend a minute reaching out.' },
]

const SHOWCASE = [
  { img: '/img/storefront.jpg', name: 'Marlowe Home Goods', cat: 'Retail · 90028', score: 92, tag: 'No website' },
  { img: '/img/tradesman.jpg', name: 'Ironwood Electric', cat: 'Electrician · 90026', score: 97, tag: 'No website' },
  { img: '/img/dentist.jpg', name: 'Bright Ave Dental', cat: 'Dentist · 90210', score: 84, tag: 'Weak reviews' },
  { img: '/img/cafe.jpg', name: 'Poppy & Rye Café', cat: 'Restaurant · 90012', score: 89, tag: 'No website' },
]

const STATS = [
  { v: '43', l: 'industries covered' },
  { v: '41k+', l: 'US ZIP codes' },
  { v: 'Live', l: 'Google & Yelp data' },
  { v: '<10s', l: 'to a full lead list' },
]

const PLANS = [
  { name: 'Starter', price: '$0', per: 'forever', blurb: 'Kick the tires.', feats: ['25 searches / month', 'Real business data', 'CSV export'], cta: 'Start free', href: '/signup', highlight: false },
  { name: 'Pro', price: '$25', per: '/mo', blurb: 'For the solo closer.', feats: ['Unlimited searches', 'Email finder + lead scoring', 'PDF & CRM export', 'Map view'], cta: 'Go Pro', href: '/signup', highlight: true },
  { name: 'Agency', price: '$50', per: '/mo', blurb: 'For teams working territories.', feats: ['Everything in Pro', 'Team workspaces', 'White-label PDFs', 'Priority support'], cta: 'Start Agency', href: '/signup', highlight: false },
]

const FAQS = [
  { q: 'Where does the lead data come from?', a: 'LeadZipp pulls live business listings from Google Places and Yelp — real names, addresses, phone numbers, ratings, and websites. It is not a static scraped database; every search runs against current data.' },
  { q: 'What makes a lead “high-scoring”?', a: 'We rank each business by how likely it is to need your services. Signals like having no website, few reviews, or a low rating push a business up your list, because those are the owners most open to help.' },
  { q: 'Can I find email addresses?', a: 'Yes. For any business with a website, one tap runs the email finder and returns the best contact address with a confidence badge (verified, likely, or pattern-based).' },
  { q: 'How do exports work?', a: 'Export any result set to CSV or a branded PDF, or push leads directly into HubSpot, Salesforce, or Pipedrive. Email, phone, score, and every field come along.' },
  { q: 'Do I need a credit card to start?', a: 'No. The Starter plan is free forever and includes 25 searches a month against real data. Upgrade to Pro only when you want unlimited searches and the email finder.' },
]

export default function Home() {
  return (
    <div className="grain relative min-h-screen bg-paper text-ink">
      {/* ================= NAV ================= */}
      <header className="sticky top-0 z-50 border-b border-sand/70 bg-paper/80 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2">
            <span className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-signal">
              <MapPin className="h-4 w-4 text-white" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-lime ring-2 ring-paper" />
            </span>
            <span className="font-display text-xl font-extrabold tracking-tight">LeadZipp</span>
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#how" className="text-sm font-medium text-ink-soft transition-colors hover:text-ink">How it works</a>
            <a href="#features" className="text-sm font-medium text-ink-soft transition-colors hover:text-ink">Features</a>
            <Link href="/pricing" className="text-sm font-medium text-ink-soft transition-colors hover:text-ink">Pricing</Link>
            <Link href="/blog" className="text-sm font-medium text-ink-soft transition-colors hover:text-ink">Blog</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden text-sm font-semibold text-ink transition-colors hover:text-signal sm:block">Log in</Link>
            <Link href="/signup" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper transition-transform hover:scale-[1.03] active:scale-95">
              Start free
            </Link>
            <button className="md:hidden" aria-label="Menu"><Menu className="h-5 w-5" /></button>
          </div>
        </nav>
      </header>

      {/* ================= HERO ================= */}
      <section className="topo relative overflow-hidden text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-16 sm:py-24 lg:grid-cols-2">
          <div>
            <span className="readout inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-lime ring-1 ring-white/15">
              <span className="h-1.5 w-1.5 rounded-full bg-lime" /> Local lead intelligence
            </span>
            <h1 className="mt-6 font-display text-[2.7rem] font-extrabold leading-[0.98] tracking-tight sm:text-6xl">
              Drop a pin.<br />
              Fill your <span className="relative whitespace-nowrap text-signal">pipeline.
                <svg className="absolute -bottom-2 left-0 w-full" height="10" viewBox="0 0 200 10" fill="none" aria-hidden>
                  <path d="M2 7C40 3 160 3 198 7" stroke="#CBF23F" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-white/75">
              Find and score every local business in any ZIP code — with real phones, websites,
              and owner emails. Live Google &amp; Yelp data, not a scraped demo. The businesses
              that need you most, first.
            </p>
            <div className="mt-8">
              <HeroSearchWidget />
            </div>
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
              {[...TRADES, ...TRADES].map((t, i) => (
                <span key={i} className="flex-shrink-0 rounded-full border border-sand bg-paper px-4 py-1.5 font-mono text-sm text-ink-soft">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
        <Reveal>
          <span className="readout text-signal">The workflow</span>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-extrabold leading-tight sm:text-[2.6rem]">
            From a ZIP code to a booked call in three moves.
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.1}>
              <div className="relative h-full rounded-3xl border border-sand bg-white p-7 card-lift">
                <span className="font-mono text-sm font-bold text-signal">{s.n}</span>
                <span className="mt-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-signal-50">
                  <s.icon className="h-6 w-6 text-signal" />
                </span>
                <h3 className="mt-5 font-display text-xl font-bold">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ================= FEATURES ================= */}
      <section id="features" className="relative border-y border-sand bg-paper-2 py-20 sm:py-28 map-grid">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal className="max-w-2xl">
            <span className="readout text-signal">What you get</span>
            <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight sm:text-[2.6rem]">
              Everything you need to turn a neighborhood into a pipeline.
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 0.08}>
                <div className="group h-full rounded-2xl border border-sand bg-white p-6 transition-colors hover:border-signal/40">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-forest text-lime transition-colors group-hover:bg-signal group-hover:text-white">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 font-display text-lg font-bold">{f.title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= SHOWCASE ================= */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <span className="readout text-signal">The output</span>
            <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight sm:text-[2.6rem]">
              These are real businesses in one ZIP — ranked and ready.
            </h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-soft">
              Every card is a live listing with a real address, phone, and score. The ones with
              <span className="font-semibold text-ink"> no website</span> or
              <span className="font-semibold text-ink"> thin reviews</span> rise to the top —
              because those owners are the easiest yes you’ll have all week.
            </p>
            <Link href="/signup" className="mt-8 inline-flex items-center gap-2 rounded-full bg-signal px-6 py-3 font-semibold text-white transition-all hover:bg-signal-600 active:scale-95">
              See leads in your area <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
          <div className="grid grid-cols-2 gap-4">
            {SHOWCASE.map((b, i) => (
              <Reveal key={b.name} delay={i * 0.08} className={i % 2 === 1 ? 'mt-8' : ''}>
                <div className="overflow-hidden rounded-2xl border border-sand bg-white card-lift">
                  <div className="relative aspect-[4/3]">
                    <Image src={b.img} alt={b.name} fill sizes="(max-width:768px) 45vw, 240px" className="object-cover" />
                    <span className="absolute right-2 top-2 rounded-lg bg-signal px-2 py-0.5 text-xs font-bold text-white">{b.tag}</span>
                  </div>
                  <div className="p-3.5">
                    <p className="truncate font-display text-[15px] font-bold">{b.name}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="readout !text-[10px] !normal-case tracking-normal text-stone">{b.cat}</span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-forest px-1.5 py-0.5">
                        <Star className="h-2.5 w-2.5 fill-lime text-lime" />
                        <span className="font-mono text-xs font-bold text-white">{b.score}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= STATS BAND ================= */}
      <section className="topo relative overflow-hidden py-16 text-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-5 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.l} className="text-center">
              <p className="font-display text-4xl font-extrabold text-lime sm:text-5xl">{s.v}</p>
              <p className="readout mt-2 text-white/60">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= PRICING PREVIEW ================= */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="readout text-signal">Simple pricing</span>
          <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight sm:text-[2.6rem]">
            Start free. Upgrade when the deals roll in.
          </h2>
        </Reveal>
        <div className="mt-14 grid items-stretch gap-6 md:grid-cols-3">
          {PLANS.map((p, i) => (
            <Reveal key={p.name} delay={i * 0.08}>
              <div className={`relative flex h-full flex-col rounded-3xl border p-7 ${p.highlight ? 'border-signal bg-forest text-white signal-glow' : 'border-sand bg-white'}`}>
                {p.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-signal px-3 py-1 text-xs font-bold text-white">
                    Most popular
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
                <Link href={p.href} className={`mt-7 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 font-semibold transition-all active:scale-95 ${p.highlight ? 'bg-signal text-white hover:bg-signal-600' : 'bg-ink text-paper hover:bg-ink-soft'}`}>
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

      {/* ================= FAQ ================= */}
      <section id="faq" className="border-t border-sand bg-paper-2 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-5">
          <Reveal>
            <span className="readout text-signal">Questions</span>
            <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight sm:text-[2.6rem]">
              The stuff people ask before their first search.
            </h2>
          </Reveal>
          <div className="mt-12 divide-y divide-sand rounded-3xl border border-sand bg-white">
            {FAQS.map((f) => (
              <details key={f.q} className="group px-6 py-5 [&_svg]:open:rotate-45">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <span className="font-display text-lg font-semibold">{f.q}</span>
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-signal-50 text-signal transition-transform">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                  </span>
                </summary>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="relative overflow-hidden bg-signal py-20 text-white sm:py-28">
        <div className="grain absolute inset-0 opacity-40" />
        <div className="relative mx-auto max-w-3xl px-5 text-center">
          <h2 className="font-display text-4xl font-extrabold leading-[1.02] sm:text-5xl">
            Your next 50 clients are<br className="hidden sm:block" /> already on the map.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-lg text-white/85">
            Run your first search free — no card, no demo data. Just type a ZIP and watch your territory light up.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 font-semibold text-signal transition-transform hover:scale-[1.03] active:scale-95">
              <Search className="h-4 w-4" /> Start finding leads
            </Link>
            <Link href="/pricing" className="inline-flex items-center gap-2 rounded-full border border-white/40 px-7 py-3.5 font-semibold text-white transition-colors hover:bg-white/10">
              See pricing
            </Link>
          </div>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="bg-forest-900 py-14 text-white/70">
        <div className="mx-auto max-w-6xl px-5">
          <div className="flex flex-col justify-between gap-8 md:flex-row">
            <div className="max-w-xs">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-signal">
                  <MapPin className="h-4 w-4 text-white" />
                </span>
                <span className="font-display text-xl font-extrabold text-white">LeadZipp</span>
              </div>
              <p className="mt-4 text-sm leading-relaxed">
                Turn any ZIP code into a map of local businesses that need what you sell.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
              <div>
                <p className="readout text-lime">Product</p>
                <ul className="mt-4 space-y-2.5 text-sm">
                  <li><a href="#features" className="hover:text-white">Features</a></li>
                  <li><Link href="/pricing" className="hover:text-white">Pricing</Link></li>
                  <li><Link href="/api-docs" className="hover:text-white">API</Link></li>
                  <li><Link href="/search" className="hover:text-white">Search</Link></li>
                </ul>
              </div>
              <div>
                <p className="readout text-lime">Company</p>
                <ul className="mt-4 space-y-2.5 text-sm">
                  <li><a href="#how" className="hover:text-white">How it works</a></li>
                  <li><a href="#faq" className="hover:text-white">FAQ</a></li>
                  <li><Link href="/login" className="hover:text-white">Log in</Link></li>
                </ul>
              </div>
              <div>
                <p className="readout text-lime">Legal</p>
                <ul className="mt-4 space-y-2.5 text-sm">
                  <li><Link href="/privacy" className="hover:text-white">Privacy</Link></li>
                  <li><Link href="/terms" className="hover:text-white">Terms</Link></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-sm sm:flex-row">
            <p>© {new Date().getFullYear()} LeadZipp. Built for people who sell to Main Street.</p>
            <p className="readout text-white/40">Real data · Google &amp; Yelp</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
