/**
 * SSRF-hardened outbound probe — the ONLY way this app should fetch a URL that
 * a user supplied.
 *
 * Why this file exists
 * -------------------
 * The previous guard inspected the hostname STRING and blocked literal private
 * IPs. That is bypassable in one line with a public wildcard-DNS resolver:
 * `http://169.254.169.254.nip.io/` is a perfectly ordinary public hostname that
 * resolves to the cloud metadata service, and `http://127.0.0.1.nip.io/` (or
 * `10.0.0.1.sslip.io`) reaches loopback and private ranges. nip.io and sslip.io
 * are free public services, so an attacker needs no infrastructure at all.
 *
 * What this module does instead
 * -----------------------------
 *  1. Syntax check   — http/https only, no embedded credentials, no single-label
 *                      or internal-TLD hostnames.
 *  2. DNS resolution — resolve the hostname and reject if ANY returned address
 *                      is private, loopback, link-local (incl. 169.254.169.254),
 *                      CGNAT, multicast/reserved, IPv6 ULA/link-local, or an
 *                      IPv4-mapped/compatible/6to4/NAT64 wrapper around one.
 *  3. Connection pin  — the socket is opened against the exact address that was
 *                      validated, via a custom `lookup`, so the name cannot be
 *                      re-resolved to a private address between the check and
 *                      the connect (DNS rebinding).
 *  4. Every redirect hop repeats 1-3 from scratch. Nothing is inherited.
 *
 * Node's `dns`, `http`, `https` and `Buffer` are all built in — no new
 * dependency. They are loaded through an ignored dynamic import so that this
 * module stays harmless if a bundler ever pulls it into a browser chunk (it is
 * reachable from `healthScore.ts`, which client components import for scoring).
 */

import type { LookupFunction } from 'node:net'
import type { RequestOptions } from 'node:http'

type DnsModule = typeof import('node:dns')
type HttpModule = typeof import('node:http')
type HttpsModule = typeof import('node:https')

let dnsModule: Promise<DnsModule> | null = null
let httpModule: Promise<HttpModule> | null = null
let httpsModule: Promise<HttpsModule> | null = null

function loadDns(): Promise<DnsModule> {
  dnsModule ??= import(/* webpackIgnore: true */ /* turbopackIgnore: true */ 'node:dns') as Promise<DnsModule>
  return dnsModule
}
function loadHttp(): Promise<HttpModule> {
  httpModule ??= import(/* webpackIgnore: true */ /* turbopackIgnore: true */ 'node:http') as Promise<HttpModule>
  return httpModule
}
function loadHttps(): Promise<HttpsModule> {
  httpsModule ??= import(/* webpackIgnore: true */ /* turbopackIgnore: true */ 'node:https') as Promise<HttpsModule>
  return httpsModule
}

/** Thrown when a URL is refused before or during the probe (SSRF guard). */
export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsafeUrlError'
  }
}

/** Thrown when the probe itself fails (timeout, DNS miss, transport error). */
export class ProbeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProbeError'
  }
}

// TLDs that only resolve on internal networks — never fetch them server-side.
const BLOCKED_TLDS = new Set([
  'localhost',
  'local',
  'internal',
  'intranet',
  'corp',
  'home',
  'lan',
  'test',
  'onion',
])

// ---------------------------------------------------------------------------
// Address classification
// ---------------------------------------------------------------------------

function parseIpv4(value: string): number[] | null {
  const parts = value.split('.')
  if (parts.length !== 4) return null
  const octets: number[] = []
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const n = Number(part)
    if (n > 255) return null
    octets.push(n)
  }
  return octets
}

function isBlockedIpv4(octets: number[]): boolean {
  const [a, b, c] = octets
  if (a === 0) return true // 0.0.0.0/8 "this network"
  if (a === 10) return true // private
  if (a === 127) return true // loopback
  if (a === 169 && b === 254) return true // link-local, incl. 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true // private
  if (a === 192 && b === 168) return true // private
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT 100.64/10
  if (a === 192 && b === 0 && c === 0) return true // IETF protocol assignments
  if (a === 192 && b === 0 && c === 2) return true // TEST-NET-1
  if (a === 192 && b === 88 && c === 99) return true // 6to4 relay anycast
  if (a === 198 && (b === 18 || b === 19)) return true // benchmarking 198.18/15
  if (a === 198 && b === 51 && c === 100) return true // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true // TEST-NET-3
  if (a >= 224) return true // multicast 224/4, reserved 240/4, broadcast 255.255.255.255
  return false
}

/** Expand any IPv6 text form (incl. `::` and trailing dotted-quad) to 16 bytes. */
function parseIpv6(value: string): number[] | null {
  let addr = value.trim().toLowerCase()
  const zone = addr.indexOf('%') // strip scope id, e.g. fe80::1%en0
  if (zone !== -1) addr = addr.slice(0, zone)
  if (addr.startsWith('[') && addr.endsWith(']')) addr = addr.slice(1, -1)
  if (!addr.includes(':')) return null

  let tail: number[] = []
  const lastColon = addr.lastIndexOf(':')
  const maybeV4 = addr.slice(lastColon + 1)
  if (maybeV4.includes('.')) {
    const v4 = parseIpv4(maybeV4)
    if (!v4) return null
    tail = v4
    addr = addr.slice(0, lastColon + 1) + '0:0'
  }

  const halves = addr.split('::')
  if (halves.length > 2) return null
  const toGroups = (part: string): number[] | null => {
    if (!part) return []
    const groups: number[] = []
    for (const g of part.split(':')) {
      if (!/^[0-9a-f]{1,4}$/.test(g)) return null
      groups.push(parseInt(g, 16))
    }
    return groups
  }
  const head = toGroups(halves[0])
  const rest = halves.length === 2 ? toGroups(halves[1]) : []
  if (!head || !rest) return null

  let groups: number[]
  if (halves.length === 2) {
    const fill = 8 - head.length - rest.length
    if (fill < 0) return null
    groups = [...head, ...Array<number>(fill).fill(0), ...rest]
  } else {
    groups = head
  }
  if (groups.length !== 8) return null

  const bytes: number[] = []
  for (const g of groups) {
    bytes.push((g >> 8) & 0xff, g & 0xff)
  }
  if (tail.length === 4) {
    bytes[12] = tail[0]
    bytes[13] = tail[1]
    bytes[14] = tail[2]
    bytes[15] = tail[3]
  }
  return bytes
}

function isBlockedIpv6(bytes: number[]): boolean {
  const allZeroThrough = (end: number) => bytes.slice(0, end).every((b) => b === 0)

  // ::/128 unspecified and ::1/128 loopback
  if (allZeroThrough(15) && (bytes[15] === 0 || bytes[15] === 1)) return true
  // ::ffff:a.b.c.d — IPv4-mapped. Unwrap and judge as IPv4.
  if (allZeroThrough(10) && bytes[10] === 0xff && bytes[11] === 0xff) {
    return isBlockedIpv4(bytes.slice(12))
  }
  // ::a.b.c.d — deprecated IPv4-compatible. Unwrap and judge as IPv4.
  if (allZeroThrough(12)) return isBlockedIpv4(bytes.slice(12))
  // 64:ff9b::/96 and 64:ff9b:1::/48 — NAT64 translation of any IPv4 address.
  if (bytes[0] === 0x00 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b) return true
  // 2002::/16 — 6to4, embeds an arbitrary IPv4 address.
  if (bytes[0] === 0x20 && bytes[1] === 0x02) return true
  // 2001:0000::/32 Teredo (embeds IPv4) and 2001:db8::/32 documentation.
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00) return true
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8) return true
  // fc00::/7 unique-local
  if ((bytes[0] & 0xfe) === 0xfc) return true
  // fe80::/10 link-local and fec0::/10 (deprecated) site-local
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return true
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0xc0) return true
  // ff00::/8 multicast
  if (bytes[0] === 0xff) return true
  return false
}

/**
 * True when an IP address must never be contacted from a server-side probe.
 * Unknown / unparseable input is treated as blocked (fail closed).
 */
export function isBlockedIpAddress(address: string): boolean {
  const v4 = parseIpv4(address)
  if (v4) return isBlockedIpv4(v4)
  const v6 = parseIpv6(address)
  if (v6) return isBlockedIpv6(v6)
  return true
}

// ---------------------------------------------------------------------------
// URL + DNS validation
// ---------------------------------------------------------------------------

/** Syntax-level gate. Cheap rejections before any DNS traffic is generated. */
function parseProbeUrl(raw: string | URL): URL {
  let parsed: URL
  try {
    parsed = raw instanceof URL ? raw : new URL(raw)
  } catch {
    throw new UnsafeUrlError('malformed URL')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UnsafeUrlError(`unsupported protocol ${parsed.protocol}`)
  }
  if (parsed.username || parsed.password) {
    throw new UnsafeUrlError('URL credentials are not allowed')
  }
  const hostname = parsed.hostname.toLowerCase()
  if (!hostname) throw new UnsafeUrlError('missing hostname')

  // IPv6 literals arrive bracketed; the DNS stage validates the address itself.
  if (!hostname.startsWith('[')) {
    const labels = hostname.replace(/\.$/, '').split('.')
    if (labels.length < 2) throw new UnsafeUrlError('single-label hostnames are not allowed')
    if (BLOCKED_TLDS.has(labels[labels.length - 1])) {
      throw new UnsafeUrlError('internal TLDs are not allowed')
    }
  }
  return parsed
}

interface PinnedAddress {
  address: string
  family: 4 | 6
}

/**
 * Resolve the hostname and refuse the request unless EVERY address it maps to
 * is publicly routable. Returns the single address the socket will be pinned to.
 */
async function resolveAndValidate(hostname: string): Promise<PinnedAddress> {
  const host = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname
  const dns = await loadDns()

  let records: { address: string; family: number }[]
  try {
    records = await dns.promises.lookup(host, { all: true, verbatim: true })
  } catch {
    throw new ProbeError(`DNS lookup failed for ${host}`)
  }
  if (records.length === 0) throw new ProbeError(`DNS lookup returned nothing for ${host}`)

  for (const record of records) {
    if (isBlockedIpAddress(record.address)) {
      throw new UnsafeUrlError(`${host} resolves to a non-public address (${record.address})`)
    }
  }
  const chosen = records[0]
  return { address: chosen.address, family: chosen.family === 6 ? 6 : 4 }
}

/**
 * A `lookup` implementation that ignores the hostname and hands back the
 * already-validated address. This is what makes the check and the connect
 * agree — without it, a hostname with a 0-second TTL can answer "public" for
 * the guard and "169.254.169.254" for the socket (DNS rebinding).
 */
function pinnedLookup(pin: PinnedAddress): LookupFunction {
  return ((
    _hostname: string,
    options: unknown,
    callback?: (err: NodeJS.ErrnoException | null, address: unknown, family?: number) => void
  ) => {
    const cb = typeof options === 'function' ? (options as typeof callback) : callback
    if (!cb) return
    const wantsAll =
      typeof options === 'object' && options !== null && (options as { all?: boolean }).all === true
    if (wantsAll) {
      cb(null, [{ address: pin.address, family: pin.family }])
    } else {
      cb(null, pin.address, pin.family)
    }
  }) as unknown as LookupFunction
}

// ---------------------------------------------------------------------------
// The probe
// ---------------------------------------------------------------------------

export interface SafeProbeOptions {
  /** Overall budget for the whole chain, redirects included. Default 5000ms. */
  timeoutMs?: number
  /** Hard cap on bytes read from the body. Default 256KB. */
  maxBytes?: number
  /** Redirect hops allowed. Every hop is re-validated. Default 3. */
  maxRedirects?: number
  userAgent?: string
}

export interface SafeProbeResult {
  /** URL actually fetched after redirects. */
  finalUrl: string
  status: number
  ok: boolean
  /** Response body, decoded as UTF-8 and truncated to `maxBytes`. */
  body: string
  /** Wall-clock time for the whole chain. */
  elapsedMs: number
  redirects: number
}

interface RawResponse {
  status: number
  location: string | null
  body: Buffer
}

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; LeadZipp/1.0)'

function requestOnce(
  url: URL,
  pin: PinnedAddress,
  mod: HttpModule | HttpsModule,
  opts: { headers: Record<string, string>; timeoutMs: number; maxBytes: number }
): Promise<RawResponse> {
  return new Promise<RawResponse>((resolve, reject) => {
    let settled = false
    let timedOut = false
    const timers: ReturnType<typeof setTimeout>[] = []
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      for (const timer of timers) clearTimeout(timer)
      fn()
    }
    const fail = (err: Error) => finish(() => reject(timedOut ? new ProbeError('probe timed out') : err))

    const requestOptions: RequestOptions = {
      method: 'GET',
      // A one-off agent: no keep-alive pooling, so the pinned lookup is applied
      // to every single connection instead of a socket being reused by name.
      agent: false,
      headers: opts.headers,
      lookup: pinnedLookup(pin),
      timeout: opts.timeoutMs,
    }

    const req = mod.request(url, requestOptions, (res) => {
      const status = res.statusCode ?? 0
      const location = typeof res.headers.location === 'string' ? res.headers.location : null

      if (status >= 300 && status < 400 && location) {
        res.destroy() // body of a redirect is not interesting; do not read it
        finish(() => resolve({ status, location, body: Buffer.alloc(0) }))
        return
      }

      const chunks: Buffer[] = []
      let total = 0
      let truncated = false
      res.on('data', (chunk: Buffer) => {
        if (truncated) return
        chunks.push(chunk)
        total += chunk.length
        if (total >= opts.maxBytes) {
          truncated = true
          res.destroy()
        }
      })
      // A body cut short by the deadline is an error, not a short read: the old
      // AbortController-based probe reported those sites as unreachable too.
      const done = () => {
        if (timedOut) fail(new ProbeError('probe timed out'))
        else finish(() => resolve({ status, location: null, body: Buffer.concat(chunks) }))
      }
      res.on('end', done)
      res.on('close', done)
      res.on('error', (err: Error) => {
        if (truncated && !timedOut) done()
        else fail(err)
      })
    })

    // Hard deadline: covers a server that trickles bytes forever as well as one
    // that never answers at all.
    timers.push(
      setTimeout(() => {
        timedOut = true
        req.destroy(new ProbeError('probe timed out'))
      }, opts.timeoutMs)
    )
    req.on('timeout', () => {
      timedOut = true
      req.destroy(new ProbeError('probe timed out'))
    })
    req.on('error', fail)
    req.end()
  })
}

/**
 * Fetch a user-supplied URL with full SSRF protection.
 *
 * Throws `UnsafeUrlError` when the target is refused and `ProbeError` when the
 * request fails. Callers that only care "did it work" should catch both.
 */
export async function safeProbe(rawUrl: string, options: SafeProbeOptions = {}): Promise<SafeProbeResult> {
  const timeoutMs = options.timeoutMs ?? 5000
  const maxBytes = options.maxBytes ?? 256 * 1024
  const maxRedirects = options.maxRedirects ?? 3
  const headers = {
    'User-Agent': options.userAgent ?? DEFAULT_USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    // Ask for an unencoded body so the size cap counts real bytes and no
    // decompression bomb can expand past it.
    'Accept-Encoding': 'identity',
  }

  const started = Date.now()
  const deadline = started + timeoutMs
  let url = parseProbeUrl(rawUrl)

  for (let hop = 0; ; hop++) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) throw new ProbeError('probe timed out')

    // Re-validated from scratch on every hop: syntax, DNS, and the pin.
    const pin = await resolveAndValidate(url.hostname)
    const mod = url.protocol === 'https:' ? await loadHttps() : await loadHttp()
    const res = await requestOnce(url, pin, mod, {
      headers,
      timeoutMs: Math.max(1, deadline - Date.now()),
      maxBytes,
    })

    if (res.location && res.status >= 300 && res.status < 400) {
      if (hop >= maxRedirects) throw new ProbeError('too many redirects')
      let next: URL
      try {
        next = new URL(res.location, url)
      } catch {
        throw new UnsafeUrlError('malformed redirect target')
      }
      url = parseProbeUrl(next)
      continue
    }

    return {
      finalUrl: url.toString(),
      status: res.status,
      ok: res.status >= 200 && res.status < 300,
      body: new TextDecoder('utf-8', { fatal: false }).decode(res.body),
      elapsedMs: Date.now() - started,
      redirects: hop,
    }
  }
}
