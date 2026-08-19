import { Star, Plus, Minus, Navigation } from 'lucide-react'

/* A cartographic hero panel: a light street map of the sample territory with
   scored pin markers and one open info card — drawn as hand-authored SVG so
   the street network reads as a believable place, not a uniform grid.
   Server-rendered, static except for one gentle pulse on the selected pin
   (CSS .pin-pulse, already reduced-motion safe). Sample data, labeled. */

const PINS = [
  // hot signal pins carry white score text; warm/low step down the same ramp
  { x: 152, y: 118, score: 96, hot: true, selected: true },
  { x: 306, y: 226, score: 91, hot: true },
  { x: 352, y: 92, score: 84, hot: true },
  { x: 100, y: 296, score: 62, warm: true },
  { x: 398, y: 296, score: 38 },
]

export function MapPanel() {
  return (
    <div className="relative">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white text-ink shadow-[0_1px_0_0_rgba(0,0,0,0.2),0_30px_80px_-24px_rgba(0,0,0,0.55)]">
        {/* App toolbar */}
        <div className="flex items-center justify-between gap-3 border-b border-sand bg-white px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold leading-tight">HVAC Contractors · Plano, TX</p>
            <p className="readout mt-0.5 text-stone">23 results · ZIP 75023 · example</p>
          </div>
          <span className="readout shrink-0 rounded-full bg-paper-2 px-2.5 py-1 text-stone">Map view</span>
        </div>

        {/* The map */}
        <div className="relative">
          <svg viewBox="0 0 480 340" className="block w-full" role="img" aria-label="Map of a sample territory with five scored business pins">
            {/* ground */}
            <rect width="480" height="340" fill="#F1EDE3" />
            {/* park + greenbelt along the creek */}
            <path d="M300 250 C340 230 380 250 480 232 L480 340 L260 340 C270 300 280 264 300 250 Z" fill="#E2E8D6" />
            <path d="M20 20 h96 v70 h-96 Z" fill="#E2E8D6" opacity="0.7" />
            {/* creek */}
            <path d="M270 340 C290 300 330 280 480 268" fill="none" stroke="#C9D8CE" strokeWidth="10" strokeLinecap="round" />
            {/* street casings (sand), then street fills (white) — widths vary */}
            <g stroke="#DDD6C6" fill="none">
              <path d="M0 66 H480" strokeWidth="13" />
              <path d="M0 160 C120 156 300 166 480 158" strokeWidth="9" />
              <path d="M0 258 H310" strokeWidth="9" />
              <path d="M96 0 V340" strokeWidth="13" />
              <path d="M212 0 C210 120 216 240 212 340" strokeWidth="8" />
              <path d="M330 0 V258" strokeWidth="9" />
              <path d="M416 0 V232" strokeWidth="7" />
              <path d="M212 208 c40 -4 70 10 118 0" strokeWidth="6" />
              <path d="M330 116 c50 6 90 -2 150 4" strokeWidth="6" />
              <path d="M96 208 c-30 4 -60 -6 -96 0" strokeWidth="6" />
            </g>
            <g stroke="#FFFFFF" fill="none">
              <path d="M0 66 H480" strokeWidth="9" />
              <path d="M0 160 C120 156 300 166 480 158" strokeWidth="6" />
              <path d="M0 258 H310" strokeWidth="6" />
              <path d="M96 0 V340" strokeWidth="9" />
              <path d="M212 0 C210 120 216 240 212 340" strokeWidth="5" />
              <path d="M330 0 V258" strokeWidth="6" />
              <path d="M416 0 V232" strokeWidth="4.5" />
              <path d="M212 208 c40 -4 70 10 118 0" strokeWidth="4" />
              <path d="M330 116 c50 6 90 -2 150 4" strokeWidth="4" />
              <path d="M96 208 c-30 4 -60 -6 -96 0" strokeWidth="4" />
            </g>
            {/* cul-de-sac */}
            <path d="M416 232 c0 14 -16 14 -16 0" fill="none" stroke="#FFFFFF" strokeWidth="4.5" />
            {/* street names */}
            <g fill="#A29a86" fontFamily="ui-monospace, SFMono-Regular, Consolas, monospace" fontSize="8.5" letterSpacing="0.06em">
              <text x="14" y="60">LEGACY DR</text>
              <text x="238" y="153">WINDHAVEN PKWY</text>
              <text x="14" y="252">15TH ST</text>
              <text x="88" y="330" transform="rotate(-90 88 330)">CUSTER RD</text>
              <text x="324" y="252" transform="rotate(-90 324 252)">INDEPENDENCE</text>
            </g>
            {/* pin stems + markers */}
            {PINS.map((p) => (
              <g key={`${p.x}-${p.y}`}>
                <circle cx={p.x} cy={p.y + 14} r="2.5" fill="rgba(23,19,14,0.25)" />
                <line x1={p.x} y1={p.y + 12} x2={p.x} y2={p.y + 4} stroke="rgba(23,19,14,0.3)" strokeWidth="1.5" />
              </g>
            ))}
          </svg>

          {/* HTML pin badges over the SVG (crisper text, real font) */}
          {PINS.map((p) => {
            const left = `${(p.x / 480) * 100}%`
            const top = `${(p.y / 340) * 100}%`
            return (
              <span
                key={`badge-${p.x}`}
                className="absolute flex -translate-x-1/2 -translate-y-full items-center justify-center"
                style={{ left, top }}
                aria-hidden
              >
                {p.selected && <span className="pin-pulse absolute h-4 w-4 rounded-full bg-signal/35" />}
                <span
                  className={`relative flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 font-mono text-xs font-bold shadow-[0_2px_6px_rgba(23,19,14,0.25)] ring-2 ${
                    p.hot
                      ? 'bg-signal text-white ring-white'
                      : p.warm
                        ? 'bg-signal-50 text-signal-600 ring-white'
                        : 'bg-white text-stone ring-sand'
                  }`}
                >
                  {p.score}
                </span>
              </span>
            )
          })}

          {/* Info card for the selected pin */}
          <div className="absolute left-[7%] top-[38%] w-64 rounded-xl border border-sand bg-white p-3.5 shadow-[0_14px_40px_-12px_rgba(23,19,14,0.35)]">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-display text-[15px] font-bold leading-tight">Windhaven Heating &amp; Air</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft">
                  <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" aria-hidden />
                  <span className="font-mono">3.9</span>
                  <span className="text-stone">(12 reviews)</span>
                </p>
                <p className="mt-1 text-xs font-semibold text-signal">No website</p>
              </div>
              <span className="inline-flex shrink-0 items-center rounded-full bg-signal px-2 py-0.5 font-mono text-xs font-bold text-white">96</span>
            </div>
            <p className="mt-2.5 border-t border-sand pt-2 text-xs font-semibold text-signal">Find email →</p>
          </div>

          {/* Map controls */}
          <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-lg border border-sand bg-white shadow-card" aria-hidden>
            <span className="flex h-8 w-8 items-center justify-center border-b border-sand text-ink-soft"><Plus className="h-4 w-4" /></span>
            <span className="flex h-8 w-8 items-center justify-center text-ink-soft"><Minus className="h-4 w-4" /></span>
          </div>
          <span className="absolute bottom-3 left-3 flex h-8 w-8 items-center justify-center rounded-lg border border-sand bg-white text-signal shadow-card" aria-hidden>
            <Navigation className="h-4 w-4" />
          </span>
        </div>
      </div>
    </div>
  )
}
