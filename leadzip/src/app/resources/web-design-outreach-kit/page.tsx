import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check, Download, FileSpreadsheet, Mail, Phone, ShieldCheck } from 'lucide-react'
import { SiteFooter, SiteHeader } from '@/components/marketing/MarketingChrome'
import BreadcrumbSchema from '@/components/seo/BreadcrumbSchema'
import JsonLd from '@/components/seo/JsonLd'
import { SITE_URL } from '@/components/seo/site'

const TITLE = 'Free Web Design Outreach Templates and Prospect Tracker'
const DESCRIPTION =
  'Download practical web design cold-email templates, phone openers, follow-up copy, and a simple CSV prospect tracker. Built for specific, permission-based local-business outreach.'
const URL = `${SITE_URL}/resources/web-design-outreach-kit`
const OG = '/og?title=Free+web+design+outreach+kit&subtitle=Specific+scripts+and+a+simple+prospect+tracker'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: {
    title: `${TITLE} | LeadZipp`,
    description: DESCRIPTION,
    url: URL,
    type: 'article',
    images: [{ url: OG, width: 1200, height: 630, alt: 'Free web design outreach templates and prospect tracker' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${TITLE} | LeadZipp`,
    description: DESCRIPTION,
    images: [OG],
  },
}

const pageSchema = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  '@id': `${URL}#howto`,
  url: URL,
  name: TITLE,
  description: DESCRIPTION,
  inLanguage: 'en-US',
  step: [
    { '@type': 'HowToStep', position: 1, name: 'Verify one public issue', text: 'Confirm the prospect and specific issue before making contact.' },
    { '@type': 'HowToStep', position: 2, name: 'Choose the smallest useful offer', text: 'Connect the verified issue to a practical next step rather than a generic redesign pitch.' },
    { '@type': 'HowToStep', position: 3, name: 'Use a permission-based opener', text: 'Ask whether the prospect wants the observation, example, or next step.' },
    { '@type': 'HowToStep', position: 4, name: 'Track the outcome', text: 'Record the status, next action, and any opt-out immediately.' },
  ],
}

const EMAIL_TEMPLATE = `Subject: Quick question about [Business Name]

Hi [First Name or Business Name team],

I found [Business Name] while looking at [business type] companies in [area]. Your public listing did not show a website when I checked on [date].

If that is still current, would it be useful if I sent a one-page example of how customers could view [service], see your work, and request a quote online?

No pressure—if you already have a site, send it over and I will update my notes.

[Your Name]`

const PHONE_TEMPLATE = `“Hi, is this a bad time? My name is [Name]. I found [Business Name] while researching [category] companies in [area]. Your public listing did not show a website when I checked today, and I wanted to confirm whether that is still right before I send anything.”`

const FOLLOWUP_TEMPLATE = `Hi [First Name],

One quick follow-up, then I’ll close the loop. The specific thing I noticed was [verified issue], which can get in the way when a potential customer tries to [desired action].

If improving that is on your list this quarter, I’m happy to send the short example. If not, no reply is needed.`

export default function WebDesignOutreachKitPage() {
  return (
    <div className="grain relative min-h-screen bg-paper text-ink">
      <SiteHeader />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: SITE_URL },
          { name: 'Web design outreach kit', url: URL },
        ]}
      />
      <JsonLd data={pageSchema} />

      <main>
        <section className="topo relative overflow-hidden text-white">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:py-22 lg:grid-cols-[1fr_0.82fr]">
            <div>
              <span className="readout inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-lime ring-1 ring-white/15">
                <span className="h-1.5 w-1.5 rounded-full bg-lime" /> Free founder resource
              </span>
              <h1 className="mt-6 font-display text-[2.55rem] font-extrabold leading-[1.01] tracking-tight sm:text-[3.8rem]">
                Web design outreach that starts with something real.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/78">
                Use a verified public gap, ask a small permission-based question, and track what happens. Download
                the editable templates and CSV tracker—no email gate.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="/resources/web-design-outreach-templates.txt"
                  download
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-signal px-6 py-3 font-semibold text-white hover:bg-signal-600"
                >
                  <Download className="h-4 w-4" aria-hidden="true" /> Download templates
                </a>
                <a
                  href="/resources/web-design-prospect-tracker.csv"
                  download
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 px-6 py-3 font-semibold text-white hover:bg-white/10"
                >
                  <FileSpreadsheet className="h-4 w-4" aria-hidden="true" /> Download CSV tracker
                </a>
              </div>
            </div>

            <div className="rounded-3xl border border-white/15 bg-white/[0.07] p-7 backdrop-blur-sm">
              <p className="readout text-lime">Inside the kit</p>
              <ul className="mt-5 space-y-3">
                {[
                  'No-website and site-gap email templates',
                  'Phone opener and voicemail',
                  'One useful follow-up',
                  'Qualification note checklist',
                  'Five-day outreach rhythm',
                  'CSV tracker with next-action fields',
                ].map((item) => (
                  <li key={item} className="flex gap-3 text-sm text-white/80">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-lime" aria-hidden="true" /> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="border-b border-sand bg-amber-50 py-5">
          <div className="mx-auto flex max-w-6xl items-start gap-3 px-5 text-sm leading-relaxed text-amber-900">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p>
              These are writing and workflow aids, not legal advice. Verify every claim, honor opt-outs immediately,
              and follow the email, privacy, telemarketing, and do-not-call rules that apply to you and the recipient.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 sm:py-22">
          <div className="max-w-3xl">
            <p className="readout text-signal">The rule behind every template</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight sm:text-[2.6rem]">
              Specific, verifiable, and easy to say no to.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-ink-soft">
              The goal is not to hide that the message is outreach. It is to show why you chose this business, avoid
              pretending they requested help, and ask permission before doing more work or sending a proposal.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <article className="rounded-3xl border border-sand bg-white p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-signal-50 text-signal">
                  <Mail className="h-5 w-5" aria-hidden="true" />
                </span>
                <div><p className="readout text-stone">Template 01</p><h3 className="font-display text-xl font-bold">No website listed</h3></div>
              </div>
              <pre className="mt-6 whitespace-pre-wrap rounded-2xl bg-paper-2 p-5 font-sans text-sm leading-relaxed text-ink-soft">{EMAIL_TEMPLATE}</pre>
            </article>

            <article className="rounded-3xl border border-sand bg-white p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-signal-50 text-signal">
                  <Phone className="h-5 w-5" aria-hidden="true" />
                </span>
                <div><p className="readout text-stone">Template 02</p><h3 className="font-display text-xl font-bold">Short phone opener</h3></div>
              </div>
              <blockquote className="mt-6 rounded-2xl bg-paper-2 p-5 text-[15px] leading-relaxed text-ink-soft">
                {PHONE_TEMPLATE}
              </blockquote>
              <div className="mt-5 rounded-2xl border border-sand p-5">
                <p className="text-sm font-semibold text-ink">If the listing is wrong</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  Thank them, ask for the correct website only if appropriate, update the record, and end the pitch.
                </p>
              </div>
            </article>

            <article className="rounded-3xl border border-sand bg-white p-6 sm:p-8 lg:col-span-2">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-signal-50 text-signal">
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </span>
                <div><p className="readout text-stone">Template 03</p><h3 className="font-display text-xl font-bold">One follow-up, then close the loop</h3></div>
              </div>
              <pre className="mt-6 whitespace-pre-wrap rounded-2xl bg-paper-2 p-5 font-sans text-sm leading-relaxed text-ink-soft">{FOLLOWUP_TEMPLATE}</pre>
            </article>
          </div>
        </section>

        <section className="border-y border-sand bg-paper-2 py-16 sm:py-22">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="readout text-signal">The tracker</p>
              <h2 className="mt-3 font-display text-3xl font-extrabold">Every row needs a next action.</h2>
              <p className="mt-5 leading-relaxed text-ink-soft">
                The CSV opens in Google Sheets, Excel, Numbers, or most CRMs. It separates the visible opportunity
                signal from the verified date, outreach status, and next step so an old assumption does not turn into
                repeated bad contact.
              </p>
              <a
                href="/resources/web-design-prospect-tracker.csv"
                download
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 font-semibold text-white"
              >
                <FileSpreadsheet className="h-4 w-4" aria-hidden="true" /> Download tracker.csv
              </a>
            </div>
            <div className="overflow-x-auto rounded-3xl border border-sand bg-white p-4 shadow-card">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead><tr className="border-b border-sand text-xs uppercase tracking-wide text-stone">
                  <th className="p-3">Company</th><th className="p-3">Signal</th><th className="p-3">Status</th><th className="p-3">Next action</th>
                </tr></thead>
                <tbody>
                  <tr className="border-b border-sand"><td className="p-3 font-semibold">Sample Business</td><td className="p-3">No website listed</td><td className="p-3"><span className="rounded-full bg-paper-2 px-2.5 py-1 text-xs">Not contacted</span></td><td className="p-3">Verify listing</td></tr>
                  <tr><td className="p-3 text-stone">Your next prospect</td><td className="p-3 text-stone">One verified gap</td><td className="p-3 text-stone">—</td><td className="p-3 text-stone">Date + action</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 sm:py-22">
          <div className="rounded-3xl bg-forest p-8 text-white sm:p-12">
            <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
              <div className="max-w-2xl">
                <p className="readout text-lime">Find the right five first</p>
                <h2 className="mt-3 font-display text-3xl font-extrabold sm:text-4xl">The template works better when the prospect actually fits.</h2>
                <p className="mt-4 leading-relaxed text-white/70">
                  Use LeadZipp to search a focused territory and rank visible need, or ask for help defining your
                  first batch before you reach out.
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                <Link href="/signup" className="inline-flex items-center justify-center gap-2 rounded-full bg-signal px-6 py-3 font-semibold text-white">
                  Find leads free <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href="/first-territory" className="inline-flex items-center justify-center rounded-full border border-white/25 px-6 py-3 font-semibold text-white hover:bg-white/10">
                  Build my first territory
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
