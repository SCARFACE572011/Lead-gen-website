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
    if (!mapRef.current) return

    let cancelled = false

    // Destroy previous map instance before creating a new one
    if (mapInstanceRef.current) {
      // @ts-expect-error leaflet map
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
    }

    import('leaflet').then((L) => {
      if (cancelled || !mapRef.current) return

      // Fix default marker icons (broken in webpack builds)
      // @ts-expect-error leaflet internal
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.map(mapRef.current).setView([centerLat, centerLon], 11)
      mapInstanceRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map)

      // Search area ring
      L.circle([centerLat, centerLon], { radius: 800, color: '#0369A1', fillOpacity: 0.08, weight: 1.5 }).addTo(map)

      const leadsWithCoords = leads.filter((l) => l.latitude != null && l.longitude != null)

      // Lead markers
      leadsWithCoords.forEach((lead) => {
        const scoreColor = lead.leadScore >= 80 ? '#ef4444' : lead.leadScore >= 50 ? '#f97316' : '#64748b'

        const icon = L.divIcon({
          className: '',
          html: `<div style="background:${scoreColor};width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        })

        const addressLine = [lead.address, lead.city, lead.state].filter(Boolean).join(', ')

        const marker = L.marker([lead.latitude!, lead.longitude!], { icon })
          .addTo(map)
          .bindPopup(`
            <div style="min-width:180px;font-family:system-ui,sans-serif">
              <strong style="font-size:13px;display:block;margin-bottom:2px">${lead.businessName}</strong>
              <span style="color:#64748b;font-size:11px;display:block;margin-bottom:4px">${lead.category}</span>
              ${addressLine ? `<span style="font-size:11px;display:block;margin-bottom:2px">📍 ${addressLine}</span>` : ''}
              ${lead.phone ? `<span style="font-size:12px;display:block;margin-bottom:2px">📞 ${lead.phone}</span>` : ''}
              ${lead.rating ? `<span style="font-size:12px;display:block;margin-bottom:2px">⭐ ${lead.rating} (${lead.reviewCount ?? 0} reviews)</span>` : ''}
              <span style="font-size:11px;color:#64748b">${lead.distanceMiles?.toFixed(1) ?? '?'} mi away</span>
            </div>
          `)

        if (onLeadClick) {
          marker.on('click', () => onLeadClick(lead))
        }
      })

      // If no coordinates available, show an info message on the map
      if (leadsWithCoords.length === 0 && leads.length > 0) {
        const noCoordMsg = L.popup({ closeButton: false, autoClose: false, closeOnClick: false })
          .setLatLng([centerLat, centerLon])
          .setContent('<div style="font-size:12px;text-align:center;padding:4px">Map view shows businesses with verified locations.<br/>Switch to card or table view to see all results.</div>')
          .openOn(map)
        void noCoordMsg
      }
    })

    return () => {
      cancelled = true
      if (mapInstanceRef.current) {
        // @ts-expect-error leaflet map
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  // centerLat/centerLon are stable per search; leads identity changes on new search
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, centerLat, centerLon])

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
