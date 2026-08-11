export interface WhiteLabelSettings {
  agencyName: string
  logoDataUrl: string
  accentColor: string
}

const KEY = 'leadzip_whitelabel'

export const DEFAULT_WHITE_LABEL: WhiteLabelSettings = {
  agencyName: '',
  logoDataUrl: '',
  accentColor: '#FF4D23',
}

export function getWhiteLabel(): WhiteLabelSettings {
  if (typeof window === 'undefined') return DEFAULT_WHITE_LABEL
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_WHITE_LABEL
    return { ...DEFAULT_WHITE_LABEL, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_WHITE_LABEL
  }
}

export function saveWhiteLabel(settings: WhiteLabelSettings): void {
  localStorage.setItem(KEY, JSON.stringify(settings))
}
