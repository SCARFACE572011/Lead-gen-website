# LeadZip

LeadZip is a B2B lead generation SaaS that lets agencies and sales teams find local business contacts by ZIP code, category, and keyword. Built with Next.js 14 App Router, it provides a full CRM pipeline — search, save, manage, and export leads.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn/ui (base-nova) + Base UI |
| Database | Supabase (PostgreSQL + Auth) |
| Charts | Recharts |
| Icons | Lucide React |
| Payments | Stripe (coming soon) |
| Deployment | Vercel |

## Prerequisites

- Node.js 18 or higher
- npm 9 or higher
- A [Supabase](https://supabase.com) account (free tier works)
- (Optional) A [Stripe](https://stripe.com) account for billing

## Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/yourorg/leadzip.git
cd leadzip
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env.local
```

See the **Environment Variables** table below for all required keys.

### 4. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** in your Supabase dashboard
3. Paste and run the contents of `supabase/schema.sql`
4. Copy your project URL and anon key from **Settings > API**
5. Add them to `.env.local`

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Supabase service role key (server-only operations) |
| `GOOGLE_PLACES_API_KEY` | No | Google Places API key for real lead data |
| `YELP_API_KEY` | No | Yelp Fusion API key for real lead data |
| `STRIPE_SECRET_KEY` | No | Stripe secret key for billing |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | No | Stripe publishable key |
| `NEXT_PUBLIC_APP_URL` | No | Your production URL (e.g. https://leadzip.com) |

Create a `.env.example` file at the project root with these keys (no values) to help future contributors.

## Project Structure

```
leadzip/
├── src/
│   ├── app/
│   │   ├── (dashboard)/          # Authenticated dashboard routes
│   │   │   ├── saved/            # Saved leads CRM page
│   │   │   ├── history/          # Search history page
│   │   │   ├── exports/          # Export leads page
│   │   │   ├── settings/         # Account settings page
│   │   │   └── admin/            # Admin dashboard (role-gated)
│   │   ├── api/
│   │   │   └── leads/
│   │   │       ├── search/       # POST /api/leads/search
│   │   │       ├── save/         # POST /api/leads/save
│   │   │       └── export/       # POST /api/leads/export
│   │   ├── globals.css
│   │   └── layout.tsx
│   ├── components/
│   │   └── ui/                   # shadcn/ui components
│   ├── lib/
│   │   ├── export.ts             # CSV export utility
│   │   ├── scoring.ts            # Lead scoring algorithm
│   │   ├── utils.ts              # cn() and helpers
│   │   └── providers/
│   │       ├── leadDataProvider.ts   # Provider abstraction
│   │       └── mockProvider.ts       # Mock data (35 businesses)
│   └── types/
│       └── lead.ts               # TypeScript types and constants
├── supabase/
│   └── schema.sql                # Full database schema with RLS
├── public/
├── package.json
└── README.md
```

## Connecting Real APIs

### Google Places API

1. Enable the **Places API** in [Google Cloud Console](https://console.cloud.google.com)
2. Create an API key with Places API access
3. Add `GOOGLE_PLACES_API_KEY` to `.env.local`
4. Create `src/lib/providers/googlePlacesProvider.ts`:

```typescript
export async function searchLeadsGooglePlaces(params: SearchParams): Promise<SearchResult> {
  // Convert ZIP to lat/lng using Geocoding API, then call:
  // https://maps.googleapis.com/maps/api/place/nearbysearch/json
  // ?location=LAT,LNG&radius=METERS&type=CATEGORY&key=YOUR_KEY
}
```

5. In `src/lib/providers/leadDataProvider.ts`, change:

```typescript
const ACTIVE_PROVIDER: ProviderName = 'google_places'
```

### Yelp Fusion API

1. Create an app at [Yelp Developers](https://www.yelp.com/developers)
2. Get your API key and add `YELP_API_KEY` to `.env.local`
3. Create `src/lib/providers/yelpProvider.ts` calling:

```
https://api.yelp.com/v3/businesses/search?location=ZIP&term=CATEGORY&radius=METERS
```

## Connecting Stripe

1. Create a Stripe account and get your API keys
2. Add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` to `.env.local`
3. Create products and price IDs in your Stripe dashboard for Free / Pro / Agency plans
4. Add a webhook endpoint pointing to `/api/stripe/webhook`
5. Handle `checkout.session.completed` and `customer.subscription.updated` events to update `public.subscriptions` in Supabase
6. Add a checkout route at `/api/stripe/checkout` that creates a Stripe Checkout Session

Recommended Stripe library: `npm install stripe @stripe/stripe-js`

## Compliance Notes

LeadZip displays publicly available business contact information. As a user of this platform, you are responsible for:

- **CAN-SPAM compliance**: Include your physical address and unsubscribe option in all commercial email
- **GDPR**: Ensure you have a lawful basis for processing data if contacting EU businesses
- **TCPA**: Obtain proper consent before making automated calls or sending SMS
- **Do Not Call registries**: Check applicable DNC lists before calling

All data sourced by LeadZip comes from publicly listed business directories and map services. No consumer personal data is processed.

## License

MIT License — see [LICENSE](LICENSE) for details.
