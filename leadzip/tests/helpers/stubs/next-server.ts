/**
 * Unit-test stand-in for next/server.
 *
 * The route handlers under test only ever build responses with
 * NextResponse.json(...), and the tests assert on the status and the parsed
 * body, so a plain object with the same shape is enough. Keeping it here means
 * the money-handling routes can be exercised end to end without booting Next.
 */
export interface StubResponse {
  status: number
  headers: Record<string, string>
  json(): Promise<unknown>
}

export class NextRequest {
  url: string
  headers: Headers
  private readonly rawBody: string

  constructor(url = 'https://leadzipp.com/', init: { body?: string; headers?: Record<string, string> } = {}) {
    this.url = url
    this.rawBody = init.body ?? ''
    this.headers = new Headers(init.headers ?? {})
  }

  async text(): Promise<string> {
    return this.rawBody
  }

  async json(): Promise<unknown> {
    return JSON.parse(this.rawBody)
  }
}

export const NextResponse = {
  json(
    body: unknown,
    init: { status?: number; headers?: Record<string, string> } = {}
  ): StubResponse {
    return {
      status: init.status ?? 200,
      headers: init.headers ?? {},
      async json() {
        return body
      },
    }
  },
}
