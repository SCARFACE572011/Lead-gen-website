/**
 * Programmatic SEO data + copy composition for /leads/[slug].
 *
 * Two page families live in this module and share one URL space:
 *
 *   1. Category x US city   ->  /leads/plumbers-in-atlanta   (10 x 12 = 120)
 *   2. International city   ->  /leads/london-uk             (12)
 *
 * The hard requirement here is that no two generated pages read alike.
 * Thin, templated location pages get filtered by Google and would drag the
 * whole site down, so the copy is composed rather than templated:
 *
 *   - Every category carries hand-written angles, presence gaps, pitch
 *     points, buyer notes and FAQs. That content is genuinely different
 *     between a plumber and a law firm, not the same sentence with a noun
 *     swapped.
 *   - Every city carries hand-written metro framings, a competitiveness
 *     note, real neighborhoods and its own FAQ.
 *   - On top of that, several rotating pools (hooks, section headings,
 *     CTA copy, an optional third section, which six of eight benefit
 *     cards appear and in what order) are selected with a stable hash of
 *     the page slug, so the same page always builds identically but its
 *     neighbours in the grid pick different variants.
 *
 * Numbers: never invent a researched-sounding statistic. Data points are
 * phrased as observable patterns ("many independent plumbers still have no
 * website"), never as fabricated percentages.
 *
 * Style rule: no em dashes anywhere in this file's copy.
 */

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export interface Faq {
  question: string
  answer: string
}

export interface Card {
  title: string
  body: string
}

export interface LinkRef {
  href: string
  label: string
  sub: string
}

type Tokens = Record<string, string>

/** Replace {token} placeholders. Unknown tokens are left untouched. */
function fill(input: string, tokens: Tokens): string {
  return input.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(tokens, key) ? tokens[key] : match
  )
}

function fillCard(card: Card, tokens: Tokens): Card {
  return { title: fill(card.title, tokens), body: fill(card.body, tokens) }
}

function fillFaq(faq: Faq, tokens: Tokens): Faq {
  return { question: fill(faq.question, tokens), answer: fill(faq.answer, tokens) }
}

/** FNV-1a. Deterministic across builds, which SSG requires. */
function hash(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Stable pick from a pool. `tag` decorrelates pools that share a seed. */
function pick<T>(pool: readonly T[], seed: string, tag: string): T {
  return pool[hash(`${seed}::${tag}`) % pool.length]
}

/** Stable rotation: take `count` items starting at a hash-derived offset. */
function rotate<T>(pool: readonly T[], seed: string, tag: string, count: number): T[] {
  const start = hash(`${seed}::${tag}`) % pool.length
  const out: T[] = []
  for (let i = 0; i < Math.min(count, pool.length); i++) {
    out.push(pool[(start + i) % pool.length])
  }
  return out
}

/**
 * Stable subset: choose `count` of `pool` and shuffle them, keyed off the
 * slug. Unlike rotate() this varies both which items appear and the order
 * they appear in, which is what keeps same-category pages in different
 * cities from sharing a block of identical prose.
 */
function sample<T>(pool: readonly T[], seed: string, tag: string, count: number): T[] {
  return pool
    .map((value, i) => ({ value, key: hash(`${seed}::${tag}::${i}`) }))
    .sort((a, b) => a.key - b.key)
    .slice(0, Math.min(count, pool.length))
    .map((entry) => entry.value)
}

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

export interface CategoryDef {
  slug: string
  /** Title case plural, used in headings. */
  name: string
  /** Lowercase plural, used mid sentence. */
  plural: string
  /** Lowercase singular. */
  singular: string
  /** Title case singular, used in the search recipe card. */
  singularTitle: string
  /** The trade noun, e.g. "plumbing". */
  trade: string
  /** Three hand-written intro angles. One is chosen per city. */
  angles: string[]
  /** Four category-specific presence gaps. */
  gaps: Card[]
  buyerNote: string
  bestTime: string
  outreachHook: string
  sellFirst: string
  pitchPoints: string[]
  timingNote: string
  /** Two category-specific FAQs. */
  faqs: Faq[]
  /** Blog posts that fit this category best. */
  posts: string[]
}

export const CATEGORIES: CategoryDef[] = [
  {
    slug: 'plumbers',
    name: 'Plumbers',
    plural: 'plumbers',
    singular: 'plumber',
    singularTitle: 'Plumber',
    trade: 'plumbing',
    angles: [
      'Plumbing is bought in a panic. When a water heater lets go at six in the morning, nobody is comparing portfolios. They search, they tap the first number that looks legitimate, and the buying process is over. That makes visibility worth more to a {city} plumber than to almost any other trade, and it makes the invisible ones the easiest pitch you will make this week.',
      'Most plumbing companies in {city} are two trucks and a phone. The owner is under a sink at two in the afternoon, which is exactly why the website never got built, the Google profile never got claimed, and the reviews never got asked for. None of that is a budget problem. It is a time problem, and time is what you sell.',
      'The plumbing market in {city} splits cleanly in two. On one side, a handful of well marketed shops with call centers and wrapped vans. On the other, dozens of independents doing good work with nothing online to show for it. The second group is your list.',
    ],
    gaps: [
      {
        title: 'No website at all, just a map listing',
        body: 'A large share of independent plumbers never got past a Google Business Profile and a Facebook page. There is nowhere to send an estimate, nowhere to show licence and insurance details, and nothing that can rank for {trade} searches across {city}.',
      },
      {
        title: 'Nothing built for emergency intent',
        body: 'Even the plumbers who do have a site usually have a brochure. No visible service area, no call button that works one handed at six in the morning, no after hours message. Emergency traffic is the highest intent traffic in this trade and it bounces.',
      },
      {
        title: 'Reviews collected by accident',
        body: 'Ask a {city} plumber how they collect reviews and the honest answer is usually that they do not. Review count and rating drive map pack placement, so a shop doing excellent work sits below a competitor with half the skill and twice the reviews.',
      },
      {
        title: 'No proof of work published anywhere',
        body: 'Photos of finished repipes, water heater swaps and slab leak repairs sit in the owner camera roll. Nothing is published, so a homeowner holding three quotes has no reason to pick this one.',
      },
      {
        title: 'Service area guessed at, never stated',
        body: 'A homeowner on the edge of the {city} metro has no way to know whether this plumber will drive out. Publishing a service area is a fifteen minute change that recovers the calls nobody bothered to make.',
      },
      {
        title: 'One phone number and nothing behind it',
        body: 'When the owner is under a house the call goes to voicemail, and the caller dials the next result rather than waiting. No form, no text back, no after hours path, and the job is gone before he hears the phone ring.',
      },
    ],
    buyerNote: 'The owner, almost always. He is on a job site during the day and answers his own phone.',
    bestTime: 'Before 7:30am or after 5pm. A voicemail that names something specific on their listing gets returned.',
    outreachHook: 'Lead with the fact that they do not appear when somebody searches for an emergency plumber in their own neighborhood.',
    sellFirst: 'A single page emergency site with a call button and a clear service area, then review collection.',
    pitchPoints: [
      'Pull up the map pack for emergency plumbing in their area and show them where they sit in it.',
      'Point at a competitor with more reviews and less experience.',
      'Quote the first build as a fixed price project rather than a retainer. Trades buy projects.',
    ],
    timingNote: 'Cold snaps and heat waves both spike plumbing calls, and that is exactly when an owner is most aware of the calls they missed.',
    faqs: [
      {
        question: 'How many plumbers are there in {city}?',
        answer: 'LeadZipp does not guess at a number. It runs a live search against Google and Yelp listings for the {city} area and returns the plumbing businesses that are actually listed right now, so the count reflects your radius and your filters rather than a stale database figure. Widen the radius to pull in the surrounding suburbs, or tighten it to work one neighborhood at a time.',
      },
      {
        question: 'Which {city} plumbers should I call first?',
        answer: 'Sort by opportunity score and start at the top. The plumbers that rise are the ones with no website, a thin review count, or a rating that does not match the quality of their work. Those three signals tend to travel together, and they point at an owner who already knows something is wrong and has not had time to fix it.',
      },
    ],
    posts: ['find-local-businesses-without-a-website', 'how-to-get-web-design-clients'],
  },
  {
    slug: 'dentists',
    name: 'Dentists',
    plural: 'dentists',
    singular: 'dentist',
    singularTitle: 'Dentist',
    trade: 'dental',
    angles: [
      'Dental practices in {city} are not short on demand. They are short on new patients who found them by searching rather than by asking a friend. Most of them have a website, which is exactly why agencies skip the category. Look closer and the site is usually years old, slow on a phone, and missing the one thing that converts: a way to book.',
      'One new patient is worth more to a {city} practice over a few years than most agency retainers cost in a month. That arithmetic is why dental is one of the few local categories where the owner will happily pay for marketing, provided you can show them what they are currently losing.',
      'The dental market in {city} is full of practices that outgrew their marketing. The chair count went up, the vendor supplied template website did not change, and the front desk still takes every appointment by phone between nine and five.',
    ],
    gaps: [
      {
        title: 'A vendor template, not a website',
        body: 'Plenty of {city} practices run a site supplied by a practice management or dental marketing vendor. The layout, the copy and the stock photography are shared with hundreds of other clinics, so there is nothing on the page that helps it rank or that sounds like this practice.',
      },
      {
        title: 'No way to book outside office hours',
        body: 'Prospective patients search in the evening. If the only path forward is a phone number answered from nine to five, the practice loses the people who were ready to commit. Online scheduling is the easiest single upgrade to sell a dentist.',
      },
      {
        title: 'Insurance and cost questions unanswered',
        body: 'The two questions every new dental patient has are whether their plan is accepted and what the visit will cost. Most practice sites answer neither, so the visitor leaves to check a competitor that does.',
      },
      {
        title: 'Reviews far below patient volume',
        body: 'A practice seeing dozens of patients a week with a couple of dozen lifetime reviews has a collection problem, not a satisfaction problem. That gap is visible in the search results and easy to demonstrate on a call.',
      },
      {
        title: 'The new patient path buried under the fold',
        body: 'Existing patients and prospective ones want completely different things from a practice site. Most {city} sites are built for the people who already come, which means the visitor worth the most gets served the worst.',
      },
      {
        title: 'No photographs of the actual practice',
        body: 'Anxiety is the real obstacle in dental. Stock imagery of models does nothing about it, while honest photographs of the rooms, the team and the equipment do a large share of the selling before anyone picks up a phone.',
      },
    ],
    buyerNote: 'The practice owner decides. The office manager controls the calendar, the phone and your access.',
    bestTime: 'Mid morning or early afternoon, and expect to be routed through the front desk at least once.',
    outreachHook: 'Ask what happens when a new patient tries to book at nine in the evening.',
    sellFirst: 'Online scheduling and a plain insurance page, then a rebuild if the vendor template is the real constraint.',
    pitchPoints: [
      'Compare their review count with the practice two blocks away.',
      'Load their site on a phone while you are on the call and read the loading time out loud.',
      'Price the work against the value of two new patients, not against a website.',
    ],
    timingNote: 'January and the final quarter both move, because dental benefits reset in one and expire in the other.',
    faqs: [
      {
        question: 'Do {city} dental practices need help if they already have a website?',
        answer: 'Having a website and having a website that produces new patients are different things. Filter the {city} list for practices that do have a site, then open a few on a phone. Dated vendor templates, no online booking and no insurance information are extremely common, and they are much easier to sell against than a blank page, because the owner already believes in the channel.',
      },
      {
        question: 'How do I get past the front desk at a {city} practice?',
        answer: 'Be specific and be brief. Reference something visible on their own listing, ask for the practice owner by name if it is published, and offer a two minute call rather than a meeting. LeadZipp hands you the phone number, the website and the review profile before you dial, which is usually enough to earn the transfer.',
      },
    ],
    posts: ['lead-scoring-explained', 'cold-email-templates-local-business-outreach'],
  },
  {
    slug: 'hair-salons',
    name: 'Hair Salons',
    plural: 'hair salons',
    singular: 'salon',
    singularTitle: 'Hair Salon',
    trade: 'salon',
    angles: [
      'Salons in {city} live on social. The work is beautiful, the feed is active, and there is often no website at all. Booking happens in direct messages, which means the owner is doing reception work at eleven at night and quietly losing the clients who did not feel like messaging a stranger.',
      'Hair salons are the category where having no website is most often a deliberate choice rather than an oversight. The owner is not convinced a site would do anything a social profile does not already do. Your pitch is not a website. It is booked chairs and fewer no shows.',
      'Walk any commercial street in {city} and you will pass three or four salons. Their prices, hours and service menus are almost never published anywhere a search engine can read them, which is why the chains take the top of every salon search in the metro.',
    ],
    gaps: [
      {
        title: 'Booking lives in the direct messages',
        body: 'Appointments arrive as messages, texts and calls the stylist cannot answer while she has someone in the chair. Every one of those is a delay, and delays become bookings at whichever salon replied first.',
      },
      {
        title: 'No service menu a search engine can read',
        body: 'Prices and services are usually posted as an image, or not at all. Search engines cannot read a price list baked into a photo, so the salon never surfaces for the specific services it most wants to be known for.',
      },
      {
        title: 'Hours and closures drift out of date',
        body: 'Salon hours move with the season and the stylist roster. When the listing shows the wrong hours, the walk in traffic goes elsewhere and the owner never finds out why.',
      },
      {
        title: 'Booth renters fragment the brand',
        body: 'When every chair markets itself, the salon brand gets diluted and no single profile accumulates the reviews that would lift it in local results.',
      },
      {
        title: 'Nothing about the stylists themselves',
        body: 'Clients choose a person, not a business. A salon page that never names its stylists or shows their individual work throws away the only real differentiator it has in a market the size of {city}.',
      },
      {
        title: 'No path from a photograph to a booking',
        body: 'The work gets seen, admired and then forgotten, because there is no next step attached to it. One link from the feed to a booking page turns an audience that already exists into appointments.',
      },
    ],
    buyerNote: 'The owner is usually also a stylist and is behind a chair for most of the day.',
    bestTime: 'Monday, or the first hour of the day, when the salon is closed or quiet.',
    outreachHook: 'Ask how many booking messages they answer after closing time.',
    sellFirst: 'A one page site with a readable service menu and a booking link, then the listing cleanup.',
    pitchPoints: [
      'Show them what their salon looks like in a phone search from two streets away.',
      'Count the steps between a social post and a booked appointment out loud.',
      'Keep the first project small and fixed price. Salon owners decide quickly when the number is clear.',
    ],
    timingNote: 'Wedding season and the run into the holidays are the two windows when a salon feels booking pressure most sharply.',
    faqs: [
      {
        question: 'Most {city} salons run everything on social. Is that a problem for me or for them?',
        answer: 'It is an opening. A salon with an active social presence has already proved it cares how it looks and will engage with customers, so you are not selling the idea of marketing. What it does not have is anything that appears in a salon search or that takes a booking while the owner has a client in the chair. That is a narrow, concrete gap and it is easy to explain in one sentence.',
      },
      {
        question: 'What should I charge a salon in {city}?',
        answer: 'Salons are price sensitive and fast to decide. A small fixed price build with a single clear outcome, usually online booking, closes far more often than a retainer proposal. Because the list gives you every salon in an area at once, you can book several in the same neighborhood and let volume rather than ticket size carry the month.',
      },
    ],
    posts: ['find-local-businesses-without-a-website', 'prospect-local-clients-by-zip-code'],
  },
  {
    slug: 'restaurants',
    name: 'Restaurants',
    plural: 'restaurants',
    singular: 'restaurant',
    singularTitle: 'Restaurant',
    trade: 'restaurant',
    angles: [
      'Restaurants in {city} run the thinnest margins on this list and have the most to gain from owning their own ordering. Every delivery order placed through a marketplace carries a cut the owner never sees again. A direct ordering page is the rare local marketing pitch that pays for itself in weeks and can be argued in numbers.',
      'The menu is the product, and in most {city} restaurants the menu online is a photo or a PDF that pinches and zooms badly on a phone. That one file costs more covers than any advertising decision the owner has ever made.',
      'Restaurant owners in {city} are the busiest prospects you will call and the most decisive once you catch them. Reach them between lunch and dinner service, open with something a competitor down the street is doing, and you will get a straight answer either way.',
    ],
    gaps: [
      {
        title: 'The menu is an image or a PDF',
        body: 'Menus posted as photos or PDF files are painful on a phone and invisible to search. A restaurant with a plain web menu can rank for the dishes it actually sells. Very few in {city} do.',
      },
      {
        title: 'Marketplaces own the customer',
        body: 'Delivery platforms bring volume and take the customer relationship along with the commission. A direct ordering option is the clearest revenue argument you can put in front of an independent restaurant.',
      },
      {
        title: 'Hours that do not match reality',
        body: 'Holiday hours, patio season and a quiet Monday rarely make it onto the listing. Every wrong hour is a customer who drove over and found the door locked, and they do not come back to check.',
      },
      {
        title: 'No reservation or waitlist path',
        body: 'For anything above fast casual, a visitor who cannot hold a table in two taps checks the next result instead. Most independent restaurant sites still ask people to phone.',
      },
      {
        title: 'Photographs taken by customers, not the kitchen',
        body: 'The images representing a {city} restaurant online are usually whatever a diner uploaded in bad light. The owner has often never published a single controlled photograph of their own food.',
      },
      {
        title: 'No email list, ever',
        body: 'A restaurant serves hundreds of happy people a week and has no way to reach any of them again. A list built quietly off the ordering page is the cheapest marketing asset in the business.',
      },
    ],
    buyerNote: 'The owner or the general manager, and both are on the floor during service.',
    bestTime: 'Between two and four in the afternoon, the only quiet hour in a restaurant day.',
    outreachHook: 'Open their menu on your phone while you talk and describe exactly what you are seeing.',
    sellFirst: 'A readable web menu and a direct ordering link, then the listing and photos.',
    pitchPoints: [
      'Do the commission arithmetic on a month of marketplace orders out loud.',
      'Show the menu PDF failing on a phone screen. It lands harder than any slide.',
      'Offer to correct the listing hours first, free, as proof you are competent.',
    ],
    timingNote: 'The weeks before a holiday season and the start of patio season are when owners are thinking hardest about volume.',
    faqs: [
      {
        question: 'Are {city} restaurants a good market for web work?',
        answer: 'They are a good market for one specific kind of web work. Menu and ordering pages carry a direct revenue argument, which is not true of a brochure site, so the conversation is about money rather than design taste. Filter for independents rather than chains, because a franchise location almost never controls its own site or its own budget.',
      },
      {
        question: 'When can I actually reach a restaurant owner in {city}?',
        answer: 'Mid afternoon, between lunch and dinner service. Calling during a service window wastes the call and damages the relationship before it starts. Your list carries the phone number and the street address, so you can plan a route and walk in during that same quiet window if you would rather do it face to face.',
      },
    ],
    posts: ['local-lead-generation-guide', 'cold-email-templates-local-business-outreach'],
  },
  {
    slug: 'roofing-contractors',
    name: 'Roofing Contractors',
    plural: 'roofing contractors',
    singular: 'roofing contractor',
    singularTitle: 'Roofing Contractor',
    trade: 'roofing',
    angles: [
      'Roofing carries the highest ticket value on this list, which means a {city} contractor can justify real marketing spend out of a single extra job. It also means the category is crowded with contractors who buy shared leads and resent every dollar of it. Owning the pipeline is a pitch they have already had with themselves.',
      'Ask a {city} roofing contractor where their work comes from and most will name a lead marketplace. They are paying per lead, competing with three other contractors on the same homeowner, and they know it is a bad trade. Show them what an owned funnel looks like and you have their attention for ten minutes.',
      'Storm work pulls out of town crews into {city} every season. Local roofers lose those jobs on speed and visibility rather than on quality. That is a marketing problem, and it is the one you solve.',
    ],
    gaps: [
      {
        title: 'Renting leads instead of owning them',
        body: 'Shared lead marketplaces sell the same homeowner to several contractors. The roofer pays either way and closes maybe one in four. Every conversation about an owned site and local ranking starts from that frustration, which means you are not creating the need.',
      },
      {
        title: 'No project gallery, no proof',
        body: 'Roofing is sold on trust, and a homeowner comparing bids wants to see finished work, real crews and a clean site at the end. Most contractor pages in {city} show stock photography of roofs nobody on the team has touched.',
      },
      {
        title: 'Financing never mentioned',
        body: 'A full replacement is a five figure decision. Contractors who show financing options convert homeowners who would otherwise stall for a season. Most sites do not mention it anywhere.',
      },
      {
        title: 'Nothing ready for storm response',
        body: 'After a wind or hail event the searches spike for a few weeks. Contractors without a page ready for that moment watch the traffic land on whoever does.',
      },
      {
        title: 'Service area and licence details missing',
        body: 'Homeowners in {city} are careful about roofers for good reason. A page that never states where the company works or what it carries invites that caution instead of answering it.',
      },
      {
        title: 'Reviews that stop three years ago',
        body: 'A profile whose newest review is old reads as a business that has slowed down. Contractors with plenty of work often look inactive online purely because nobody asks the homeowner at the end of the job.',
      },
    ],
    buyerNote: 'The owner, and often a sales lead who runs the estimates.',
    bestTime: 'Early morning before crews roll out, or Friday afternoon.',
    outreachHook: 'Ask what they pay per shared lead and what share of those they actually close.',
    sellFirst: 'An owned lead page with a real project gallery, then local ranking work.',
    pitchPoints: [
      'Put the cost of shared leads next to the cost of a month of your work.',
      'Show a competitor gallery beside their stock photography.',
      'Raise financing. It is usually missing and it moves close rates.',
    ],
    timingNote: 'Demand follows the weather. The weeks after a serious wind or hail event in {city} are when being visible pays for the year.',
    faqs: [
      {
        question: 'How do I compete with the lead marketplaces {city} roofers already use?',
        answer: 'You are not competing with them. You are offering the alternative the contractor already complains about needing. Shared leads go to several contractors at once, so the roofer pays to compete on price. An owned page, a real gallery and local ranking produce enquiries that belong only to them. That contrast is the entire pitch and you rarely have to argue it twice.',
      },
      {
        question: 'Is roofing worth targeting outside storm season in {city}?',
        answer: 'Yes, and it is usually easier. During a storm response the phones are chaos and nobody will take your call. In the quieter weeks a contractor has time to look at their own website and enough recent frustration to act on what they see. Build in the quiet season so they are ready for the busy one.',
      },
    ],
    posts: ['how-to-get-web-design-clients', 'lead-scoring-explained'],
  },
  {
    slug: 'auto-repair-shops',
    name: 'Auto Repair Shops',
    plural: 'auto repair shops',
    singular: 'auto repair shop',
    singularTitle: 'Auto Repair Shop',
    trade: 'auto repair',
    angles: [
      'Independent auto shops in {city} compete against dealership service departments with real marketing budgets. The independents usually win on price and honesty and lose on visibility. Closing that one gap is a straightforward, provable win and the owner can feel it within a month.',
      'Most drivers choose a mechanic the way they choose a plumber. They search once, under pressure, and stay with whoever they found. A {city} shop that does not surface in that first search is invisible for years at a time, not just for one job.',
      'Auto repair is one of the few local categories where the same customer returns three or four times a year. That lifetime value makes a shop owner in {city} unusually receptive to anything that reliably brings first time customers through the door.',
    ],
    gaps: [
      {
        title: 'A parts supplier template, or nothing',
        body: 'Many shops run a free site provided by a parts network, shared with thousands of other shops across the country. It looks tidy and it ranks for nothing, because there is no unique content anywhere on it.',
      },
      {
        title: 'No service pages to rank with',
        body: 'Drivers search for brake repair, check engine diagnostics, transmission service and timing belts by name. A shop with one generic services page cannot rank for any of them, while a competitor with a page per service quietly takes them all.',
      },
      {
        title: 'Appointments by phone only',
        body: 'The shop is loud, the phone gets missed, and the customer moves on. An appointment request form takes an afternoon to add and catches the jobs that a dropped call loses.',
      },
      {
        title: 'No trust signals in a distrusted trade',
        body: 'Certifications, warranty terms and photographs of a clean shop matter more in auto repair than in almost any other category. Most {city} shop sites show none of them.',
      },
      {
        title: 'Nothing about what the shop specializes in',
        body: 'Every shop has work it wants and work it tolerates. Almost none of them say which is which, so the phone brings in the wrong jobs while the profitable ones go to a competitor who was specific.',
      },
      {
        title: 'Drop off and waiting arrangements unclear',
        body: 'Drivers plan their day around a repair. If the page does not say whether there is a key drop, a loaner or a shuttle, a {city} shop quietly loses everyone who cannot spend a morning in a waiting room.',
      },
    ],
    buyerNote: 'The owner or the service manager, usually the same person in an independent shop.',
    bestTime: 'Mid morning, once the first wave of drop offs is done.',
    outreachHook: 'Search a specific repair plus their neighborhood and tell them who came up instead of them.',
    sellFirst: 'Service pages for the repairs they want more of, plus an appointment request form.',
    pitchPoints: [
      'Name the repairs they make the best margin on and show that they rank for none of them.',
      'Point out that the dealership service department outranks them in their own city.',
      'Frame it as catching calls they already miss rather than as new advertising.',
    ],
    timingNote: 'Season changes and the start of road trip season both push repair searches up sharply.',
    faqs: [
      {
        question: 'What do independent auto shops in {city} actually buy?',
        answer: 'Service pages, appointment forms and review collection, roughly in that order. Shop owners respond to concrete outcomes such as catching the calls they currently miss. Large redesign proposals rarely land, because the owner cannot connect them to a car in a bay. Small provable improvements do land, and they open the door to the larger work later.',
      },
      {
        question: 'How do I qualify a {city} auto shop before I call?',
        answer: 'Check three fields on the list. Whether there is a website at all, how many reviews the shop has, and whether the rating sits above or below the shops around it. A shop with a strong rating and few reviews is doing good work with no marketing behind it, which is the best possible profile for a first conversation.',
      },
    ],
    posts: ['prospect-local-clients-by-zip-code', 'find-local-businesses-without-a-website'],
  },
  {
    slug: 'landscapers',
    name: 'Landscapers',
    plural: 'landscapers',
    singular: 'landscaper',
    singularTitle: 'Landscaper',
    trade: 'landscaping',
    angles: [
      'Landscaping in {city} runs on a season, and the whole year gets decided in the few weeks before it starts. A landscaper with no way to capture quote requests in that window spends the following eight months chasing work he could have booked in three.',
      'Landscaping is the most visual trade on this list and the worst at showing its work. Before and after photographs sit in a phone camera roll while the business card still says call for a quote.',
      'Most {city} landscapers are a truck, a trailer and a word of mouth network that stopped growing two years ago. They are not resistant to marketing. Nobody has ever shown them what it would look like.',
    ],
    gaps: [
      {
        title: 'Portfolio trapped on a personal profile',
        body: 'The best work gets posted to the owner personal social account, where it reaches friends and family and nobody at all who is searching for a landscaper in {city}.',
      },
      {
        title: 'No quote request path',
        body: 'Every job starts with an estimate and every estimate starts with a request. Without a form, the business only grows as fast as the owner can answer his phone between jobs.',
      },
      {
        title: 'Service area left vague',
        body: 'Homeowners want to know whether a crew comes to their street. Landscapers who never publish a service area lose calls from neighborhoods they would happily drive to.',
      },
      {
        title: 'Maintenance contracts never sold online',
        body: 'Recurring maintenance is the revenue that makes a landscaping business stable through the year. Almost none of them present it as a plan a customer can actually sign up for.',
      },
      {
        title: 'No pricing signal of any kind',
        body: 'Homeowners want a rough idea before they invite somebody into the garden. A page that gives no range at all filters out the serious enquiries just as effectively as it filters out the tyre kickers.',
      },
      {
        title: 'Seasonal services never listed separately',
        body: 'Spring cleanup, irrigation and leaf removal are separate searches with separate demand across {city}. A single undifferentiated services page competes for none of them.',
      },
    ],
    buyerNote: 'The owner, who is on a crew most days and writes estimates in the evening.',
    bestTime: 'Early evening, or the first warm week of the year when the phone is already ringing.',
    outreachHook: 'Ask where their job photographs live and what happens to a quote request that arrives at nine at night.',
    sellFirst: 'A portfolio page with real before and after work, and a quote form that lands on their phone.',
    pitchPoints: [
      'Show them the work they already photographed and where it is currently buried.',
      'Sell maintenance plans as recurring revenue, not as a website feature.',
      'Time the pitch to the front of the season, when the budget still feels available.',
    ],
    timingNote: 'Late winter into early spring is when {city} landscapers sign the contracts that carry the rest of the year.',
    faqs: [
      {
        question: 'When is the best time to pitch landscapers in {city}?',
        answer: 'Late winter and early spring, before the season starts. That is when contracts get signed and when the budget still feels available. Pitching in the middle of peak season means competing with a crew schedule for the owner attention, and you will lose that competition every time.',
      },
      {
        question: 'Do landscapers in {city} really have no websites?',
        answer: 'Many of the smaller crews do not, and it shows up immediately in the list. Filter for no website and you will find owners running an entire business from a phone. That is not a sign of a weak business. It is usually a sign of a busy one that never had a spare fortnight, which is a much better prospect than a failing company.',
      },
    ],
    posts: ['find-local-businesses-without-a-website', 'how-to-get-web-design-clients'],
  },
  {
    slug: 'hvac-contractors',
    name: 'HVAC Contractors',
    plural: 'HVAC contractors',
    singular: 'HVAC contractor',
    singularTitle: 'HVAC Contractor',
    trade: 'HVAC',
    angles: [
      'HVAC demand in {city} arrives in spikes. The first serious heat or the first hard freeze fills every phone line in the metro for a week. Contractors who are not visible in those weeks miss most of their year in a handful of days and never see the traffic that went elsewhere.',
      'A large share of {city} HVAC companies run a manufacturer dealer website. It is free, it looks professional, and it is close to identical to the sites of every other dealer in the region, which is precisely why it ranks for nothing.',
      'The money in HVAC is not the emergency call. It is the maintenance agreement and the eventual system replacement. Contractors know this perfectly well. Very few of them have any online path to either one.',
    ],
    gaps: [
      {
        title: 'A dealer template shared with the whole network',
        body: 'Manufacturer supplied dealer sites carry near duplicate content across hundreds of contractors. There is nothing unique for a search engine to rank and nothing on the page that sounds like a local business in {city}.',
      },
      {
        title: 'Maintenance plans invisible online',
        body: 'The recurring revenue that keeps an HVAC company steady is sold in person or not at all. A plan signup page turns every service call into a subscription conversation instead of a one off invoice.',
      },
      {
        title: 'No financing on a five figure decision',
        body: 'System replacement is a major purchase and financing changes the answer. Contractors who bury it, or omit it, lose the homeowners who needed to hear it first.',
      },
      {
        title: 'Peak season traffic with nowhere to land',
        body: 'When the weather turns in {city}, the searches come. Without an emergency service page and a working call button, that traffic goes straight to a competitor who prepared for it.',
      },
      {
        title: 'No equipment or brand information anywhere',
        body: 'Homeowners research systems before they research contractors. A page that never mentions which equipment the company installs and services misses every one of those searches entirely.',
      },
      {
        title: 'Emergency and planned work look identical',
        body: 'A visitor with no heat at eleven at night and one planning a replacement in the spring need completely different pages. Most contractors in {city} offer them exactly the same one.',
      },
    ],
    buyerNote: 'The owner or the general manager. Larger shops sometimes have a dedicated marketing contact.',
    bestTime: 'Shoulder season, when the phones are not on fire and the owner can hold a conversation.',
    outreachHook: 'Ask how their dealer site is different from every other dealer site in {city}.',
    sellFirst: 'A replacement for the dealer template, then maintenance plan signup and financing.',
    pitchPoints: [
      'Show them two other local dealers running the same website as theirs.',
      'Frame maintenance plans as the recurring revenue the business is missing.',
      'Get the work delivered before peak season rather than during it.',
    ],
    timingNote: 'The first heat wave and the first hard freeze decide most of an HVAC year in {city}.',
    faqs: [
      {
        question: 'How do I tell a good HVAC prospect in {city} from a bad one?',
        answer: 'Look for a real business with reviews and a weak or duplicated web presence. A contractor with a manufacturer dealer template, a decent rating and no maintenance plan page is a strong prospect, because the need is visible and the budget exists. A contractor with no reviews at all is usually too new to spend anything, and chasing them costs you the week.',
      },
      {
        question: 'Does the {city} climate change how I should pitch HVAC?',
        answer: 'It changes the timing more than the pitch. Sell in the shoulder seasons, deliver before the peak, and frame everything around being visible in the first week the weather turns. Contractors understand that calendar better than any marketer does, so speaking in it immediately signals that you know the trade.',
      },
    ],
    posts: ['lead-scoring-explained', 'local-lead-generation-guide'],
  },
  {
    slug: 'chiropractors',
    name: 'Chiropractors',
    plural: 'chiropractors',
    singular: 'chiropractor',
    singularTitle: 'Chiropractor',
    trade: 'chiropractic',
    angles: [
      'Chiropractic in {city} is a referral business trying to become a search business. The practices that made the jump are booked out weeks ahead. The ones that did not are still hoping the phone rings, and they are the ones sitting at the top of your list.',
      'A chiropractor is usually the owner, the practitioner and the marketing department at once. That means a very short decision chain and a very small window to reach them, because they are in treatment rooms for most of the day.',
      'People searching for a {city} chiropractor are searching for a problem, not a profession. They type in back pain, sciatica or a car accident. Practice sites that only say chiropractic care never appear in any of those results.',
    ],
    gaps: [
      {
        title: 'Condition pages missing entirely',
        body: 'Patients search by symptom. A practice with no pages about sciatica, neck pain or accident recovery cannot appear for the searches that actually produce new patients in {city}.',
      },
      {
        title: 'No new patient offer',
        body: 'Almost every busy practice runs a first visit offer of some kind. Practices without one give a hesitant patient no reason at all to choose today over next month.',
      },
      {
        title: 'Scheduling by phone during treatment hours',
        body: 'The person answering the phone is often also treating patients. Online scheduling captures the bookings that a missed call quietly loses.',
      },
      {
        title: 'A site that has not changed in years',
        body: 'Chiropractic sites age badly. Slow loading, tiny tap targets and a contact form that fails on a phone are common, and all three are easy to demonstrate live on a call.',
      },
      {
        title: 'Insurance and payment left unexplained',
        body: 'New patients hesitate over cost far more than over care. A {city} practice that does not address insurance and payment up front loses people at exactly the moment they were closest to booking.',
      },
      {
        title: 'No sense of the practitioner as a person',
        body: 'Chiropractic is physical and personal, and patients choose somebody they feel they can trust with their spine. A site with no photograph, no biography and no voice makes that choice harder than it needs to be.',
      },
    ],
    buyerNote: 'The practitioner owns the practice and makes the decision, with a front desk in between.',
    bestTime: 'The lunch hour or the end of the day, in the gaps between patient blocks.',
    outreachHook: 'Search a symptom plus {city} and show them who ranks for it.',
    sellFirst: 'Condition pages and online scheduling, then a new patient offer to convert them.',
    pitchPoints: [
      'Show that patients search by symptom and their site never mentions a single one.',
      'Load the current site on a phone and time it while they listen.',
      'Anchor the price to the lifetime value of a handful of new patients.',
    ],
    timingNote: 'The new year and the weeks after the holidays bring a wave of people finally dealing with pain they ignored.',
    faqs: [
      {
        question: 'Why do chiropractors in {city} make good prospects?',
        answer: 'Short decision chain, high patient lifetime value, and a category where symptom based search demand is large and mostly uncontested by the practices themselves. One practitioner can approve the work in a single conversation, which removes the committee problem that slows down every other healthcare category.',
      },
      {
        question: 'What is the fastest win for a {city} chiropractic practice?',
        answer: 'Pages for the conditions patients actually search for, plus online scheduling. Both are visible improvements you can deliver in weeks rather than months, and both produce a number the practitioner can see. That makes the second engagement far easier to sell than the first.',
      },
    ],
    posts: ['lead-scoring-explained', 'cold-email-templates-local-business-outreach'],
  },
  {
    slug: 'law-firms',
    name: 'Law Firms',
    plural: 'law firms',
    singular: 'law firm',
    singularTitle: 'Law Firm',
    trade: 'legal',
    angles: [
      'Solo and small law firms in {city} carry the largest value per client of anything on this list, and often the thinnest websites. A single retained matter can outweigh a year of marketing spend, which changes the entire economics of your proposal before you have written it.',
      'Most small {city} firms run on directory profiles and referrals. The directory ranks, the firm does not, and the firm pays the directory for the privilege. That is a familiar frustration and a very good place to open.',
      'Legal searches are urgent and specific. Somebody looking for a {city} attorney types the problem rather than the practice area, and calls one of the first firms that answers. Firms without practice specific pages and a fast intake path never enter the consideration set at all.',
    ],
    gaps: [
      {
        title: 'One page covering every practice area',
        body: 'A firm handling family, criminal and estate matters on a single page competes for none of them. Practice area pages are the highest leverage change most small {city} firms can make, and almost none have made it.',
      },
      {
        title: 'Directories outranking the firm itself',
        body: 'Legal directories dominate the results, and many firms rank below their own listing on somebody else site. Owning the branded search is a fast, visible first win.',
      },
      {
        title: 'Intake that depends on somebody answering',
        body: 'Legal enquiries do not wait. A firm with no after hours intake, no callback commitment and no form loses matters to whichever firm picked up first.',
      },
      {
        title: 'Copy written for other lawyers',
        body: 'Practice pages full of statute references and formal language do not convert somebody in a stressful moment. Rewriting for the client rather than for the profession is a service most firms have never been offered.',
      },
      {
        title: 'No visible sense of the work they take',
        body: 'Prospective clients want evidence that a {city} firm has handled something like their situation. Where confidentiality allows it, published case types do more convincing than any amount of general description.',
      },
      {
        title: 'Response time never mentioned',
        body: 'Somebody in a legal emergency is calling several firms in a row. A published commitment on how quickly the firm responds, even a modest one, wins the client who is comparing three at once.',
      },
    ],
    buyerNote: 'The managing partner in a small firm, or the office administrator in a slightly larger one.',
    bestTime: 'Early morning before court, or late afternoon once the day calms down.',
    outreachHook: 'Search their firm name and show them which directory outranks their own website.',
    sellFirst: 'Practice area pages and a faster intake path, then content and local ranking.',
    pitchPoints: [
      'Show a directory profile sitting above their own site in the results.',
      'Ask what happens to an enquiry that arrives at eight on a Friday evening.',
      'Anchor to the value of one retained matter, which makes most proposals look small.',
    ],
    timingNote: 'Small firms review marketing at the start of a quarter far more often than at any other point.',
    faqs: [
      {
        question: 'Are small law firms in {city} worth the effort?',
        answer: 'Per client they are the highest value category on this list. A single retained matter can be worth more than an entire engagement costs, so a partner who believes your work will produce even a few extra enquiries has a very easy decision to make. The work is in getting to that belief, which is why the specific homework matters so much here.',
      },
      {
        question: 'How do I approach a {city} attorney without sounding like every other cold call?',
        answer: 'Do one specific piece of homework before you dial. Search the firm name and note which directory outranks their own site, or find the practice area they clearly want more of and show that no page on the site targets it. Specifics buy you past the first ten seconds, and the list gives you everything you need to find one in about a minute.',
      },
    ],
    posts: ['how-to-get-web-design-clients', 'cold-email-templates-local-business-outreach'],
  },
]

/* ------------------------------------------------------------------ */
/* US cities                                                           */
/* ------------------------------------------------------------------ */

export interface UsCityDef {
  slug: string
  name: string
  state: string
  stateCode: string
  /** Two hand-written metro framings. One is chosen per category. */
  framings: string[]
  competitiveness: string
  areas: string[]
  radiusMiles: number
  /** One city-specific FAQ, category tokens available. */
  faq: Faq
}

export const US_CITIES: UsCityDef[] = [
  {
    slug: 'atlanta',
    name: 'Atlanta',
    state: 'Georgia',
    stateCode: 'GA',
    framings: [
      'Atlanta is a metro of submarkets. The city proper holds a fraction of the population and the businesses you want are spread across a ring of suburbs that behave like separate towns. That works in your favour, because a search centered on Buckhead returns a completely different list of {cats} than one centered on Marietta.',
      'Traffic shapes commerce in Atlanta. Homeowners hire inside their own quadrant of the metro, so local service businesses compete within a fairly tight geography even though the region is enormous. Work Atlanta one submarket at a time rather than treating it as a single market and your {cat} list stays workable.',
    ],
    competitiveness:
      'Atlanta has a large agency scene, so the well marketed businesses here are marketed very well indeed. The independents out in the perimeter counties are far less contested.',
    areas: ['Buckhead', 'Decatur', 'Marietta', 'Sandy Springs', 'Alpharetta', 'Smyrna', 'East Point'],
    radiusMiles: 25,
    faq: {
      question: 'How should I set the radius for an Atlanta search?',
      answer: 'Start at around 15 miles from a specific submarket rather than running one 40 mile sweep over the whole metro. Atlanta suburbs behave like separate markets, so a tight radius around Marietta or Alpharetta returns a list of {cats} you can genuinely work in a week, and you can move the pin to the next area once you have finished.',
    },
  },
  {
    slug: 'dallas',
    name: 'Dallas',
    state: 'Texas',
    stateCode: 'TX',
    framings: [
      'Dallas is one half of a two city metro and most of the growth is happening in the ring around both. Plano, Frisco and McKinney add businesses faster than many metros add residents, which means the list of {cats} you pull today is not the list you would have pulled last year.',
      'The Dallas side of the metroplex is dense with small service businesses chasing new construction. New neighborhoods create new demand, and the {cats} chasing it are usually too busy to build the marketing that would let them chase it properly.',
    ],
    competitiveness:
      'Marketing services are sold hard in Dallas, so expect prospects to have been pitched before. Specificity is the only thing that separates you from the last three calls they took.',
    areas: ['Plano', 'Frisco', 'Irving', 'Richardson', 'Garland', 'McKinney', 'Oak Cliff'],
    radiusMiles: 25,
    faq: {
      question: 'Should I search Dallas and Fort Worth together?',
      answer: 'No. Run them as separate territories. The metroplex is wide enough that a single search centered between the two cities spends half its radius on the empty space in the middle. Search Dallas, then Plano, then Fort Worth as three lists and you will cover the region properly without wasting calls on {cats} nobody will drive to.',
    },
  },
  {
    slug: 'houston',
    name: 'Houston',
    state: 'Texas',
    stateCode: 'TX',
    framings: [
      'Houston is physically enormous and famously unzoned, so commercial and residential sit side by side across the whole region. Service businesses here cover long distances, and a 25 mile radius still leaves most of the metro untouched.',
      'Heat, humidity and heavy rain define the Houston home service market. Air conditioning, plumbing and roofing all carry year round urgency here, and the {cats} serving that demand rarely have marketing that matches it.',
    ],
    competitiveness:
      'Houston size works in your favour. There is more small business here than the local agency market can service, and whole suburbs go completely unworked.',
    areas: ['Katy', 'Sugar Land', 'The Woodlands', 'Pearland', 'Spring', 'Pasadena', 'Bellaire'],
    radiusMiles: 25,
    faq: {
      question: 'Houston is huge. How do I cover it without duplicating leads?',
      answer: 'Work it as a set of centered searches rather than one metro sweep, and save each one. LeadZipp keeps your search history, so you can move from Katy to Sugar Land to Pearland without reading the same {cats} twice, and the saved list tells you exactly where you left off when you pick it back up.',
    },
  },
  {
    slug: 'phoenix',
    name: 'Phoenix',
    state: 'Arizona',
    stateCode: 'AZ',
    framings: [
      'Phoenix is laid out on a grid across a flat valley, which makes territory planning unusually simple. A radius search here covers close to what it says it covers, unlike metros where a river or a ridge cuts the map in half and half your list is unreachable.',
      'The Valley has absorbed an enormous amount of inbound migration, and new residents choose service providers by searching rather than by reputation. That is a structural advantage for any {cat} you get ranking and a structural problem for the ones nobody can find.',
    ],
    competitiveness:
      'Scottsdale and central Phoenix businesses are marketed hard. The outer valley cities are a considerably softer market.',
    areas: ['Scottsdale', 'Mesa', 'Tempe', 'Chandler', 'Glendale', 'Gilbert', 'Peoria'],
    radiusMiles: 25,
    faq: {
      question: 'Which part of the Phoenix valley should I start with?',
      answer: 'Start outside Scottsdale. Central Phoenix and Scottsdale businesses field the most agency outreach in the metro and the owners have heard your opening line before. Mesa, Glendale, Peoria and the western valley carry similar business density with far less competition for the owner attention.',
    },
  },
  {
    slug: 'chicago',
    name: 'Chicago',
    state: 'Illinois',
    stateCode: 'IL',
    framings: [
      'Chicago is a city of neighborhoods, and local businesses here are loyal to a few square blocks rather than to a metro. A five mile radius around Logan Square is a real, workable territory, which is not true in most cities on this list.',
      'The housing stock in Chicago is old, and old buildings generate steady work for the trades. Demand for {cats} here does not depend on new construction the way it does in the Sun Belt metros, which makes the market less cyclical and the businesses more established.',
    ],
    competitiveness:
      'The Loop and the North Side are heavily marketed. Neighborhoods further out and the near suburbs are considerably more open.',
    areas: ['Lincoln Park', 'Logan Square', 'Pilsen', 'Evanston', 'Oak Park', 'Naperville', 'Cicero'],
    radiusMiles: 15,
    faq: {
      question: 'Does a small radius really work in Chicago?',
      answer: 'It works better than a large one. Chicago businesses and Chicago customers both think in neighborhoods, so a five to ten mile search returns a list of {cats} where you can name the specific area on every call. That local specificity is worth more than raw volume when you are doing cold outreach.',
    },
  },
  {
    slug: 'charlotte',
    name: 'Charlotte',
    state: 'North Carolina',
    stateCode: 'NC',
    framings: [
      'Charlotte grew quickly and is still growing, and a large share of its residents did not grow up there. People without a local network find providers by searching, which raises the value of visibility for every service business in the metro.',
      'Charlotte business districts run along a few corridors rather than clustering downtown. South End, Ballantyne and University City each support their own set of {cats} with their own competitive picture, so treat them as three lists rather than one.',
    ],
    competitiveness:
      'Agency competition in Charlotte is moderate and concentrated near uptown. Suburban businesses hear from far fewer marketers than their counterparts in Atlanta or Dallas.',
    areas: ['South End', 'Ballantyne', 'NoDa', 'Matthews', 'Huntersville', 'Concord', 'University City'],
    radiusMiles: 20,
    faq: {
      question: 'Is Charlotte big enough to build a territory around?',
      answer: 'Comfortably. Between the city and the surrounding towns there is more than enough density of {cats} for a full pipeline, and the steady inbound population means new businesses keep appearing. Claim a few ZIP codes and LeadZipp will tell you when they do, which is how you reach an owner in their first month rather than their third year.',
    },
  },
  {
    slug: 'tampa',
    name: 'Tampa',
    state: 'Florida',
    stateCode: 'FL',
    framings: [
      'Tampa is really three cities. Tampa, St Petersburg and Clearwater sit around a bay with bridges between them, and businesses tend to serve one side or the other. A radius search that crosses the water usually returns {cats} that will not drive to the job.',
      'Storm season is a permanent feature of the Tampa market. Roofing, restoration and every exterior trade see demand spikes that make being findable in one specific week worth more than a year of steady effort.',
    ],
    competitiveness:
      'The Tampa agency market has grown quickly, but the surrounding towns remain lightly worked and reply rates there reflect it.',
    areas: ['Ybor City', 'Brandon', 'Riverview', 'Wesley Chapel', 'St Petersburg', 'Clearwater', 'Largo'],
    radiusMiles: 20,
    faq: {
      question: 'Should a Tampa search include St Petersburg?',
      answer: 'Only if the businesses you target cross the bay, and many local service businesses simply do not. Run Tampa and St Petersburg as separate searches. You will get two cleaner lists and you will not waste calls on {cats} who do not take work on that side of the water.',
    },
  },
  {
    slug: 'denver',
    name: 'Denver',
    state: 'Colorado',
    stateCode: 'CO',
    framings: [
      'Denver sits at the center of a north to south corridor rather than a circle, so a radius search here pulls in a strip of towns from Boulder down to Castle Rock. Plan the territory along that line rather than around a point and you will waste far fewer calls.',
      'Hail is a recurring fact of life on the Front Range and it drives a predictable cycle of exterior work. Roofers, restoration crews and body shops all feel it, and the {cats} who are visible when it hits have a very different year from the ones who are not.',
    ],
    competitiveness:
      'Denver has a healthy agency market concentrated in the city itself. The corridor towns north and south are noticeably less saturated.',
    areas: ['RiNo', 'LoDo', 'Aurora', 'Lakewood', 'Littleton', 'Arvada', 'Westminster'],
    radiusMiles: 20,
    faq: {
      question: 'How do I plan a Denver territory?',
      answer: 'Think in corridors. Run one search centered on Denver, then move north toward Westminster and Boulder and south toward Littleton and Highlands Ranch. The Front Range is linear, so a stack of overlapping searches along it covers the {cats} in the market far more efficiently than one wide radius that spends half its area on the mountains.',
    },
  },
  {
    slug: 'seattle',
    name: 'Seattle',
    state: 'Washington',
    stateCode: 'WA',
    framings: [
      'Seattle splits into the city and the Eastside, and the water between them shapes who serves whom. A business in Ballard and a business in Bellevue rarely compete for the same job, which makes each side its own list rather than two halves of one.',
      'Seattle customers are unusually comfortable researching online before they call anybody, which means a weak or missing web presence costs a local business more here than it would almost anywhere else. That raises the stakes for the {cats} on your list and makes your argument considerably easier to make.',
    ],
    competitiveness:
      'Seattle carries high agency density and high prices. Tacoma, Everett and the outer suburbs are much less contested.',
    areas: ['Ballard', 'Capitol Hill', 'Bellevue', 'Redmond', 'Kirkland', 'Everett', 'Tacoma'],
    radiusMiles: 20,
    faq: {
      question: 'Should I search Seattle or the Eastside?',
      answer: 'Both, separately. Lake Washington splits the market cleanly and a service business in Ballard usually does not take jobs out in Redmond. Center one search on Seattle and another on Bellevue, then treat the two lists of {cats} as two distinct territories with their own outreach.',
    },
  },
  {
    slug: 'las-vegas',
    name: 'Las Vegas',
    state: 'Nevada',
    stateCode: 'NV',
    framings: [
      'Las Vegas is a tourist economy wrapped around a very ordinary suburban one. The businesses worth prospecting are almost all in the second category, serving the residents of Summerlin, Henderson and the western valley rather than anybody on the Strip.',
      'The valley runs around the clock and turns over quickly. New businesses open constantly, and a lot of them launch with no web presence at all because the owner is entirely focused on getting the doors open.',
    ],
    competitiveness:
      'Marketing attention in Las Vegas concentrates on hospitality and entertainment. Residential service businesses are comparatively overlooked.',
    areas: ['Summerlin', 'Henderson', 'North Las Vegas', 'Spring Valley', 'Paradise', 'Enterprise', 'Boulder City'],
    radiusMiles: 20,
    faq: {
      question: 'Are Las Vegas businesses worth targeting away from the Strip?',
      answer: 'Away from the Strip is where the prospecting actually is. Hospitality businesses are marketed heavily and rarely control their own decisions at the local level. The {cats} serving Summerlin and Henderson are independent, reachable and far more likely to say yes to a small first project.',
    },
  },
  {
    slug: 'nashville',
    name: 'Nashville',
    state: 'Tennessee',
    stateCode: 'TN',
    framings: [
      'Nashville has grown fast enough that the business landscape changes noticeably from year to year. New neighborhoods, new restaurants and new service businesses appear constantly, and a lot of them start with nothing more than a social profile and a phone number.',
      'The metro pulls in a wide ring of towns. Franklin, Brentwood, Murfreesboro and Hendersonville each have their own commercial center, and each supports a set of {cats} that never hear from an agency at all.',
    ],
    competitiveness:
      'Nashville proper draws meaningful agency attention. The surrounding counties draw very little of it.',
    areas: ['East Nashville', 'Germantown', 'Franklin', 'Brentwood', 'Murfreesboro', 'Hendersonville', 'Bellevue'],
    radiusMiles: 25,
    faq: {
      question: 'How do I find newly opened businesses in Nashville?',
      answer: 'Claim the ZIP codes you care about. LeadZipp watches for new business listings in a claimed area and emails you when they appear, which matters in a metro adding businesses as quickly as Nashville is. Reaching a {cat} in their first month is a completely different conversation from reaching them in their third year.',
    },
  },
  {
    slug: 'columbus',
    name: 'Columbus',
    state: 'Ohio',
    stateCode: 'OH',
    framings: [
      'Columbus is the quiet opportunity on this list. It has genuine metro scale, a stable economy and a fraction of the agency competition the Sun Belt cities carry. The same outreach that gets ignored in Dallas gets a callback here.',
      'The city spreads into a ring of suburbs that each behave like a small town, and a large university population keeps the local service economy busy year round. Density of {cats} is high relative to how lightly the market is worked.',
    ],
    competitiveness:
      'Columbus is one of the least saturated large metros for local marketing services, and that shows up directly in reply rates.',
    areas: ['Short North', 'Dublin', 'Westerville', 'Hilliard', 'Grove City', 'Gahanna', 'Reynoldsburg'],
    radiusMiles: 20,
    faq: {
      question: 'Is Columbus too small to build a business on?',
      answer: 'It is one of the largest metros in the Midwest and one of the least contested on this list. Fewer agencies chasing the same owners means higher reply rates on identical outreach, and for a small agency that is usually worth more than raw market size. Volume you cannot reach is not volume.',
    },
  },
]

/* ------------------------------------------------------------------ */
/* International cities                                                */
/* ------------------------------------------------------------------ */

export interface IntlCityDef {
  slug: string
  name: string
  country: string
  /** Short country label for headings and breadcrumbs. */
  countryShort: string
  /** What a postal code is called locally. */
  postalTerm: string
  framings: string[]
  competitiveness: string
  areas: string[]
  radiusKm: number
  /** Categories that read naturally for this market. */
  localCategories: string[]
  /** Two city-specific FAQs. */
  faqs: Faq[]
}

export const INTL_CITIES: IntlCityDef[] = [
  {
    slug: 'london-uk',
    name: 'London',
    country: 'United Kingdom',
    countryShort: 'UK',
    postalTerm: 'postcode',
    framings: [
      'London is not one market. It is dozens of high streets, each with its own set of independent trades and shops, and a plumber in Hackney does not compete with one in Richmond. Search borough by borough and the lists stay small enough to actually work.',
      'The sheer volume of small business in London is the point. A large share of it still runs on a map listing and a mobile number, and the businesses that do have websites often built them a decade ago and never came back.',
    ],
    competitiveness:
      'London has the densest agency market in Europe, and it still cannot cover the number of small businesses in the city. Pick a borough nobody is working and the competition disappears.',
    areas: ['Camden', 'Hackney', 'Islington', 'Croydon', 'Richmond', 'Ealing', 'Greenwich'],
    radiusKm: 15,
    localCategories: ['plumbers', 'builders', 'hair salons', 'restaurants', 'estate agents', 'driving schools'],
    faqs: [
      {
        question: 'Can I search London by postcode?',
        answer: 'Worldwide search takes a city, a country and a radius rather than a postcode, so for London you set the city to London, pick the United Kingdom, and then tighten the radius until the circle covers the area you actually want to work. Postcodes still appear in every result address exactly as they are listed, so you can filter or sort your export by them afterwards.',
      },
      {
        question: 'Is the data different outside the United States?',
        answer: 'The source is the same. LeadZipp reads live business listings, so a London search returns the same fields a US search does: business name, full address, phone number, website, rating and review count. The opportunity scoring works identically, because a business with no website is a business with no website in any country.',
      },
    ],
  },
  {
    slug: 'manchester-uk',
    name: 'Manchester',
    country: 'United Kingdom',
    countryShort: 'UK',
    postalTerm: 'postcode',
    framings: [
      'Manchester packs a large independent business scene into a compact footprint, which makes radius search efficient. A ten kilometre circle covers the city center and most of the inner suburbs without spilling into towns your prospects would not serve.',
      'The North West has a strong trades economy and a comparatively small agency market, so businesses here field far less outreach than their London equivalents. The same email gets a noticeably better response rate.',
    ],
    competitiveness:
      'Manchester agency competition is real in the city center and thin once you get out to Stockport, Bury and the surrounding towns.',
    areas: ['Salford', 'Didsbury', 'Chorlton', 'Stockport', 'Altrincham', 'Ancoats', 'Bury'],
    radiusKm: 12,
    localCategories: ['plumbers', 'electricians', 'barbers', 'restaurants', 'garages', 'letting agents'],
    faqs: [
      {
        question: 'Does a Manchester search cover the wider Greater Manchester area?',
        answer: 'It covers whatever your radius covers. Set the city to Manchester and the radius to around 12 kilometres and you will take in the city center, Salford, Chorlton and Didsbury. Push it out toward 25 kilometres and you begin pulling in Stockport, Bolton and Bury, which is useful for trades that travel and wasteful for shops that do not.',
      },
      {
        question: 'Are smaller UK cities worth searching separately?',
        answer: 'Yes, and usually more than worth it. Running Manchester, then Salford, then Stockport as separate searches gives you three lists you can reference by name in outreach, and being able to say the specific area in the first line of an email is worth more than doubling the size of one undifferentiated list.',
      },
    ],
  },
  {
    slug: 'toronto-canada',
    name: 'Toronto',
    country: 'Canada',
    countryShort: 'Canada',
    postalTerm: 'postal code',
    framings: [
      'Toronto and the surrounding region hold a very large share of Canadian small business, and the area is spread widely enough that Mississauga, Scarborough and North York each behave like separate markets with their own competitive picture.',
      'Toronto independent trades and clinics market themselves much like their US counterparts, which means the playbook transfers directly with no translation. The main difference is how many fewer agencies are running it.',
    ],
    competitiveness:
      'Downtown Toronto is well served by agencies. The suburban belt around it is a much softer market for the same offer.',
    areas: ['North York', 'Scarborough', 'Etobicoke', 'Mississauga', 'Brampton', 'Markham', 'Vaughan'],
    radiusKm: 25,
    localCategories: ['plumbers', 'dentists', 'HVAC contractors', 'restaurants', 'auto repair shops', 'law firms'],
    faqs: [
      {
        question: 'How should I split up the Toronto area?',
        answer: 'Run the core as one search and each suburb as its own. A single wide radius from downtown will return Mississauga and Markham businesses in the same list as Queen Street shops, and those owners do not compete with each other or respond to the same message. Four tighter searches produce four lists you can write to differently.',
      },
      {
        question: 'Do Canadian results include the same contact details?',
        answer: 'Yes. Name, full address with postal code, phone number, website, rating and review count all come through the same way, and the email finder works on any business with its own domain. Scoring is identical too, so a Toronto list sorts by opportunity exactly as a Chicago list would.',
      },
    ],
  },
  {
    slug: 'sydney-australia',
    name: 'Sydney',
    country: 'Australia',
    countryShort: 'Australia',
    postalTerm: 'postcode',
    framings: [
      'Sydney geography pushes business into corridors around the harbour and along the coast, so real service areas are narrower than the map suggests. Search by suburb cluster rather than by city and the lists match how tradespeople actually work.',
      'Australian trades are well organized and thoroughly used to buying leads from directories, which means the owned pipeline argument lands quickly. They already know what renting leads costs them.',
    ],
    competitiveness:
      'Sydney has an established agency market concentrated in the inner suburbs. The western and outer suburbs are considerably less worked.',
    areas: ['Parramatta', 'Bondi', 'Chatswood', 'Newtown', 'Manly', 'Liverpool', 'Penrith'],
    radiusKm: 20,
    localCategories: ['plumbers', 'electricians', 'cafes', 'dentists', 'landscapers', 'auto repair shops'],
    faqs: [
      {
        question: 'How wide should a Sydney search be?',
        answer: 'Around 15 to 20 kilometres from a suburb center is usually right. Sydney travel times do not track distance, so a 40 kilometre radius returns businesses that would never take a job at the other end of it. Center searches on Parramatta, Chatswood or Bondi separately and each list will reflect a real service area.',
      },
      {
        question: 'Do Australian businesses respond to this kind of outreach?',
        answer: 'The trades do, particularly the ones already paying a directory for leads. Lead with what they currently spend per enquiry rather than with web design, and the conversation starts in a place they have already thought about. The list gives you the phone number and website so you can check what they have before you call.',
      },
    ],
  },
  {
    slug: 'berlin-germany',
    name: 'Berlin',
    country: 'Germany',
    countryShort: 'Germany',
    postalTerm: 'postal code',
    framings: [
      'Berlin small business is spread across distinct districts, each with its own character and its own set of independent trades, studios and restaurants. A search centered on Kreuzberg returns a different world from one centered on Charlottenburg.',
      'German small businesses tend toward one of two extremes online: a formal, information dense site that has not been touched in years, or no site at all. Both leave room to work, and the second group is trivially easy to filter for.',
    ],
    competitiveness:
      'Berlin has a large startup and agency scene, but very little of it points at neighborhood trades and shops.',
    areas: ['Mitte', 'Kreuzberg', 'Prenzlauer Berg', 'Charlottenburg', 'Neukölln', 'Friedrichshain', 'Spandau'],
    radiusKm: 12,
    localCategories: ['restaurants', 'hair salons', 'plumbers', 'dentists', 'auto repair shops', 'fitness studios'],
    faqs: [
      {
        question: 'Are Berlin listings in German?',
        answer: 'Business names, categories and addresses come back as they are listed, which for Berlin means mostly German. The structure is identical to any other search, so name, address, phone, website, rating and review count all populate normally and the opportunity score works exactly as it does elsewhere.',
      },
      {
        question: 'Which Berlin districts are worth starting with?',
        answer: 'Start where business density is high and agency attention is low. Neukölln, Spandau and the outer parts of Friedrichshain carry plenty of independent trades and restaurants without the marketing saturation you get around Mitte. Run each district as its own search rather than one circle over the whole city.',
      },
    ],
  },
  {
    slug: 'munich-germany',
    name: 'Munich',
    country: 'Germany',
    countryShort: 'Germany',
    postalTerm: 'postal code',
    framings: [
      'Munich is smaller than Berlin and considerably more prosperous, and that changes the buyer rather than the pitch. Businesses here are more likely to have budget available and less likely to have been approached in the first place.',
      'The city is compact enough that a single search with a modest radius covers most of the commercially interesting area, and the surrounding towns are close enough to add as a second pass.',
    ],
    competitiveness:
      'Munich has fewer agencies chasing local trades than its economy would suggest, which makes it one of the more comfortable European markets to work cold.',
    areas: ['Schwabing', 'Maxvorstadt', 'Haidhausen', 'Sendling', 'Bogenhausen', 'Pasing', 'Giesing'],
    radiusKm: 10,
    localCategories: ['restaurants', 'dentists', 'law firms', 'hair salons', 'auto repair shops', 'physiotherapists'],
    faqs: [
      {
        question: 'Is Munich big enough to run a full pipeline from?',
        answer: 'For a small agency, comfortably. A ten kilometre radius over Munich returns a dense list of independent businesses, and the surrounding towns extend it whenever you need more. Because the market is far less worked than the population and income would predict, reply rates tend to carry more weight than list size here.',
      },
      {
        question: 'How do I handle a market where I do not speak the language?',
        answer: 'The list itself is language neutral. You get names, addresses, phone numbers, websites and ratings, and a business with no website is obvious in any language. Most agencies working a market like this either partner with a local closer or focus on the categories where the site itself does the selling. The prospecting layer is the part you can do from anywhere.',
      },
    ],
  },
  {
    slug: 'paris-france',
    name: 'Paris',
    country: 'France',
    countryShort: 'France',
    postalTerm: 'postal code',
    framings: [
      'Paris packs an extraordinary density of small business into twenty arrondissements. A three kilometre radius in the center returns more businesses than a twenty mile radius does in most American metros, so tighten the circle rather than widening it.',
      'The inner city and the surrounding communes behave very differently. Independent trades cluster outside the center, while the arrondissements themselves are thick with retail, restaurants and personal services.',
    ],
    competitiveness:
      'Paris has a substantial agency market, though very little of it works neighborhood businesses street by street.',
    areas: ['Le Marais', 'Montmartre', 'Belleville', 'Boulogne-Billancourt', 'Saint-Denis', 'Vincennes', 'Levallois-Perret'],
    radiusKm: 8,
    localCategories: ['restaurants', 'hair salons', 'bakeries', 'dentists', 'plumbers', 'law firms'],
    faqs: [
      {
        question: 'What radius works for a Paris search?',
        answer: 'Smaller than you expect. Three to five kilometres from a point inside the city returns a full working list, because business density in the arrondissements is extremely high. Save the wider radius for the suburbs, where trades cover more ground and the businesses are further apart.',
      },
      {
        question: 'Should I search Paris or the surrounding communes?',
        answer: 'Both, as separate territories. Restaurants, salons and retail concentrate inside the city, while plumbers, builders and other trades often base themselves in Saint-Denis, Boulogne-Billancourt or Vincennes and travel in. Two searches give you two lists with genuinely different offers attached.',
      },
    ],
  },
  {
    slug: 'amsterdam-netherlands',
    name: 'Amsterdam',
    country: 'Netherlands',
    countryShort: 'Netherlands',
    postalTerm: 'postal code',
    framings: [
      'Amsterdam is compact enough that one search with a modest radius covers most of the city, and the Dutch small business sector is already heavily digital. That shifts the pitch from you need a website to yours is not doing anything, which is a more interesting conversation anyway.',
      'The city proper is dense with retail, hospitality and personal services, while the trades sit out toward Noord, Zuidoost and the towns beyond the ring road.',
    ],
    competitiveness:
      'Dutch businesses are comfortable buying digital services, so the market is competitive but the buyers are educated and the sales cycle is short.',
    areas: ['Jordaan', 'De Pijp', 'Amsterdam-Noord', 'Zuidoost', 'Haarlem', 'Amstelveen', 'Diemen'],
    radiusKm: 10,
    localCategories: ['restaurants', 'hair salons', 'bike shops', 'dentists', 'plumbers', 'fitness studios'],
    faqs: [
      {
        question: 'If Dutch businesses already have websites, what am I selling?',
        answer: 'Performance rather than existence. Filter for businesses that do have a site, open a few on a phone, and you will find slow pages, no booking path and listings that have drifted out of date. That is a harder pitch to open and a much easier one to close, because the owner already believes the channel matters.',
      },
      {
        question: 'Does Amsterdam alone give me enough volume?',
        answer: 'For most single operators, yes, and Haarlem, Amstelveen and Utrecht are close enough to add as separate searches once you have worked the city. Keep the radius tight at first. Amsterdam density means even a ten kilometre circle returns more businesses than you can call in a month.',
      },
    ],
  },
  {
    slug: 'madrid-spain',
    name: 'Madrid',
    country: 'Spain',
    countryShort: 'Spain',
    postalTerm: 'postal code',
    framings: [
      'Madrid barrios each support a full local economy of bars, salons, clinics and trades. Density is high, distances are short, and a modest radius returns a long list you can work for weeks without leaving the neighborhood.',
      'A great many Madrid businesses run entirely on a map listing and a phone number, and a great many more have a site that was built once and never revisited. Filtering separates the two groups in a single click.',
    ],
    competitiveness:
      'Agency attention in Madrid concentrates on larger companies. Neighborhood businesses are lightly worked by comparison.',
    areas: ['Salamanca', 'Chamberí', 'Malasaña', 'Chamartín', 'Vallecas', 'Getafe', 'Alcalá de Henares'],
    radiusKm: 10,
    localCategories: ['restaurants', 'hair salons', 'dentists', 'plumbers', 'auto repair shops', 'gyms'],
    faqs: [
      {
        question: 'How do I pick an area to start with in Madrid?',
        answer: 'Pick one barrio and exhaust it before moving. Salamanca, Chamberí and Malasaña each hold enough independent businesses for a full outreach cycle, and working one at a time means every message can name the street or the neighborhood. That specificity is the single biggest lever in cold local outreach.',
      },
      {
        question: 'Do Spanish listings include the same data?',
        answer: 'Yes. Business name, address, phone, website, rating and review count all come back the same way they do anywhere else, and the opportunity score is calculated from the same signals. A Madrid list exports to CSV or PDF identically to a US one.',
      },
    ],
  },
  {
    slug: 'dubai-uae',
    name: 'Dubai',
    country: 'United Arab Emirates',
    countryShort: 'UAE',
    postalTerm: 'area',
    framings: [
      'Dubai business landscape is organized around planned districts rather than organic neighborhoods, which makes territory planning unusually clean. Business Bay, Deira and Jumeirah each hold a distinct commercial mix and can be worked as separate lists.',
      'A large share of Dubai small business is new, owner operated and marketing in more than one language. Businesses with no web presence at all appear constantly, because the pace of new openings outruns the pace of anyone getting organized.',
    ],
    competitiveness:
      'Dubai has a busy agency market aimed at larger brands. Independent trades, clinics and small retail are far less contested.',
    areas: ['Business Bay', 'Deira', 'Jumeirah', 'Al Quoz', 'Dubai Marina', 'Al Barsha', 'Bur Dubai'],
    radiusKm: 15,
    localCategories: ['restaurants', 'salons and spas', 'auto repair shops', 'clinics', 'cleaning companies', 'fitness studios'],
    faqs: [
      {
        question: 'How should I plan a Dubai territory?',
        answer: 'By district. Dubai is laid out in planned zones and each one carries a different commercial mix, so a search centered on Al Quoz returns workshops and trades while one centered on Jumeirah returns clinics, salons and retail. Run them separately and your offer can match the list instead of being generic.',
      },
      {
        question: 'Are new businesses easy to find in Dubai?',
        answer: 'They are one of the strongest opportunities in the market, because openings are frequent and the marketing usually comes last. Claim the areas you work and LeadZipp will alert you when new listings appear, which is how you reach an owner while the decisions are still being made rather than after somebody else made them.',
      },
    ],
  },
  {
    slug: 'riyadh-saudi-arabia',
    name: 'Riyadh',
    country: 'Saudi Arabia',
    countryShort: 'Saudi Arabia',
    postalTerm: 'district',
    framings: [
      'Riyadh is expanding quickly and the small business sector is expanding with it. Retail, clinics and service companies open at a pace that leaves marketing as an afterthought, which is precisely the gap you work.',
      'The city is large and spread out, so district level searching matters more here than raw radius. Olaya and Al Malaz return very different commercial mixes and deserve separate lists.',
    ],
    competitiveness:
      'The agency market in Riyadh is oriented toward enterprise and government work. Small business marketing is a comparatively open field.',
    areas: ['Olaya', 'Al Malaz', 'Al Nakheel', 'Diplomatic Quarter', 'Al Sahafah', 'Qurtubah', 'Irqah'],
    radiusKm: 15,
    localCategories: ['restaurants', 'clinics', 'auto repair shops', 'salons and spas', 'contractors', 'retail shops'],
    faqs: [
      {
        question: 'Do Riyadh listings work the same way?',
        answer: 'Yes. Set the city to Riyadh, pick Saudi Arabia, and set a radius. Results come back with business name, address, phone, website, rating and review count, and many listings carry both Arabic and English names exactly as they are published. The no website filter is particularly productive in this market.',
      },
      {
        question: 'What sells best into a fast growing market like Riyadh?',
        answer: 'Anything that makes a new business findable quickly. A simple site, a properly filled out map listing and a working contact path matter more to a business six months old than a sophisticated campaign does. Sort by opportunity score, start with the listings that have no website, and lead with speed.',
      },
    ],
  },
  {
    slug: 'mumbai-india',
    name: 'Mumbai',
    country: 'India',
    countryShort: 'India',
    postalTerm: 'PIN code',
    framings: [
      'Mumbai has one of the highest concentrations of small business anywhere, packed into a narrow strip of land. Radius search here needs to be tight, because a ten kilometre circle can contain more listings than you could call in a quarter.',
      'Most small businesses in Mumbai are reachable by phone and present on the map, and a large share have no website at all. The volume is the opportunity, and it is also the reason filtering matters more here than in any other market on this list.',
    ],
    competitiveness:
      'India has a deep digital services market, so price competition is real. Differentiate on the quality of the targeting rather than on the build.',
    areas: ['Andheri', 'Bandra', 'Dadar', 'Powai', 'Lower Parel', 'Thane', 'Navi Mumbai'],
    radiusKm: 8,
    localCategories: ['restaurants', 'salons', 'clinics', 'coaching centers', 'auto repair shops', 'retail shops'],
    faqs: [
      {
        question: 'How do I keep a Mumbai list manageable?',
        answer: 'Keep the radius small and lean on the filters. Five to eight kilometres from a specific area such as Andheri or Bandra already returns a substantial list, and filtering for no website plus a minimum review count cuts it down to businesses that are established enough to spend and unmarketed enough to need you.',
      },
      {
        question: 'Is there enough budget in local Mumbai businesses?',
        answer: 'It varies enormously by category and by area, which is exactly why the review count and rating filters matter. A clinic in Powai and a shop in a suburban market are different buyers. Use rating and review volume as a proxy for how established a business is, then match the offer to what you find.',
      },
    ],
  },
]

/* ------------------------------------------------------------------ */
/* Rotating pools                                                      */
/* ------------------------------------------------------------------ */

const HOOKS: string[] = [
  'Every {cat} in {city} is already listed somewhere online. The only question worth asking is how many of those listings lead anywhere at all.',
  'There is no shortage of {cats} in {city}. There is a serious shortage of {cats} with a web presence that does anything for them.',
  'Open a map of {city}, drop a pin, and you will find {cats} on almost every commercial strip. Most of them are close to invisible in search.',
  'If you sell websites, local SEO or ads to small businesses, {cats} in {city} are one of the easiest lists you can work.',
  '{city} has enough {cats} to keep a small agency busy for a year. The trick is knowing which ones to call first, and in what order.',
  'A bought list of {cats} goes stale within months. A live map of {city} does not, because it is read fresh every time you search.',
]

const GAP_HEADINGS: string[] = [
  'What {cats} in {city} usually get wrong online',
  'The gaps you will find on almost every {cat} listing',
  'Where {city} {cats} leave money on the table',
  'Four things missing from most {cat} websites',
  'Why these {cats} are worth calling',
]

const GAP_INTROS: string[] = [
  'These are the patterns that repeat across {city}. You will spot at least two of them on most of the {cats} in your list, and each one is a specific thing you can point at on a call.',
  'None of this is theoretical. Open five {cat} listings in {city} and check them against this. The overlap is the reason this category converts.',
  'Every one of these is visible from the outside, which means you can qualify a {cat} in {city} before you spend a single minute on outreach.',
  'Work through this list on any {city} {cat} before you dial. Knowing which gap you are leading with is most of the difference between a pitch and a conversation.',
]

const BENEFIT_HEADINGS: string[] = [
  'What a {city} {cat} search gives you',
  'What you get on every {cat} in the list',
  'Inside your {city} {cats} list',
  'The data behind each {cat}',
]

const BENEFITS: Card[] = [
  {
    title: 'Every {cat} on the map',
    body: 'A live pull of the {cats} listed around {city} right now, with business name, street address, phone number and website. Not a database export from two years ago.',
  },
  {
    title: 'Website gaps flagged',
    body: 'The list marks which {cats} around {city} have a website and which do not, so the businesses with the most obvious need surface immediately instead of sitting buried four pages down.',
  },
  {
    title: 'Ratings and review counts',
    body: 'Star rating and total review count on every {cat}, which is the fastest way to spot a {city} business doing good work with nothing at all behind it.',
  },
  {
    title: 'An opportunity score',
    body: 'Each {cat} is scored on the signals that predict need: no site, thin reviews, a weak rating. Sort by score and work {city} from the top down.',
  },
  {
    title: 'Owner contact email',
    body: 'For any {city} {cat} with its own domain, one tap runs the email finder and returns the best contact address with a confidence badge, so you know what you are working with before you send.',
  },
  {
    title: 'Map view of the territory',
    body: 'Flip to the map and watch the {cats} spread across {city}. Cluster your calls by area and route a day of door knocking in about two minutes.',
  },
  {
    title: 'Filters that match how you sell',
    body: 'Narrow by radius, rating, review count and whether a website exists. Pull only the {cats} in {city} that fit the offer you actually lead with.',
  },
  {
    title: 'Export straight into your pipeline',
    body: 'Send the {city} list to CSV, a branded PDF, or into HubSpot, Pipedrive or GoHighLevel. Phone, email, score and every other field travel with it.',
  },
]

const CTA_HEADINGS: string[] = [
  'Pull your {city} {cat} list in the next five minutes',
  'Start with the {cats} nobody else has called',
  'Your next {city} client is somewhere on this list',
  'Turn {city} into a territory instead of a guess',
  'Run the search. See who actually needs you.',
]

const CTA_BODIES: string[] = [
  'Free gives you 25 new live searches a month and 5 welcome email credits. Pro adds 100 live searches and 100 email credits a month plus bulk ZIP search, opening with a 7-day trial that carries 25 live searches and 20 email credits. Cached reruns and filter changes are free.',
  'Start Free with 25 live searches and 5 welcome email credits, or take the 7-day Pro trial, which carries 25 live searches and 20 email credits before the full 100 and 100 a month begin. Card required, and nothing is charged if you cancel before day 7.',
  'Run your first {city} searches on Free, with 25 new live territories and free cached refinements. When you want broader coverage, business email credits, and bulk ZIP search, the 7-day Pro trial takes a card and charges nothing if you cancel before it ends.',
  'Free covers 25 new live searches, enough to see what {city} looks like. Pro adds 100 live searches and 100 email credits a month plus bulk ZIP search, starting with a 7-day trial of 25 live searches and 20 email credits. Cached reruns remain free.',
]

/**
 * Appended only to a category FAQ answer that carries no {city} token, so
 * that no page ever renders an entire FAQ block word for word identical to
 * the same category's page in another metro.
 */
const FAQ_CITY_CLOSERS: string[] = [
  'Try it on {area1} first, then repeat in {area2} once you have an opening line that works.',
  'The pattern is easiest to see if you run {area1} and {area2} back to back and compare the two lists.',
  'Start with {area1}. It is a small enough slice of {city} to finish inside a week.',
  'Check it against ten {city} listings before you take the conclusion as read.',
  'None of this is specific to {city}, but the density here means you find out quickly whether it holds.',
  'Work one {city} neighborhood at a time and the answer becomes obvious well before the list runs out.',
]

/** Third section: a rotating structural variant, not just rotating words. */
type VariantKey = 'working' | 'buyer' | 'offer'
const VARIANT_KEYS: VariantKey[] = ['working', 'buyer', 'offer']

/* ------------------------------------------------------------------ */
/* Composed page types                                                 */
/* ------------------------------------------------------------------ */

export interface SearchRecipeRow {
  label: string
  value: string
}

export interface PageSection {
  eyebrow: string
  heading: string
  body?: string
  cards?: Card[]
  bullets?: string[]
}

export interface LocationPage {
  kind: 'us' | 'intl'
  slug: string
  path: string
  /** Grouping label used by the /leads index. */
  groupKey: string
  groupLabel: string
  /** Short label used in sibling link lists. */
  linkLabel: string
  linkSub: string
  metaTitle: string
  metaDescription: string
  ogTitle: string
  ogSubtitle: string
  breadcrumbName: string
  eyebrow: string
  h1: string
  lede: string
  recipe: SearchRecipeRow[]
  context: string[]
  areas: string[]
  areasLabel: string
  gaps: PageSection
  benefits: PageSection
  variant: PageSection
  faqs: Faq[]
  ctaHeading: string
  ctaBody: string
  relatedPosts: string[]
  siblingsPrimary: { heading: string; links: LinkRef[] }
  siblingsSecondary: { heading: string; links: LinkRef[] }
}

/* ------------------------------------------------------------------ */
/* Slug helpers                                                        */
/* ------------------------------------------------------------------ */

export function categoryCitySlug(category: CategoryDef, city: UsCityDef): string {
  return `${category.slug}-in-${city.slug}`
}

/* ------------------------------------------------------------------ */
/* Composition: category x US city                                     */
/* ------------------------------------------------------------------ */

function usTokens(category: CategoryDef, city: UsCityDef): Tokens {
  return {
    cat: category.singular,
    Cat: category.singularTitle,
    cats: category.plural,
    Cats: category.name,
    trade: category.trade,
    city: city.name,
    state: city.state,
    sc: city.stateCode,
    radius: String(city.radiusMiles),
    area1: city.areas[0],
    area2: city.areas[1],
  }
}

const US_META_TITLES: string[] = [
  '{Cats} in {city}, {sc}: Find Local {Cat} Leads',
  '{Cat} Leads in {city}, {sc} (Live Business List)',
  'Find {Cats} in {city}, {sc} Who Need a Website',
  '{city} {Cats}: Scored Local Lead List',
]

const US_H1S: string[] = [
  '{Cats} in {city}, ranked by who needs you most',
  'Find {cats} in {city} who need what you sell',
  '{city} {cats}, scored and ready to call',
  'Every {cat} in {city}, sorted by opportunity',
]

function buildUsPage(category: CategoryDef, city: UsCityDef): LocationPage {
  const slug = categoryCitySlug(category, city)
  const t = usTokens(category, city)
  const seed = slug

  const hook = fill(pick(HOOKS, seed, 'hook'), t)
  const angle = fill(pick(category.angles, seed, 'angle'), t)
  const framing = fill(pick(city.framings, seed, 'framing'), t)

  const benefits = sample(BENEFITS, seed, 'benefits', 6).map((c) => fillCard(c, t))
  const variantKey = pick(VARIANT_KEYS, seed, 'variant')

  let variant: PageSection
  if (variantKey === 'working') {
    variant = {
      eyebrow: 'Working the list',
      heading: fill('How to run a {city} {cat} list without burning it', t),
      body: fill(
        'A list is only worth what you do with it. This is the order that works for {cats}, and it assumes you are doing this alongside client work rather than full time.',
        t
      ),
      bullets: [
        fill('Sort by opportunity score and take the top thirty {cats} rather than the whole metro. A short list you finish beats a long list you abandon.', t),
        fill('Search {area1} and {area2} as separate lists instead of one wide radius. Naming the specific area in your first line is worth more than doubling the size of the list.', t),
        fill(category.pitchPoints[0], t),
        fill('Call at the right hour. For {cats} that means {time}.', {
          ...t,
          time: (category.bestTime.charAt(0).toLowerCase() + category.bestTime.slice(1)).replace(/\.$/, ''),
        }),
        fill('Export the worked list to your CRM so the next pass around {city} starts where this one stopped.', t),
      ],
    }
  } else if (variantKey === 'buyer') {
    variant = {
      eyebrow: 'Who you are calling',
      heading: fill('The person on the other end of a {cat} listing', t),
      body: fill(
        'Cold outreach fails on timing and framing far more often than on the offer itself. Here is who actually picks up at a {city} {cat}, and what they are doing when you interrupt them.',
        t
      ),
      bullets: [
        `Decision maker: ${category.buyerNote}`,
        `Best time to reach them: ${category.bestTime}`,
        `Opening line: ${fill(category.outreachHook, t)}`,
        `Timing that helps: ${fill(category.timingNote, t)}`,
        fill('Local context: {comp}', { ...t, comp: city.competitiveness }),
      ],
    }
  } else {
    variant = {
      eyebrow: 'The offer',
      heading: fill('What to sell a {city} {cat} first', t),
      body: fill(
        'Do not lead with a rebuild. Lead with the smallest thing that produces a visible result, then earn the larger engagement. For {cats}, that sequence looks like this.',
        t
      ),
      bullets: [
        `Start with: ${fill(category.sellFirst, t)}`,
        ...category.pitchPoints.map((p) => fill(p, t)),
        fill('Remember the market you are in. {comp}', { ...t, comp: city.competitiveness }),
      ],
    }
  }

  const productFaqs: Faq[] = [
    {
      question: fill('Where does the {city} {cat} data come from?', t),
      answer: fill(
        'Every search runs live against Google Places and Yelp business listings, so the {cats} you see are the ones listed in {city} at the moment you search. Nothing is served from a scraped file that ages quietly in the background, which matters most for the newly opened businesses that make the best first calls.',
        t
      ),
    },
    {
      question: fill('Can I export the {city} {cat} list?', t),
      answer: fill(
        'Yes. Any result set exports to CSV or to a branded PDF, and it can be pushed straight into HubSpot, Pipedrive or GoHighLevel. Business name, address, phone, website, rating, review count, opportunity score and any email you have found all travel with it, so nothing gets retyped.',
        t
      ),
    },
    {
      question: fill('Do I need to pay to search {cats} in {city}?', t),
      answer: fill(
        'No. Free includes 25 new live searches a month against the same data, enough to work a neighborhood of {city} and see whether the {cats} here look like your buyer. Pro includes 100 live searches and 100 business-email credits per calendar month, and starts with a 7-day trial that carries 25 live searches and 20 email credits. Cached reruns stay free. A card is required, and nothing is charged if you cancel before day 7.',
        t
      ),
    },
    {
      question: fill('How often does the {city} list change?', t),
      answer: fill(
        'Business listings change constantly as places open, close, move and update their details, and because each search is live your list reflects that rather than a snapshot. If you claim a ZIP code in {city}, LeadZipp emails you when new businesses appear in it, which is how you get to a {cat} before anyone else has called.',
        t
      ),
    },
  ]

  /**
   * Some category answers are written without a city reference because the
   * point is category-wide. Anchor those to this metro so the FAQ block is
   * never byte-identical to the same category's page in another city.
   */
  const anchorFaq = (faq: Faq, tag: string): Faq => {
    const filled = fillFaq(faq, t)
    if (filled.answer.includes(city.name)) return filled
    return {
      question: filled.question,
      answer: `${filled.answer} ${fill(pick(FAQ_CITY_CLOSERS, seed, tag), t)}`,
    }
  }

  const faqs: Faq[] = [
    anchorFaq(category.faqs[0], 'faqclose1'),
    fillFaq(city.faq, t),
    anchorFaq(category.faqs[1], 'faqclose2'),
    pick(productFaqs, seed, 'productfaq'),
  ]

  // Internal links: same category in other cities, other categories in this city.
  const otherCities = US_CITIES.filter((c) => c.slug !== city.slug)
  const cityStart = hash(`${seed}::sibcities`) % otherCities.length
  const siblingCities = Array.from({ length: 3 }, (_, i) => otherCities[(cityStart + i) % otherCities.length])

  const otherCats = CATEGORIES.filter((c) => c.slug !== category.slug)
  const catStart = hash(`${seed}::sibcats`) % otherCats.length
  const siblingCats = Array.from({ length: 3 }, (_, i) => otherCats[(catStart + i) % otherCats.length])

  const generalPosts = ['local-lead-generation-guide', 'prospect-local-clients-by-zip-code', 'lead-scoring-explained']
  const extraPost = pick(generalPosts, seed, 'post')
  const relatedPosts = Array.from(new Set([...category.posts, extraPost])).slice(0, 3)

  return {
    kind: 'us',
    slug,
    path: `/leads/${slug}`,
    groupKey: city.slug,
    groupLabel: `${city.name}, ${city.stateCode}`,
    linkLabel: `${category.name} in ${city.name}`,
    linkSub: `${city.name}, ${city.stateCode}`,
    metaTitle: fill(pick(US_META_TITLES, seed, 'metatitle'), t),
    metaDescription: fill(
      pick(
        [
          'Find and score every {cat} in {city}, {sc}. Live business listings with phone, website, rating and an opportunity score, so you call the {cats} who need you most first.',
          'A live, scored list of {cats} in {city}, {sc}. See which ones have no website, which have thin reviews, and get the owner contact before you pitch.',
          'Prospect {cats} in {city}, {sc} without buying a stale list. Real listings, website gaps flagged, opportunity scoring, and one click export to your CRM.',
        ],
        seed,
        'metadesc'
      ),
      t
    ),
    ogTitle: fill('{Cats} in {city}, {sc}', t),
    ogSubtitle: fill('Live, scored {cat} leads with website gaps flagged', t),
    breadcrumbName: fill('{Cats} in {city}', t),
    eyebrow: fill('{city}, {state}', t),
    h1: fill(pick(US_H1S, seed, 'h1'), t),
    lede: hook,
    recipe: [
      { label: 'Category', value: category.singularTitle },
      { label: 'Location', value: `${city.name}, ${city.stateCode}` },
      { label: 'Radius', value: `${city.radiusMiles} miles` },
      { label: 'Sort by', value: 'Opportunity score' },
      { label: 'Filter', value: 'No website first' },
    ],
    context: [angle, framing],
    areas: city.areas,
    areasLabel: fill('Areas worth searching separately around {city}', t),
    gaps: {
      eyebrow: 'The opening',
      heading: fill(pick(GAP_HEADINGS, seed, 'gaphead'), t),
      body: fill(pick(GAP_INTROS, seed, 'gapintro'), t),
      cards: sample(category.gaps, seed, 'gaps', 4).map((c) => fillCard(c, t)),
    },
    benefits: {
      eyebrow: 'What you get',
      heading: fill(pick(BENEFIT_HEADINGS, seed, 'benefithead'), t),
      cards: benefits,
    },
    variant,
    faqs,
    ctaHeading: fill(pick(CTA_HEADINGS, seed, 'ctahead'), t),
    ctaBody: fill(pick(CTA_BODIES, seed, 'ctabody'), t),
    relatedPosts,
    siblingsPrimary: {
      heading: fill('{Cats} in other metros', t),
      links: siblingCities.map((c) => ({
        href: `/leads/${categoryCitySlug(category, c)}`,
        label: `${category.name} in ${c.name}`,
        sub: `${c.name}, ${c.stateCode}`,
      })),
    },
    siblingsSecondary: {
      heading: fill('Other categories in {city}', t),
      links: siblingCats.map((c) => ({
        href: `/leads/${categoryCitySlug(c, city)}`,
        label: `${c.name} in ${city.name}`,
        sub: `${city.name}, ${city.stateCode}`,
      })),
    },
  }
}

/* ------------------------------------------------------------------ */
/* Composition: international city                                     */
/* ------------------------------------------------------------------ */

const INTL_BENEFITS: Card[] = [
  {
    title: 'Live listings, not a bought file',
    body: 'Every {city} search reads current business listings, so you get the businesses trading in {city} today with name, address, phone and website attached.',
  },
  {
    title: 'City, country and radius',
    body: 'Set the city to {city}, pick {country}, and dial the radius to match the area a local business would actually serve. Around {radius} km is a sensible starting point here.',
  },
  {
    title: 'Website gap flagged on every result',
    body: 'The single most valuable filter outside the United States. Businesses in {city} with no website at all are marked immediately, and in most {country} markets there are more of them than you expect.',
  },
  {
    title: 'Ratings and review counts',
    body: 'Rating and total review count come through on every {city} listing, which lets you separate an established business with no marketing from one that is too new to spend.',
  },
  {
    title: 'Opportunity scoring that travels',
    body: 'The score is built from signals that mean the same thing everywhere: no website, few reviews, a weak rating. A {city} list sorts by need exactly as a US list does.',
  },
  {
    title: 'Email finder on any domain',
    body: 'Where a {city} business has its own domain, the email finder returns a best contact address with a confidence badge so you know whether you are sending to something verified or something inferred.',
  },
  {
    title: 'Map view for territory planning',
    body: 'See how businesses cluster across {city} before you plan a day of calls or visits. Districts that look adjacent on a map are often completely different markets.',
  },
  {
    title: 'Export to CSV, PDF or CRM',
    body: 'Take the {city} list into CSV, a branded PDF, or straight into HubSpot, Pipedrive or GoHighLevel with every field intact.',
  },
]

const INTL_HOOKS: string[] = [
  '{city} is one of the markets LeadZipp now covers directly. Set the city, pick {country}, choose a radius, and you get the same live, scored list of local businesses that a US search returns.',
  'Worldwide search means {city} works exactly like a US ZIP code search. Same live listings, same website gap flags, same opportunity scoring, applied to {country}.',
  'Local businesses in {city} have the same problem as local businesses everywhere. Plenty of them are invisible online, and almost none of them know it. Here is how to find those ones.',
  'If you sell websites, local SEO or marketing services and you work {city}, the hard part has never been the pitch. It has been building a list worth pitching to.',
]

function intlTokens(city: IntlCityDef): Tokens {
  return {
    city: city.name,
    country: city.country,
    countryShort: city.countryShort,
    postal: city.postalTerm,
    radius: String(city.radiusKm),
    area1: city.areas[0],
    area2: city.areas[1],
  }
}

function buildIntlPage(city: IntlCityDef): LocationPage {
  const seed = city.slug
  const t = intlTokens(city)

  const benefits = sample(INTL_BENEFITS, seed, 'benefits', 6).map((c) => fillCard(c, t))
  const catList = city.localCategories

  const productFaq: Faq = pick(
    [
      {
        question: fill('Do I need a paid plan to search {city}?', t),
        answer: fill(
          'No. Free includes 25 new live searches a month against the same listings, enough to work a district of {city} and decide whether the market suits your offer. Pro includes 100 live searches and 100 business-email credits per calendar month, and opens with a 7-day trial that carries 25 live searches and 20 email credits. Cached reruns stay free. A card is required, and nothing is charged if you cancel before day 7.',
          t
        ),
      },
      {
        question: fill('Does the email finder work on {country} businesses?', t),
        answer: fill(
          'It works wherever a business has its own domain, which is the same condition that applies in the United States. You get a best contact address with a confidence badge, so a verified result and an inferred one are never presented as the same thing. Businesses with no domain at all have no email to find, and those are usually your website prospects anyway.',
          t
        ),
      },
      {
        question: fill('Can I export a {city} list the same way?', t),
        answer: fill(
          'Yes. CSV, branded PDF, or a direct push into HubSpot, Pipedrive or GoHighLevel, with every field carried across including the {postal} in the address, the rating, the review count and the opportunity score. Nothing about the export changes because the search was outside the United States.',
          t
        ),
      },
    ],
    seed,
    'productfaq'
  )

  const faqs: Faq[] = [city.faqs[0], city.faqs[1], productFaq]

  const otherIntl = INTL_CITIES.filter((c) => c.slug !== city.slug)
  const start = hash(`${seed}::sib`) % otherIntl.length
  const siblings = Array.from({ length: 4 }, (_, i) => otherIntl[(start + i) % otherIntl.length])

  const usSpotlight = rotate(US_CITIES, seed, 'usspot', 3)
  const spotlightCat = pick(CATEGORIES, seed, 'usspotcat')

  return {
    kind: 'intl',
    slug: city.slug,
    path: `/leads/${city.slug}`,
    groupKey: city.country,
    groupLabel: city.country,
    linkLabel: `${city.name}, ${city.countryShort}`,
    linkSub: city.country,
    metaTitle: fill(
      pick(
        [
          'Local Business Leads in {city}, {countryShort}',
          'Find Local Business Leads in {city}, {country}',
          '{city} Business Leads: Live Local Search',
        ],
        seed,
        'metatitle'
      ),
      t
    ),
    metaDescription: fill(
      pick(
        [
          'Find and score local businesses in {city}, {country}. Live listings with phone, website, rating and an opportunity score, so you reach the businesses with the biggest gaps first.',
          'Build a scored list of local businesses in {city}, {country} in seconds. City, country and radius search, website gaps flagged, one click export to your CRM.',
          'Prospect local businesses across {city} and the surrounding area. Live {country} listings, opportunity scoring, owner email finder and CSV or CRM export.',
        ],
        seed,
        'metadesc'
      ),
      t
    ),
    ogTitle: fill('Local business leads in {city}', t),
    ogSubtitle: fill('Live {country} listings, scored by opportunity', t),
    breadcrumbName: `${city.name}, ${city.countryShort}`,
    eyebrow: city.country,
    h1: fill(
      pick(
        [
          'Local business leads in {city}',
          'Find local businesses in {city} that need you',
          '{city} local business leads, scored',
        ],
        seed,
        'h1'
      ),
      t
    ),
    lede: fill(pick(INTL_HOOKS, seed, 'hook'), t),
    recipe: [
      { label: 'Location', value: city.name },
      { label: 'Country', value: city.country },
      { label: 'Radius', value: `${city.radiusKm} km` },
      { label: 'Sort by', value: 'Opportunity score' },
      { label: 'Filter', value: 'No website first' },
    ],
    context: city.framings.map((f) => fill(f, t)),
    areas: city.areas,
    areasLabel: fill('Areas to search separately in and around {city}', t),
    gaps: {
      eyebrow: 'The market',
      heading: fill('Which {city} categories are worth working', t),
      body: fill(
        'Radius search is only half the job. The other half is picking categories where the gap between demand and online presence is widest. In {city} these are the ones that reliably return prospects worth calling.',
        t
      ),
      bullets: catList,
    },
    benefits: {
      eyebrow: 'What you get',
      heading: fill('What a {city} search returns', t),
      cards: benefits,
    },
    variant: {
      eyebrow: 'Local context',
      heading: fill('Working {city} as a territory', t),
      body: city.competitiveness,
      bullets: [
        fill('Start with a radius near {radius} km and tighten it rather than widening it. Oversized circles return businesses that will not travel to the job.', t),
        fill('Search the districts separately. {area1} and {area2} carry different commercial mixes and deserve different opening lines.', t),
        fill('Filter for no website first. It is the clearest signal of need and it is the same signal in every country.', t),
        fill('Note the {postal} in each address. It is the fastest way to group a {city} export into routes or territories.', t),
      ],
    },
    faqs,
    ctaHeading: fill(
      pick(
        [
          'Run your first {city} search now',
          'See what {city} looks like on the map',
          'Start with one district of {city}',
        ],
        seed,
        'ctahead'
      ),
      t
    ),
    ctaBody: fill(
      'Free covers 25 new live searches a month, enough to work a district properly. Pro adds 100 live searches and 100 business-email credits a month plus bulk ZIP search, opening with a 7-day trial of 25 live searches and 20 email credits. Cached reruns and filter refinements stay free.',
      t
    ),
    relatedPosts: ['local-lead-generation-guide', 'find-local-businesses-without-a-website', 'cold-email-templates-local-business-outreach'],
    siblingsPrimary: {
      heading: 'Other international markets',
      links: siblings.map((c) => ({
        href: `/leads/${c.slug}`,
        label: `${c.name}, ${c.countryShort}`,
        sub: c.country,
      })),
    },
    siblingsSecondary: {
      heading: 'Category pages in the United States',
      links: usSpotlight.map((c) => ({
        href: `/leads/${categoryCitySlug(spotlightCat, c)}`,
        label: `${spotlightCat.name} in ${c.name}`,
        sub: `${c.name}, ${c.stateCode}`,
      })),
    },
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

let cache: Map<string, LocationPage> | null = null

function allPagesMap(): Map<string, LocationPage> {
  if (cache) return cache
  const map = new Map<string, LocationPage>()
  for (const category of CATEGORIES) {
    for (const city of US_CITIES) {
      const page = buildUsPage(category, city)
      map.set(page.slug, page)
    }
  }
  for (const city of INTL_CITIES) {
    const page = buildIntlPage(city)
    map.set(page.slug, page)
  }
  cache = map
  return map
}

export function getAllLocationPages(): LocationPage[] {
  return Array.from(allPagesMap().values())
}

export function getAllLocationSlugs(): string[] {
  return Array.from(allPagesMap().keys())
}

export function getLocationPage(slug: string): LocationPage | null {
  return allPagesMap().get(slug) ?? null
}

/* ------------------------------------------------------------------ */
/* Launch priority: pages that get internal-link weight first          */
/* ------------------------------------------------------------------ */

/**
 * Ranked by agency deal size, query intent, and observed SERP softness
 * (live checks, August 2026). Order matters: it is the push order for
 * internal links and outreach. Re-check the SERPs monthly before reordering.
 */
export const FEATURED_SLUGS: string[] = [
  'hvac-contractors-in-dallas',
  'plumbers-in-atlanta',
  'hvac-contractors-in-phoenix',
  'dentists-in-seattle',
  'hvac-contractors-in-houston',
  'plumbers-in-houston',
  'dentists-in-tampa',
  'landscapers-in-charlotte',
  'plumbers-in-chicago',
  'roofing-contractors-in-charlotte',
  'roofing-contractors-in-columbus',
  'plumbers-in-columbus',
  'dentists-in-phoenix',
  'hvac-contractors-in-tampa',
  'plumbers-in-dallas',
  'chiropractors-in-denver',
  'landscapers-in-nashville',
  'roofing-contractors-in-nashville',
  'chiropractors-in-tampa',
  'law-firms-in-columbus',
]

export function getFeaturedPages(): LocationPage[] {
  return FEATURED_SLUGS.map((slug) => getLocationPage(slug)).filter(
    (p): p is LocationPage => p !== null
  )
}

/** Path list for the sitemap, index page first. */
export const LEADS_INDEX_PATH = '/leads'

export function getAllLocationPaths(): string[] {
  return getAllLocationPages().map((p) => p.path)
}

export interface LocationGroup {
  key: string
  label: string
  sub: string
  pages: LocationPage[]
}

/** US pages grouped by metro, then international pages grouped by country. */
export function getLocationGroups(): { us: LocationGroup[]; intl: LocationGroup[] } {
  const pages = getAllLocationPages()
  const us: LocationGroup[] = US_CITIES.map((city) => ({
    key: city.slug,
    label: city.name,
    sub: city.state,
    pages: pages.filter((p) => p.kind === 'us' && p.groupKey === city.slug),
  }))
  const intlByCountry = new Map<string, LocationGroup>()
  for (const city of INTL_CITIES) {
    const page = pages.find((p) => p.kind === 'intl' && p.slug === city.slug)
    if (!page) continue
    const existing = intlByCountry.get(city.country)
    if (existing) {
      existing.pages.push(page)
    } else {
      intlByCountry.set(city.country, {
        key: city.country,
        label: city.country,
        sub: 'Worldwide search',
        pages: [page],
      })
    }
  }
  return { us, intl: Array.from(intlByCountry.values()) }
}
