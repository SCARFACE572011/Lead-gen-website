// Merge-field outreach templates for the Proposal Generator.
//
// Used as the primary output when ANTHROPIC_API_KEY is not configured, and as
// the fallback when the Claude API call fails. Copy is personalized from the
// lead's actual gap signals: missing website, low rating, or thin review count
// each get a different angle. No em dashes anywhere in this file's copy.

export interface ProposalLeadInput {
  businessName: string
  category: string
  city?: string
  state?: string
  website?: string
  phone?: string
  email?: string
  rating?: number | null
  reviewCount?: number | null
}

export interface ProposalOutput {
  coldEmailSubject: string
  coldEmail: string
  proposal: string
  whatsapp: string
  linkedin: string
  callScript: string
}

export type GapAngle = 'no_website' | 'low_rating' | 'low_reviews' | 'general'

export function detectAngle(lead: ProposalLeadInput): GapAngle {
  if (!lead.website) return 'no_website'
  if (lead.rating != null && lead.rating < 4.0) return 'low_rating'
  if ((lead.reviewCount ?? 0) < 10) return 'low_reviews'
  return 'general'
}

function place(lead: ProposalLeadInput): string {
  if (lead.city && lead.state) return `${lead.city}, ${lead.state}`
  return lead.city || lead.state || 'your area'
}

function niceCategory(category: string): string {
  return (category || 'local businesses').toLowerCase()
}

export function generateProposalTemplates(lead: ProposalLeadInput): ProposalOutput {
  const name = lead.businessName
  const cat = niceCategory(lead.category)
  const loc = place(lead)
  const angle = detectAngle(lead)
  const rating = lead.rating != null ? lead.rating.toFixed(1) : null
  const reviews = lead.reviewCount ?? 0

  // Per-angle fragments reused across formats
  let observation: string
  let consequence: string
  let pitch: string
  let hookShort: string
  let subject: string

  switch (angle) {
    case 'no_website':
      observation = `I was researching ${cat} in ${loc} this week and noticed ${name} has no website listed on Google.`
      consequence = `Around 8 in 10 people check a business online before they call. Right now those searches are ending up with competitors who do have a site.`
      pitch = `I build simple, fast websites for local ${cat} that do one thing well: turn Google searches into phone calls. No jargon, no long agency retainer.`
      hookShort = `noticed ${name} has no website on Google`
      subject = `Quick question about ${name}'s website`
      break
    case 'low_rating':
      observation = `I came across ${name} while researching ${cat} in ${loc} and noticed your Google rating is sitting at ${rating ?? 'under 4.0'} stars.`
      consequence = `Most customers filter to 4 stars and up before they even read a single review, so a rating below that line quietly removes you from their shortlist.`
      pitch = `I help local ${cat} repair and protect their online reputation: responding the right way to old reviews, and building a steady stream of fresh 5-star ones from your happy customers.`
      hookShort = `your Google rating is at ${rating ?? 'under 4.0'} stars`
      subject = `About ${name}'s Google rating`
      break
    case 'low_reviews':
      observation = `I was looking at ${cat} in ${loc} and noticed ${name} only has ${reviews} Google review${reviews === 1 ? '' : 's'}.`
      consequence = `Review count is the first credibility signal people see in search results. Competitors with 50 or more reviews win the click even when their actual work is worse than yours.`
      pitch = `I set up a simple system that gets your happy customers to leave reviews automatically, by text and email, without you having to ask anyone face to face.`
      hookShort = `${name} only has ${reviews} Google review${reviews === 1 ? '' : 's'}`
      subject = `${name} deserves more than ${reviews} review${reviews === 1 ? '' : 's'}`
      break
    default:
      observation = `I was researching the strongest ${cat} in ${loc} and ${name} stood out.`
      consequence = `The gap between good local businesses and the ones that dominate search is rarely the quality of the work. It is visibility: showing up first and looking sharp when people compare options.`
      pitch = `I help established ${cat} capture more of the local search demand they already qualify for, through better Google visibility and a site built to convert.`
      hookShort = `${name} stood out among ${cat} in ${loc}`
      subject = `Idea for ${name}`
  }

  const coldEmail = `Hi there,

${observation}

${consequence}

${pitch}

Would you be open to a 10 minute call this week? I will show you exactly what your customers see today when they search for ${cat} in ${loc}, and what it could look like instead. If it is not a fit, no hard feelings.

Best,
[Your name]
[Your company]
[Your phone]`

  const proposal = `PROPOSAL FOR ${name.toUpperCase()}
Prepared by [Your company]

1. THE SITUATION
${observation} ${consequence}

2. WHAT WE FOUND
${bulletFindings(lead, angle)}

3. RECOMMENDED PLAN
${planForAngle(angle, cat)}

4. TIMELINE
Week 1: Kickoff call, access setup, and baseline audit.
Weeks 2-3: Build and implementation.
Week 4: Launch, review, and handoff with a simple monthly report.

5. INVESTMENT
[Your pricing]. No long-term contract. Cancel any time with 30 days notice.

6. NEXT STEP
Reply to this proposal or call [Your phone] and we can start this week. The audit findings above are yours to keep either way.

[Your name]
[Your company]`

  const whatsapp = `Hi, this is [Your name]. I was researching ${cat} in ${loc} and ${hookShort}. I help businesses like yours fix exactly that, usually within a few weeks. Mind if I send over a quick 2 minute breakdown of what I found? No obligation at all.`

  const linkedin = `Hi, I came across ${name} while researching ${cat} in ${loc}. Quick heads up: ${hookShort}, and that is likely costing you calls from people searching nearby. I put together a short breakdown of what I found. Happy to share it, no strings attached. Worth a look?`

  const callScript = `CALL SCRIPT FOR ${name}

OPENER
"Hi, is this the owner of ${name}? Great. My name is [Your name] with [Your company]. I know I am calling out of the blue, so I will be quick. Do you have 30 seconds?"

REASON FOR CALLING
"${observation.replace('I was', 'I have been').replace('I came across', 'I found')}"

VALUE
"${consequence} ${pitch}"

ASK
"I am not asking you to buy anything today. I would just like to send you a short breakdown of what your customers see when they search for ${cat} in ${loc}. If it is useful, we can talk. If not, you keep the report. What is the best email for that?"

COMMON OBJECTIONS
If "We get enough business from word of mouth":
"That is exactly why this works. Word of mouth sends people to Google to check you out first. This just makes sure what they find matches the reputation you already earned."

If "How much does it cost?":
"It depends on scope, but most clients start around [price range]. Before any of that, the breakdown is free, and it will show you whether this is even worth a conversation."

If "Send me some information":
"Happy to. So I send something relevant instead of a generic brochure, can I confirm you are the right person for decisions about marketing?"

CLOSE
"Perfect, I will send that over today. If what you see makes sense, I will follow up [day]. Thanks for your time."`

  return {
    coldEmailSubject: subject,
    coldEmail,
    proposal,
    whatsapp,
    linkedin,
    callScript,
  }
}

function bulletFindings(lead: ProposalLeadInput, angle: GapAngle): string {
  const lines: string[] = []
  if (!lead.website) {
    lines.push('- No website found on your Google Business Profile, so search traffic has nowhere to convert.')
  } else {
    lines.push(`- Website found at ${lead.website}. We will audit it for speed, mobile experience, and conversion.`)
  }
  if (lead.rating != null) {
    lines.push(
      lead.rating < 4.0
        ? `- Google rating of ${lead.rating.toFixed(1)} stars, below the 4.0 threshold most customers filter by.`
        : `- Solid Google rating of ${lead.rating.toFixed(1)} stars, a real asset worth amplifying.`
    )
  }
  const rc = lead.reviewCount ?? 0
  lines.push(
    rc < 10
      ? `- Only ${rc} Google review${rc === 1 ? '' : 's'}, which undercuts credibility next to higher-volume competitors.`
      : `- ${rc} Google reviews, a strong base of social proof.`
  )
  if (angle === 'general') {
    lines.push('- Opportunity to capture more local search demand with targeted visibility work.')
  }
  return lines.join('\n')
}

function planForAngle(angle: GapAngle, cat: string): string {
  switch (angle) {
    case 'no_website':
      return `- Launch a fast, mobile-first website built for ${cat}, focused on calls and quote requests.
- Connect it to your Google Business Profile so every search has somewhere to land.
- Add call tracking so you can see exactly how many leads the site produces.`
    case 'low_rating':
      return `- Respond professionally to existing negative reviews to show future customers you care.
- Launch an automated review request flow so happy customers outnumber unhappy ones fast.
- Monitor your rating weekly and flag issues before they become patterns.`
    case 'low_reviews':
      return `- Set up automated review requests by text and email after each job.
- Make leaving a review a 10 second task with a direct link and QR code.
- Showcase your best reviews on your website and Google profile.`
    default:
      return `- Optimize your Google Business Profile for the searches that matter in your area.
- Tune your website for speed, mobile, and conversion.
- Build a review engine that compounds your reputation month over month.`
  }
}
