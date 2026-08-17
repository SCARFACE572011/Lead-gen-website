'use client'

import dynamic from 'next/dynamic'

// These three widgets are floating chrome that never contains the page's
// largest-contentful-paint element (that is always page copy) and each stays
// invisible until its own reveal condition fires (a timer, an auth check, or
// a manual open). Loading them through next/dynamic with ssr:false pulls
// their code — and the `motion` animation library they share — out of the
// JS every route has to parse before first paint, and defers it to load
// right after hydration instead. `ssr: false` requires a Client Component,
// which is the only reason this wrapper exists instead of calling
// next/dynamic directly from the (server) root layout.
const OnboardingModal = dynamic(
  () => import('@/components/OnboardingModal').then((m) => m.OnboardingModal),
  { ssr: false }
)
const PromoPopup = dynamic(
  () => import('@/components/PromoPopup').then((m) => m.PromoPopup),
  { ssr: false }
)
const ChatWidget = dynamic(
  () => import('@/components/chat/ChatWidget').then((m) => m.ChatWidget),
  { ssr: false }
)

export function DeferredWidgets() {
  return (
    <>
      <OnboardingModal />
      <PromoPopup />
      <ChatWidget />
    </>
  )
}
