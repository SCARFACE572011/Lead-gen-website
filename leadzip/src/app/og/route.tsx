import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title') || 'Type a ZIP code. Get the whole street.'
  const subtitle =
    searchParams.get('subtitle') ||
    'Every local business in any ZIP — scored by who needs you most.'

  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: '#0C2B24',
          padding: '72px 80px',
          fontFamily: 'sans-serif',
          overflow: 'hidden',
        }}
      >
        {/* Signal-orange glow (bottom-left beacon) */}
        <div
          style={{
            position: 'absolute',
            bottom: '-220px',
            left: '-160px',
            width: '640px',
            height: '640px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(255,77,35,0.34), rgba(255,77,35,0) 70%)',
            display: 'flex',
          }}
        />
        {/* Lime glow (top-right) */}
        <div
          style={{
            position: 'absolute',
            top: '-240px',
            right: '-140px',
            width: '540px',
            height: '540px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(203,242,63,0.18), rgba(203,242,63,0) 70%)',
            display: 'flex',
          }}
        />

        {/* Wordmark: orange pin + LeadZipp + lime beacon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            marginBottom: '44px',
          }}
        >
          <div
            style={{
              position: 'relative',
              display: 'flex',
              width: '54px',
              height: '54px',
              borderRadius: '15px',
              background: '#FF4D23',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {/* lime beacon dot */}
            <div
              style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: '#CBF23F',
                border: '4px solid #0C2B24',
                display: 'flex',
              }}
            />
          </div>
          <span
            style={{
              color: '#FBFAF6',
              fontSize: '32px',
              fontWeight: 800,
              letterSpacing: '-0.5px',
            }}
          >
            LeadZipp
          </span>
        </div>

        {/* Eyebrow readout with lime dot */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '22px',
          }}
        >
          <div
            style={{
              width: '9px',
              height: '9px',
              borderRadius: '50%',
              background: '#CBF23F',
              display: 'flex',
            }}
          />
          <span
            style={{
              color: '#CBF23F',
              fontSize: '17px',
              fontWeight: 700,
              letterSpacing: '4px',
              textTransform: 'uppercase',
              fontFamily: 'monospace',
            }}
          >
            Local lead intelligence
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            display: 'flex',
            color: '#FBFAF6',
            fontSize: '64px',
            fontWeight: 800,
            lineHeight: 1.04,
            letterSpacing: '-2px',
            maxWidth: '960px',
          }}
        >
          {title}
        </div>

        {/* Signal-orange accent underline */}
        <div
          style={{
            display: 'flex',
            width: '132px',
            height: '9px',
            borderRadius: '9px',
            background: '#FF4D23',
            marginTop: '30px',
          }}
        />

        {/* Subtitle */}
        <div
          style={{
            display: 'flex',
            color: 'rgba(251,250,246,0.72)',
            fontSize: '26px',
            fontWeight: 400,
            maxWidth: '780px',
            marginTop: '26px',
          }}
        >
          {subtitle}
        </div>

        {/* Bottom bar: mono stats + URL */}
        <div
          style={{
            position: 'absolute',
            left: '80px',
            right: '80px',
            bottom: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', gap: '36px' }}>
            {['43 industries', '41k+ ZIP codes', 'Live Google & Yelp'].map((stat) => (
              <span
                key={stat}
                style={{
                  color: '#CBF23F',
                  fontSize: '16px',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  fontFamily: 'monospace',
                }}
              >
                {stat}
              </span>
            ))}
          </div>
          <span style={{ color: 'rgba(251,250,246,0.45)', fontSize: '18px' }}>
            leadzipp.com
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        // Serve social scrapers the CDN copy instead of re-rendering per
        // request: a day fresh at the edge, a week of stale-while-revalidate.
        'Cache-Control':
          'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
      },
    }
  )
}
