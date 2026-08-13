/**
 * Client startup hook. Next.js runs this file once in the browser, before the
 * app hydrates, on every initial page load and for every route.
 *
 * This is the site-wide capture point for the Google click id. An ad click is
 * always a hard navigation, so `?gclid=...` is present in window.location here
 * no matter which page the ad points at (/, /pricing, a /leads landing page, a
 * blog post). That means gclid capture needs no edit to src/app/layout.tsx and
 * no per-page wiring.
 *
 * `track()` re-checks the URL on every event as a safety net for the rare case
 * where a gclid shows up on a client-side navigation instead.
 */
import { captureGclid } from '@/lib/analytics'

captureGclid()
