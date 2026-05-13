import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title') || 'Find Local Business Leads by ZIP Code'
  const subtitle = searchParams.get('subtitle') || 'Search by location, industry, and radius.'

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 50%, #0369A1 100%)',
          padding: '80px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '60px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: '#0369A1', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ width: '24px', height: '24px', background: '#fff', borderRadius: '50%' }} />
          </div>
          <span style={{ color: '#fff', fontSize: '28px', fontWeight: '700', letterSpacing: '-0.5px' }}>
            LeadZip
          </span>
        </div>

        {/* Main headline */}
        <div style={{
          color: '#fff', fontSize: '56px', fontWeight: '800',
          lineHeight: 1.1, letterSpacing: '-1px', maxWidth: '900px', marginBottom: '24px',
        }}>
          {title}
        </div>

        {/* Subtitle */}
        <div style={{ color: '#94A3B8', fontSize: '24px', fontWeight: '400', maxWidth: '700px' }}>
          {subtitle}
        </div>

        {/* Bottom stats bar */}
        <div style={{
          marginTop: 'auto', display: 'flex', gap: '48px',
        }}>
          {['35+ Categories', 'Nationwide Coverage', 'Lead Scoring', 'CSV Export'].map(stat => (
            <div key={stat} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ color: '#0EA5E9', fontSize: '16px', fontWeight: '600' }}>{stat}</div>
            </div>
          ))}
        </div>

        {/* URL watermark */}
        <div style={{
          position: 'absolute', bottom: '40px', right: '80px',
          color: '#475569', fontSize: '18px',
        }}>
          leadzip.vercel.app
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
