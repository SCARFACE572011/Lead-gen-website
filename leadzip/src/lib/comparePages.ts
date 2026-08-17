/**
 * Comparison landing pages for /compare/[slug].
 *
 * ACCURACY RULES for this file, because every company named here is real:
 *
 *   1. Only statements a competitor publicly advertises about itself are
 *      allowed. Positioning lines and feature category names were checked
 *      against each company's own live marketing site in August 2026.
 *   2. No invented pricing. Where a competitor publishes prices we say only
 *      that prices are published, never a figure we did not verify. Where a
 *      competitor sells through a sales process we say that and stop.
 *   3. No feature matrix full of X marks. Every row of every comparison
 *      table below is prose describing what each product is for. Absence of
 *      a capability is never asserted unless the company itself says so.
 *   4. Anything uncertain was omitted rather than softened.
 *
 * Claims about LeadZipp itself are drawn from this site's own product pages.
 * Style rule: no em dashes anywhere in this file's copy.
 */

import type { Faq } from './seoPages'

export const COMPARISON_AS_OF = 'August 2026'
export const COMPARISON_DISCLAIMER = `Comparison based on publicly available information as of ${COMPARISON_AS_OF}.`

export interface ComparisonRow {
  dimension: string
  leadzipp: string
  competitor: string
}

export interface ComparisonPage {
  slug: string
  competitor: string
  competitorShort: string
  /** One line summary used on the /compare index. */
  summary: string
  metaTitle: string
  metaDescription: string
  ogTitle: string
  ogSubtitle: string
  h1: string
  lede: string
  /** The honest one sentence answer, shown high on the page. */
  verdict: string
  competitorPanel: { heading: string; body: string; bullets: string[] }
  leadzippPanel: { heading: string; body: string; bullets: string[] }
  rows: ComparisonRow[]
  chooseCompetitor: { heading: string; items: string[] }
  chooseLeadzipp: { heading: string; items: string[] }
  overlap: string
  faqs: Faq[]
  ctaHeading: string
}

/* ------------------------------------------------------------------ */

const APOLLO: ComparisonPage = {
  slug: 'leadzipp-vs-apollo',
  competitor: 'Apollo.io',
  competitorShort: 'Apollo',
  summary: 'A large B2B contact database and sales engagement platform, compared with a local business prospecting tool.',
  metaTitle: 'LeadZipp vs Apollo.io: Which Prospecting Tool Fits Your Work',
  metaDescription:
    'Apollo is a B2B contact database and sales engagement platform for outbound teams. LeadZipp finds and scores local businesses by ZIP code or city. An honest look at which one fits your sales motion.',
  ogTitle: 'LeadZipp vs Apollo.io',
  ogSubtitle: 'Two different sales motions, not two versions of the same tool',
  h1: 'LeadZipp vs Apollo.io',
  lede:
    'These two tools get compared often and they are not really competitors. Apollo is built for teams running outbound into other companies. LeadZipp is built for agencies and freelancers selling websites, SEO and marketing services to local businesses in a defined area. Picking correctly is mostly a question of who you sell to.',
  verdict:
    'If your buyer has a job title, use Apollo. If your buyer has a storefront, use LeadZipp.',
  competitorPanel: {
    heading: 'What Apollo is built for',
    body:
      'Apollo describes itself as an AI sales platform for sales and marketing teams, and its own site names sales leaders, account executives, sales development representatives, revenue operations and marketers as its audiences. The product is organized around finding the right people inside target companies and then working them through a sequence.',
    bullets: [
      'A large B2B contact and company database. Apollo advertises 240M+ contacts and 30M+ companies on its homepage.',
      'Prospecting filters built around firmographics and personas, such as job title, company size and industry.',
      'Sales engagement built in, including sequences and an AI assistant.',
      'Data enrichment, workflow automation, a browser extension and CRM integrations.',
      'Plans and prices published openly on its pricing page, including a free plan.',
    ],
  },
  leadzippPanel: {
    heading: 'What LeadZipp is built for',
    body:
      'LeadZipp starts from a map rather than a database. You pick a ZIP code, or a city and country anywhere in the world, choose a business category and a radius, and get back the real businesses trading in that area right now, scored by how likely they are to need what you sell.',
    bullets: [
      'Live Google Places and Yelp business listings, read at the moment you search.',
      'Opportunity scoring built on local signals: no website, thin review count, weak rating.',
      'Filters that match a local offer, including radius, rating, review count and has-website.',
      'Email finder for any business with its own domain, with a confidence badge on the result.',
      'A shareable digital presence audit you can send a prospect, plus CSV, branded PDF and push into HubSpot, Pipedrive or GoHighLevel.',
    ],
  },
  rows: [
    {
      dimension: 'Who it is built for',
      leadzipp: 'Agencies, freelancers and local sales teams selling to small businesses in a territory.',
      competitor: 'Sales and marketing teams running outbound into other companies, from SDRs to RevOps.',
    },
    {
      dimension: 'Where the records come from',
      leadzipp: 'Live local business listings from Google Places and Yelp, read fresh on every search.',
      competitor: 'A B2B contact and company database, with enrichment on top.',
    },
    {
      dimension: 'How you pick targets',
      leadzipp: 'Geography first. ZIP code, or city plus country plus radius, then a category, then local filters.',
      competitor: 'Company and person attributes first. Industry, headcount, job title and similar filters.',
    },
    {
      dimension: 'What the score means',
      leadzipp: 'How badly a local business needs help. Missing website and thin reviews push a business up the list.',
      competitor: 'Fit and intent signals against your ideal customer profile.',
    },
    {
      dimension: 'What happens after the list',
      leadzipp: 'Email finder, shareable audit report, CSV, branded PDF and CRM push.',
      competitor: 'Sequencing and engagement inside the same platform, plus enrichment and CRM sync.',
    },
    {
      dimension: 'How it is bought',
      leadzipp: 'Self serve. Free includes 25 live searches, Pro includes 100, and Agency includes 300 pooled searches, with a 7-day paid-plan trial.',
      competitor: 'Self serve, with plans and prices published on their pricing page and a free plan available.',
    },
  ],
  chooseCompetitor: {
    heading: 'Choose Apollo if',
    items: [
      'You sell software or services to other companies and your buyer is identified by job title.',
      'You need contact records for named accounts rather than businesses in a geography.',
      'You want prospecting and sequencing in one platform for an SDR team.',
      'Your list is built from industry, headcount and technology filters.',
    ],
  },
  chooseLeadzipp: {
    heading: 'Choose LeadZipp if',
    items: [
      'You sell websites, SEO, ads or marketing services to local businesses.',
      'Your territory is a ZIP code, a city or a radius rather than an industry vertical.',
      'You want to find the businesses with the most obvious gaps before you write a word of outreach.',
      'You need something a solo operator or a small agency can run without a sales ops function.',
    ],
  },
  overlap:
    'Where they genuinely overlap is the moment you have a business and want a contact address for it. Apollo does that at scale for corporate contacts. LeadZipp does it for local businesses that have their own domain. If you sell to both kinds of buyer, running both is a perfectly reasonable setup and plenty of agencies do exactly that.',
  faqs: [
    {
      question: 'Is LeadZipp an Apollo alternative?',
      answer:
        'Only for one specific job. If you were using Apollo to build lists of local businesses by area, LeadZipp does that far more directly, because it searches by geography and scores results on local signals like a missing website. If you were using Apollo to reach named job titles inside larger companies, LeadZipp is not a replacement and is not trying to be.',
    },
    {
      question: 'Can Apollo find local businesses by ZIP code?',
      answer:
        'Apollo is organized around company and contact attributes rather than around a map, so building a list of every plumber inside a radius is not the motion it is designed for. That difference in starting point is the real distinction between the two products, and it is why the results feel so different even when the underlying task sounds similar.',
    },
    {
      question: 'Which one is cheaper?',
      answer:
        'Both publish their pricing openly, so the honest answer is to check both pricing pages for current numbers rather than trust a figure written into a comparison page. LeadZipp has a free plan with 25 live searches a month and paid plans that start with a 7-day free trial. Apollo also publishes a free plan alongside its paid tiers.',
    },
    {
      question: 'Can I use both?',
      answer:
        'Yes, and it is a common setup for agencies with mixed clients. LeadZipp fills the top of the funnel for local work, where the list has to come from a map. Apollo covers outbound into companies where the list comes from firmographics. They solve different halves of a mixed pipeline.',
    },
  ],
  ctaHeading: 'See what a local list actually looks like',
}

const HUNTER: ComparisonPage = {
  slug: 'leadzipp-vs-hunter-io',
  competitor: 'Hunter.io',
  competitorShort: 'Hunter',
  summary: 'An email finding and verification platform, compared with a tool that finds the businesses in the first place.',
  metaTitle: 'LeadZipp vs Hunter.io: Find Businesses or Find Emails',
  metaDescription:
    'Hunter.io finds and verifies professional email addresses for domains you already have. LeadZipp finds the local businesses first, scores them, then finds the email. How the two fit together.',
  ogTitle: 'LeadZipp vs Hunter.io',
  ogSubtitle: 'One finds the email. The other finds the business.',
  h1: 'LeadZipp vs Hunter.io',
  lede:
    'This comparison has a cleaner answer than most. Hunter starts from a domain you already have and finds the email addresses behind it. LeadZipp starts from a map and finds the businesses worth contacting at all. The question is not which is better. It is which half of the problem you currently have.',
  verdict:
    'Hunter answers "what is their email address". LeadZipp answers "which businesses should I be emailing".',
  competitorPanel: {
    heading: 'What Hunter is built for',
    body:
      'Hunter describes itself as an all-in-one email outreach platform. Its core tools are built around professional email addresses: finding them, verifying that they are deliverable, and sending to them. If you already know which companies you want to reach, Hunter is a well established way to get the addresses.',
    bullets: [
      'Domain Search, which returns the email addresses associated with a domain.',
      'Email Finder for a specific person at a specific company.',
      'Email Verifier for checking deliverability before you send.',
      'Campaigns and sequences for sending the outreach itself, plus an API and integrations.',
      'Plans and prices published openly, including a free tier with a monthly credit allowance.',
    ],
  },
  leadzippPanel: {
    heading: 'What LeadZipp is built for',
    body:
      'LeadZipp answers the question that comes before the email address. You pick an area and a category, and it returns the local businesses trading there, ranked by how likely they are to need what you sell. Email finding is one step inside that workflow rather than the whole product.',
    bullets: [
      'Search by ZIP code, or by city and country anywhere worldwide, with a radius.',
      'Live listings with name, address, phone, website, rating and review count.',
      'Opportunity scoring so the businesses with obvious gaps rise to the top.',
      'Built in email finder with a confidence badge, for any business that has its own domain, metered in credits that every plan includes.',
      'A shareable digital presence audit, plus CSV, branded PDF and CRM export.',
    ],
  },
  rows: [
    {
      dimension: 'Where you start',
      leadzipp: 'A map. You do not know the businesses yet, and finding them is the point.',
      competitor: 'A domain or a company you already have in hand.',
    },
    {
      dimension: 'Core job',
      leadzipp: 'Build and score a list of local businesses worth contacting.',
      competitor: 'Find and verify professional email addresses, then send to them.',
    },
    {
      dimension: 'Best fit buyer',
      leadzipp: 'Agencies and freelancers selling to local businesses in a territory.',
      competitor: 'Anyone doing email outreach who already knows their target list.',
    },
    {
      dimension: 'Email verification depth',
      leadzipp: 'A single confidence badge on each found address, inside the prospecting flow.',
      competitor: 'A dedicated verification product, including bulk checks and an API.',
    },
    {
      dimension: 'Phone and address data',
      leadzipp: 'Included on every result, because local outreach is often a phone call or a visit.',
      competitor: 'Focused on email rather than on local contact details.',
    },
    {
      dimension: 'How it is bought',
      leadzipp: 'Free includes 25 live searches a month, then paid plans add higher allowances and a 7-day trial.',
      competitor: 'Published plans with a free tier that includes a monthly credit allowance.',
    },
  ],
  chooseCompetitor: {
    heading: 'Choose Hunter if',
    items: [
      'You already have the list and you only need the addresses.',
      'Deliverability matters enough that you want dedicated verification, in bulk or by API.',
      'You want to send the campaign from the same tool that found the address.',
      'Your targets are companies with corporate domains rather than local businesses.',
    ],
  },
  chooseLeadzipp: {
    heading: 'Choose LeadZipp if',
    items: [
      'You do not have a list yet and the businesses you want are defined by where they are.',
      'Your best prospects are the ones with no website, which by definition have no domain to search.',
      'You want the phone number and address as much as the email, because local outreach is multi channel.',
      'You want the list scored before you start rather than sorted alphabetically.',
    ],
  },
  overlap:
    'The genuine overlap is one feature deep. LeadZipp includes an email finder because a list without contact details is not much use, and it works the same way any pattern and verification based finder does: better with an established domain, weaker without one. Hunter has spent far longer on that specific problem and offers more around it. Plenty of agencies use LeadZipp to build the list and Hunter to go deeper on the addresses that matter most.',
  faqs: [
    {
      question: 'Does LeadZipp replace Hunter.io?',
      answer:
        'For a local agency workflow it often does, because most of your prospects are small businesses and the built in email finder covers them. For high volume outreach where deliverability is the whole game, or where you need bulk verification and an API around it, Hunter does more than LeadZipp does and it would be strange to claim otherwise.',
    },
    {
      question: 'What happens when a business has no website?',
      answer:
        'There is no domain, so there is no email to find, in any tool. That is not a limitation to work around, it is the signal. A local business with no website is usually the best prospect on the page if you sell websites, and LeadZipp scores it accordingly. You reach those owners by phone or in person, and both details come with the listing.',
    },
    {
      question: 'Can I use Hunter with a LeadZipp list?',
      answer:
        'Yes. Export the list to CSV with the website column intact and you have exactly the input an email finder wants. A common pattern is to build and score the list in LeadZipp, work the no-website prospects by phone, and run the remaining domains through whatever email tooling you already pay for.',
    },
    {
      question: 'Which one should a new agency start with?',
      answer:
        'Start with the half you are missing. If you have a target list and no addresses, that is an email tool problem. If you are staring at a blank spreadsheet wondering which businesses to approach, that is a prospecting problem, and no email finder solves it because it needs a domain from you before it can do anything.',
    },
  ],
  ctaHeading: 'Build the list first',
}

const ZOOMINFO: ComparisonPage = {
  slug: 'leadzipp-vs-zoominfo',
  competitor: 'ZoomInfo',
  competitorShort: 'ZoomInfo',
  summary: 'An enterprise go-to-market intelligence platform, compared with a self serve local prospecting tool.',
  metaTitle: 'LeadZipp vs ZoomInfo: Enterprise GTM Data or Local Leads',
  metaDescription:
    'ZoomInfo is a go-to-market intelligence platform for enterprise sales, marketing and recruiting teams. LeadZipp is a self serve tool for finding and scoring local businesses. Which one matches your motion.',
  ogTitle: 'LeadZipp vs ZoomInfo',
  ogSubtitle: 'Enterprise GTM intelligence next to local business prospecting',
  h1: 'LeadZipp vs ZoomInfo',
  lede:
    'These two products sit at opposite ends of the market. ZoomInfo is a go-to-market intelligence platform used by sales, marketing and recruiting teams inside larger organizations. LeadZipp is a self serve tool for finding local businesses on a map and working out which of them need help. If you are comparing them, the deciding factor is almost always the size of the company you sell to.',
  verdict:
    'ZoomInfo is built for teams selling to companies. LeadZipp is built for people selling to Main Street.',
  competitorPanel: {
    heading: 'What ZoomInfo is built for',
    body:
      'ZoomInfo describes itself as a go-to-market intelligence platform that helps businesses find, engage and win customers, and says it serves sales, marketing and recruiting teams across industries such as software, manufacturing, business services and healthcare. It is a broad platform rather than a single tool.',
    bullets: [
      'A B2B contact and company intelligence database.',
      'Buying signals and intent data to prioritise accounts.',
      'Website visitor identification.',
      'Sales engagement and workflow automation, plus conversation intelligence.',
      'Sold through a sales process rather than a published self serve checkout, so pricing is a conversation with their team.',
    ],
  },
  leadzippPanel: {
    heading: 'What LeadZipp is built for',
    body:
      'LeadZipp does one thing. It turns a ZIP code, or a city and country anywhere in the world, into a scored list of the real local businesses trading there, so an agency or freelancer can see at a glance who has the biggest gap to fill.',
    bullets: [
      'Live Google Places and Yelp listings rather than a licensed contact database.',
      'Scoring on local need signals: no website, few reviews, a weak rating.',
      'Email finder, shareable digital presence audit, map view and territory alerts on claimed ZIP codes.',
      'CSV, branded PDF and direct push into HubSpot, Pipedrive or GoHighLevel.',
      'Self serve with 25 live searches on Free, 100 on Pro, 300 pooled on Agency, and a 7-day paid-plan trial.',
    ],
  },
  rows: [
    {
      dimension: 'Company size it serves',
      leadzipp: 'Solo operators, freelancers and small agencies.',
      competitor: 'Larger sales, marketing and recruiting organizations.',
    },
    {
      dimension: 'Target buyer of the end user',
      leadzipp: 'Local businesses with a physical location and a service area.',
      competitor: 'Other companies, identified by firmographics and contact records.',
    },
    {
      dimension: 'Data model',
      leadzipp: 'Live business listings read at search time.',
      competitor: 'A maintained contact and company intelligence database with signal layers on top.',
    },
    {
      dimension: 'Signals it surfaces',
      leadzipp: 'Digital presence gaps: missing website, thin reviews, weak rating.',
      competitor: 'Buying intent, website visitors and account level activity.',
    },
    {
      dimension: 'Time to first list',
      leadzipp: 'Sign up and search. The first list takes under a minute.',
      competitor: 'A platform rollout, typically with onboarding.',
    },
    {
      dimension: 'How it is bought',
      leadzipp: 'Self serve, with public pricing and a free plan.',
      competitor: 'Through their sales team. No published self serve price list to point at.',
    },
  ],
  chooseCompetitor: {
    heading: 'Choose ZoomInfo if',
    items: [
      'You run a sales team selling into mid-market or enterprise accounts.',
      'You need intent data and website visitor identification to prioritise accounts.',
      'You want one platform covering data, engagement and conversation intelligence.',
      'You have the budget process and the team to make a platform purchase worth it.',
    ],
  },
  chooseLeadzipp: {
    heading: 'Choose LeadZipp if',
    items: [
      'You sell websites, SEO, ads or marketing to local businesses.',
      'You want to start today without a demo, a rollout or a procurement cycle.',
      'The signal you care about is whether a business has a decent web presence at all.',
      'You would rather pay for one job done well than for a platform you use ten percent of.',
    ],
  },
  overlap:
    'There is very little genuine overlap, which is the useful conclusion here. A local marketing agency will not find independent plumbers and salons in a corporate contact database, and an enterprise sales team will not find named decision makers at target accounts in a map search. If you are weighing these two against each other, you are probably still deciding what kind of business you are running.',
  faqs: [
    {
      question: 'Is LeadZipp a ZoomInfo alternative?',
      answer:
        'Not in the general sense. They serve different markets with different data. LeadZipp is an alternative if the specific thing you wanted was a list of local businesses in an area, because that is a map problem rather than a corporate database problem. For account based enterprise selling, ZoomInfo is in a category LeadZipp does not compete in.',
    },
    {
      question: 'Does ZoomInfo cover small local businesses?',
      answer:
        'Their published positioning centers on go-to-market intelligence for company level selling across industries like software, manufacturing, business services and healthcare. Rather than guess at coverage of independent local trades, the practical test is to ask them directly about the categories and geographies you sell into, since that is a question only they can answer accurately.',
    },
    {
      question: 'What does ZoomInfo cost?',
      answer:
        'They do not publish a self serve price list, so pricing comes from a conversation with their sales team and depends on licences and usage. Any specific figure quoted on a competitor comparison page is secondhand at best, which is why there is not one here. LeadZipp publishes its pricing openly, including a free plan at 25 live searches a month.',
    },
    {
      question: 'Can a small agency use ZoomInfo?',
      answer:
        'That is a question for them rather than for us. What we can say is what LeadZipp assumes: no procurement process, no seat minimum, and a free tier so you can see the data before you decide. If those constraints describe your situation, that is the honest reason to look at a smaller, single purpose tool.',
    },
  ],
  ctaHeading: 'Start with one ZIP code',
}

const B2BLEADFINDER: ComparisonPage = {
  slug: 'leadzipp-vs-b2bleadfinder',
  competitor: 'B2B Lead Finder',
  competitorShort: 'B2B Lead Finder',
  summary: 'The closest overlap on this list. Both find local businesses with weak digital presence for agencies.',
  metaTitle: 'LeadZipp vs B2B Lead Finder: The Closest Comparison',
  metaDescription:
    'B2B Lead Finder scans map data for local businesses with a weak digital presence, aimed at web design and SEO agencies. So does LeadZipp. An honest look at where the two actually differ.',
  ogTitle: 'LeadZipp vs B2B Lead Finder',
  ogSubtitle: 'Same job, different bets on how to do it',
  h1: 'LeadZipp vs B2B Lead Finder',
  lede:
    'This is the closest comparison on the site, so it deserves a straight answer rather than a sales pitch. Both tools do the same fundamental thing: they read local business listings, flag the ones with a weak online presence, and hand the result to an agency or freelancer selling web and marketing services. If you are choosing between them, the differences are in the details rather than the concept.',
  verdict:
    'Same core idea. The real questions are how you want to search, how you want to pay, and how far the list travels afterwards.',
  competitorPanel: {
    heading: 'What B2B Lead Finder advertises',
    body:
      'Their site leads with finding businesses that do not have a website, and describes scanning Google Maps to discover businesses with a weak digital presence. The stated audience is web design agencies, SEO agencies, digital marketing freelancers and B2B sales teams, which is close to identical to who LeadZipp is built for.',
    bullets: [
      'A Google Maps based lead scanner.',
      'A digital health score with audit reports.',
      'Decision maker intelligence, competitor analysis and review sentiment analysis.',
      'A built in Kanban pipeline for working the leads, plus call log and script tooling.',
      'A 7-day free trial advertised across their plans.',
    ],
  },
  leadzippPanel: {
    heading: 'What LeadZipp does',
    body:
      'LeadZipp works from the same premise and makes some different calls about how to execute it. The bet here is on data breadth, on a permanent free tier so you can prospect in bursts, and on getting the list out of the tool and into whatever you already use.',
    bullets: [
      'Live listings from Google Places and Yelp, read at search time.',
      'Opportunity scoring on no website, thin reviews and weak rating, with filters for each.',
      'Search by US ZIP code, or by city and country worldwide with a radius.',
      'Shareable digital presence audit reports you can send a prospect as a link.',
      'Email finder with a confidence badge, CSV and branded PDF export, and direct push into HubSpot, Pipedrive or GoHighLevel, plus a public API on Agency.',
      'Claim a ZIP code and get emailed when new businesses appear in it.',
      'A free plan at 25 live searches a month, alongside a 7-day free trial on Pro and Agency.',
    ],
  },
  rows: [
    {
      dimension: 'Core idea',
      leadzipp: 'Find local businesses with digital presence gaps and score them.',
      competitor: 'Find local businesses with digital presence gaps and score them.',
    },
    {
      dimension: 'Listing sources named publicly',
      leadzipp: 'Google Places and Yelp.',
      competitor: 'Google Maps, per their own site copy.',
    },
    {
      dimension: 'Working the list',
      leadzipp: 'Export led. CSV, branded PDF, or push into HubSpot, Pipedrive or GoHighLevel, plus a public API on Agency.',
      competitor: 'Pipeline led. They advertise a Kanban CRM inside the product, with call log and script tooling.',
    },
    {
      dimension: 'Free access',
      leadzipp: 'A permanent free plan with 25 live searches a month, plus a 7-day trial on paid plans.',
      competitor: 'A 7-day free trial advertised across plans.',
    },
    {
      dimension: 'Geography',
      leadzipp: 'US ZIP code search, plus city and country search worldwide with a radius.',
      competitor: 'Publishes location pages across several countries and cities.',
    },
    {
      dimension: 'Prospect facing output',
      leadzipp: 'A shareable audit report link you can send a business owner.',
      competitor: 'A digital health score and audit reports.',
    },
  ],
  chooseCompetitor: {
    heading: 'Choose B2B Lead Finder if',
    items: [
      'You want your prospecting and your pipeline board in the same product.',
      'You prefer working leads inside the tool rather than exporting them somewhere else.',
      'Their specific feature set, including the call script and review sentiment tooling, matches how you sell.',
      'A trial is enough evaluation for you and you do not need a permanent free tier.',
    ],
  },
  chooseLeadzipp: {
    heading: 'Choose LeadZipp if',
    items: [
      'You already run a CRM and want leads pushed into it rather than a second pipeline to maintain.',
      'You want Yelp data alongside Google Places, since the two do not list identical businesses.',
      'You prospect in bursts and want a free tier that stays free between campaigns.',
      'You want territory alerts when new businesses open in a ZIP code you have claimed.',
      'You want an API, because your process is partly automated already, and the Agency plan fits.',
    ],
  },
  overlap:
    'It would be dishonest to pretend these tools are far apart. They target the same buyer with the same core insight, and any agency would get value from either. The practical way to decide is to run the same search in both for a category and area you know well, then look at which list you would actually pick up the phone and work. A free plan makes that test easy on this side, and their trial makes it easy on theirs.',
  faqs: [
    {
      question: 'What is the real difference between LeadZipp and B2B Lead Finder?',
      answer:
        'The concept is the same, so the difference is in the execution. LeadZipp blends Google Places and Yelp listings, keeps a permanent free tier at 25 live searches a month, and is built around getting the list out into your CRM through integrations and, on Agency, a public API. They advertise a Google Maps scanner with a Kanban pipeline built into the product, which suits agencies that would rather work leads in one place.',
    },
    {
      question: 'Which one has better data?',
      answer:
        'Both read live local business listings, so the honest answer is that it depends on the category and the area, and you should test rather than trust either of us. LeadZipp reads Google Places and Yelp, which can surface businesses that appear in one source and not the other. Run one search you already know the answer to and judge from that.',
    },
    {
      question: 'Do both work outside the United States?',
      answer:
        'LeadZipp supports worldwide search by city, country and radius, and publishes guides for markets including the UK, Canada, Australia, Germany, France, the Netherlands, Spain, the UAE, Saudi Arabia and India. They publish location pages across a number of countries too. For any specific city, the only reliable check is to run the search.',
    },
    {
      question: 'Can I try LeadZipp before paying?',
      answer:
        'Yes. Free includes 25 new live searches a month and 5 welcome email credits with no card. Pro includes 100 live searches and 100 email credits per calendar month, and starts with a 7-day trial that carries 25 live searches and 20 email credits, requires a card, and charges nothing if you cancel before day 7.',
    },
  ],
  ctaHeading: 'Run the same search in both and compare',
}

export const COMPARISONS: ComparisonPage[] = [APOLLO, HUNTER, ZOOMINFO, B2BLEADFINDER]

const BY_SLUG = new Map(COMPARISONS.map((c) => [c.slug, c]))

export function getAllComparisonSlugs(): string[] {
  return COMPARISONS.map((c) => c.slug)
}

export function getComparison(slug: string): ComparisonPage | null {
  return BY_SLUG.get(slug) ?? null
}

export function getAllComparisonPaths(): string[] {
  return COMPARISONS.map((c) => `/compare/${c.slug}`)
}

export const COMPARE_INDEX_PATH = '/compare'
