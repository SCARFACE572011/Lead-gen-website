'use client'
import { useEffect, useRef } from 'react'
import type { Lead } from '@/types/lead'

interface LeadsMapProps {
  leads: Lead[]
  centerLat: number
  centerLon: number
  onLeadClick?: (lead: Lead) => void
}

export function LeadsMap({ leads, centerLat, centerLon, onLeadClick }: LeadsMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<unknown>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    // Dynamic import — leaflet only works client-side
    import('leaflet').then((L) => {
      // Fix default marker icons (broken in webpack builds)
      // @ts-expect-error leaflet internal
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.map(mapRef.current!).setView([centerLat, centerLon], 13)
      mapInstanceRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map)

      // Center marker
      L.circle([centerLat, centerLon], { radius: 400, color: '#0369A1', fillOpacity: 0.1 }).addTo(map)

      // Lead markers
      leads.forEach((lead) => {
        if (!lead.latitude || !lead.longitude) return

        const scoreColor = lead.leadScore >= 80 ? '#ef4444' : lead.leadScore >= 50 ? '#f97316' : '#64748b'

        const icon = L.divIcon({
          className: '',
          html: `<div style="background:${scoreColor};width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        })

        const marker = L.marker([lead.latitude, lead.longitude], { icon })
          .addTo(map)
          .bindPopup(`
            <div style="min-width:160px">
              <strong style="font-size:13px">${lead.businessName}</strong><br/>
              <span style="color:#64748b;font-size:11px">${lead.category}</span><br/>
              ${lead.phone ? `<span style="font-size:12px">📞 ${lead.phone}</span><br/>` : ''}
              ${lead.rating ? `<span style="font-size:12px">⭐ ${lead.rating} (${lead.reviewCount ?? 0})</span><br/>` : ''}
              <span style="font-size:11px;color:#64748b">${lead.distanceMiles?.toFixed(1) ?? '?'} mi away</span>
            </div>
          `)

        if (onLeadClick) {
          marker.on('click', () => onLeadClick(lead))
        }
      })
    })

    return () => {
      if (mapInstanceRef.current) {
        // @ts-expect-error leaflet map
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        crossOrigin=""
      />
      <div
        ref={mapRef}
        className="w-full rounded-xl border border-white/10 overflow-hidden"
        style={{ height: '480px' }}
      />
    </>
  )
}
